import type { Env } from "../config";
import { verifyTaskJwt, type TaskClaims } from "../auth/jwt";
import { revokeAgent } from "../identity/store";
import { evaluatePolicy, OUTBOUND_ACTIONS, parseLimit, type PolicyResult } from "./policy";
import { audit, getIamState, lowerTrust, TRUST_PENALTY, type AgentState, type Approval } from "./state";

/**
 * Layer 3 — Policy gateway + sandbox.
 * Every tool call goes through here. The agent never holds real credentials:
 * the gateway injects them only for calls the policy allows.
 */

/** Real secrets live only in the gateway. They are never returned to the agent. */
const VAULT = {
  drive: "drv_live_4f9c2b1e8a77",
  mail: "smtp_live_a91d03f6c2e5",
  net: "fx_live_7e21bb90",
  git: "ghp_live_c3d81f02aa96",
  bank: "bank_live_55e0a7c1",
} as const;

export type ToolCall = { action: string; resource: string; args?: Record<string, unknown> };

export type GatewayResult = {
  decision: "allow" | "deny" | "needs_approval" | "dropped";
  reason: string;
  result?: unknown;
  approval_id?: string;
  credential?: string;
  agent?: Pick<AgentState, "trust" | "quarantined" | "revoked">;
};

function hostOf(url: string) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
}

/** Runs an action against the simulated company world (files, email, internet). */
export function runInWorld(call: ToolCall, opts: { from: string }): unknown {
  const { world } = getIamState();
  const args = call.args ?? {};
  if (call.action === "files:read" || call.action === "repo:read") {
    const file = world.files[call.resource];
    if (!file) return { error: "file_not_found" };
    return { path: call.resource, classification: file.classification, content: file.content };
  }
  if (call.action === "files:delete") {
    if (!world.files[call.resource]) return { error: "file_not_found" };
    delete world.files[call.resource];
    world.deleted.push(call.resource);
    return { deleted: call.resource };
  }
  if (call.action === "payments:send") {
    const payment = { id: crypto.randomUUID(), ts: new Date().toISOString(), to: call.resource, amount: String(args.amount ?? "unknown") };
    world.payments.push(payment);
    return { paid: payment.amount, to: payment.to, payment_id: payment.id };
  }
  if (call.action === "email:send") {
    const to = call.resource.replace(/^mailto:/, "").toLowerCase();
    const attachments = (Array.isArray(args.attachments) ? args.attachments : []).map(String);
    const msg = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      from: opts.from,
      to,
      subject: String(args.subject ?? "(no subject)"),
      body: String(args.body ?? ""),
      attachments,
    };
    (world.mailboxes[to] ??= []).push(msg);
    return { delivered_to: to, message_id: msg.id };
  }
  if (call.action === "net:fetch") {
    const host = hostOf(call.resource);
    if (host === "api.exchangerate.host") return { status: 200, body: { base: "USD", INR: 83.2 } };
    world.attacker_server.push({
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      url: call.resource,
      body: String(args.body ?? ""),
      via: "net:fetch",
    });
    return { status: 200, body: "upload received" };
  }
  return { error: "unknown_action" };
}

/** The read permission a resource needs: code lives in repo://, everything else in drive://. */
export function readActionFor(resource: string) {
  return resource.startsWith("repo://") ? "repo:read" : "files:read";
}

/**
 * Attachments are checked separately: an agent can only attach files its role may read.
 * This stops an approved email from carrying data the agent was never allowed to touch.
 */
function filterAttachments(roleId: string, call: ToolCall): { call: ToolCall; removed: string[] } {
  const role = getIamState().roles[roleId];
  const list = Array.isArray(call.args?.attachments) ? (call.args!.attachments as unknown[]).map(String) : [];
  if (!role || list.length === 0) return { call, removed: [] };
  const kept = list.filter((a) => evaluatePolicy(role, readActionFor(a), a).decision === "allow");
  const removed = list.filter((a) => !kept.includes(a));
  return { call: { ...call, args: { ...call.args, attachments: kept } }, removed };
}

function checkRateLimit(agentId: string, policy: PolicyResult): string | null {
  const lim = parseLimit(policy.rule?.limit);
  if (!lim || policy.decision !== "allow") return null;
  const state = getIamState();
  const key = `${agentId}|${policy.rule!.action}|${policy.rule!.resource}`;
  const now = Date.now();
  const hits = (state.rate[key] ?? []).filter((t) => now - t < lim.windowMs);
  if (hits.length >= lim.count) return `Rate limit reached (${policy.rule!.limit})`;
  hits.push(now);
  state.rate[key] = hits;
  return null;
}

function credentialFor(action: string) {
  if (action.startsWith("files:")) return VAULT.drive;
  if (action.startsWith("repo:")) return VAULT.git;
  if (action.startsWith("payments:")) return VAULT.bank;
  if (action.startsWith("email:")) return VAULT.mail;
  return VAULT.net;
}

function maskSecret(secret: string) {
  return `${secret.slice(0, 8)}••••`;
}

async function onDenied(env: Env, agent: AgentState, penalty: number, runId?: string) {
  agent.denied_count++;
  const wasRevoked = agent.revoked;
  lowerTrust(agent, penalty);
  if (agent.revoked && !wasRevoked) {
    await revokeAgent(env, agent.agent_id).catch(() => null);
    audit({
      run_id: runId,
      layer: 1,
      agent_id: agent.agent_id,
      agent_name: agent.agent_name,
      event: "Identity revoked",
      decision: "deny",
      reason: `Trust score fell to ${agent.trust}. AgentWarden revoked this agent's identity token.`,
    });
  }
}

/** Gateway entry point used by the HTTP route and the demo. */
export async function executeThroughGateway(
  env: Env,
  token: string,
  call: ToolCall,
  runId?: string
): Promise<GatewayResult> {
  let claims: TaskClaims;
  try {
    claims = await verifyTaskJwt(env, token);
  } catch {
    return { decision: "deny", reason: "Missing, invalid or expired task token" };
  }

  const state = getIamState();
  const agent = state.agents[claims.agent_id];
  const role = state.roles[claims.role_id];
  const base = { run_id: runId, layer: 3 as const, agent_id: claims.agent_id, agent_name: claims.agent_name, action: call.action, resource: call.resource };

  if (!agent || !role) return { decision: "deny", reason: "Unknown agent or role" };
  const snapshot = () => ({ trust: agent.trust, quarantined: agent.quarantined, revoked: agent.revoked });

  if (agent.revoked) {
    audit({ ...base, event: "Gateway check", decision: "deny", reason: "Agent identity is revoked" });
    return { decision: "deny", reason: "Agent identity is revoked", agent: snapshot() };
  }
  if (agent.active_task_id !== claims.task_id) {
    audit({ ...base, event: "Gateway check", decision: "deny", reason: "Task token does not belong to the agent's active task" });
    return { decision: "deny", reason: "Task token is not for the active task", agent: snapshot() };
  }

  let policy = evaluatePolicy(role, call.action, call.resource);

  // Risk signal from Layer 2: a quarantined agent keeps read access, but anything that
  // sends data out or changes things needs the owner's approval.
  const outbound = OUTBOUND_ACTIONS.includes(call.action) || (call.action === "net:fetch" && Boolean(call.args?.body));
  if (agent.quarantined && policy.decision === "allow" && outbound) {
    policy = { ...policy, decision: "needs_approval", reason: `Agent is quarantined after a shield alert — owner must confirm (${agent.quarantine_reason ?? "injection detected"})` };
  }

  if (policy.decision === "deny") {
    await onDenied(env, agent, TRUST_PENALTY.denied_action, runId);
    audit({ ...base, event: "Gateway check", decision: "deny", reason: policy.reason });
    return { decision: "deny", reason: policy.reason, agent: snapshot() };
  }

  if (policy.decision === "needs_approval") {
    const approval: Approval = {
      approval_id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      run_id: runId,
      agent_id: agent.agent_id,
      agent_name: agent.agent_name,
      action: call.action,
      resource: call.resource,
      args: call.args ?? {},
      reason: policy.reason,
      status: "pending",
    };
    state.approvals.unshift(approval);
    audit({ ...base, event: "Paused for owner approval", decision: "needs_approval", reason: policy.reason });
    return { decision: "needs_approval", reason: policy.reason, approval_id: approval.approval_id, agent: snapshot() };
  }

  const limited = checkRateLimit(agent.agent_id, policy);
  if (limited) {
    await onDenied(env, agent, TRUST_PENALTY.denied_action, runId);
    audit({ ...base, event: "Gateway check", decision: "deny", reason: limited });
    return { decision: "deny", reason: limited, agent: snapshot() };
  }

  const credential = credentialFor(call.action);
  const filtered = filterAttachments(role.role_id, call);
  const result = runInWorld(filtered.call, { from: `${agent.agent_name}@agents.ourcompany.com` });
  const stripped = filtered.removed.length ? ` · removed attachments it may not read: ${filtered.removed.join(", ")}` : "";
  audit({ ...base, event: "Executed via gateway", decision: "allow", reason: `${policy.reason} · credential injected by gateway${stripped}` });
  return { decision: "allow", reason: policy.reason, result, credential: `injected by gateway (${maskSecret(credential)}) — agent never saw it`, agent: snapshot() };
}

/**
 * Sandbox network wall: traffic that tries to skip the gateway and leave the sandbox directly.
 * Only hosts listed in the agent's net:fetch policy are reachable.
 */
export async function sandboxDirectEgress(env: Env, agentId: string, url: string, body: string, runId?: string): Promise<GatewayResult> {
  const state = getIamState();
  const agent = state.agents[agentId];
  if (!agent) return { decision: "deny", reason: "Unknown agent" };
  const role = state.roles[agent.role_id]!;
  const allowedHosts = role.allow.filter((r) => r.action === "net:fetch").map((r) => hostOf(r.resource.replace(/\*$/, "")));
  const host = hostOf(url);
  const base = { run_id: runId, layer: 3 as const, agent_id: agentId, agent_name: agent.agent_name, action: "net:direct", resource: url };
  if (allowedHosts.includes(host)) {
    audit({ ...base, event: "Sandbox egress", decision: "allow", reason: `${host} is on the egress allowlist` });
    return { decision: "allow", reason: `${host} is on the egress allowlist` };
  }
  await onDenied(env, agent, TRUST_PENALTY.denied_action, runId);
  const reason = `Sandbox network wall dropped the connection: ${host || url} is not on the egress allowlist (${allowedHosts.join(", ") || "none"})`;
  audit({ ...base, event: "Sandbox egress", decision: "dropped", reason });
  void body;
  return { decision: "dropped", reason, agent: { trust: agent.trust, quarantined: agent.quarantined, revoked: agent.revoked } };
}

/** Owner resolves a paused action. Approve → the gateway runs it; reject → trust drops. */
export async function resolveApproval(env: Env, approvalId: string, approve: boolean) {
  const state = getIamState();
  const approval = state.approvals.find((a) => a.approval_id === approvalId);
  if (!approval) return { error: "approval_not_found" as const };
  if (approval.status !== "pending") return { error: "already_resolved" as const, approval };
  const agent = state.agents[approval.agent_id];
  approval.resolved_at = new Date().toISOString();
  const base = { run_id: approval.run_id, layer: 3 as const, agent_id: approval.agent_id, agent_name: approval.agent_name, action: approval.action, resource: approval.resource };

  if (approve) {
    approval.status = "approved";
    const filtered = filterAttachments(agent?.role_id ?? "", { action: approval.action, resource: approval.resource, args: approval.args });
    approval.result = runInWorld(filtered.call, { from: `${approval.agent_name}@agents.ourcompany.com` });
    const stripped = filtered.removed.length ? ` · removed attachments the agent may not read: ${filtered.removed.join(", ")}` : "";
    audit({ ...base, event: "Owner approved", decision: "approved", reason: `Owner approved; gateway executed with injected credential${stripped}` });
  } else {
    approval.status = "rejected";
    if (agent) await onDenied(env, agent, TRUST_PENALTY.rejected_approval, approval.run_id);
    audit({ ...base, event: "Owner rejected", decision: "rejected", reason: "Owner rejected the request; nothing was sent" });
  }
  return { approval, agent: agent ? { trust: agent.trust, quarantined: agent.quarantined, revoked: agent.revoked } : undefined };
}
