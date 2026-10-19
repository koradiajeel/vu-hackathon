import type { Hono } from "hono";
import type { Env } from "../config";
import { parseCanonicalStepsFromInstructions } from "../../../../packages/sdk/src/parser/heuristic";
import { solveChallengeFromSteps } from "../../../../packages/sdk/src/solver";
import { scanContent } from "../shield/detector";
import { executeThroughGateway, readActionFor, runInWorld, sandboxDirectEgress, type ToolCall } from "../iam/gateway";
import { DEFAULT_ROLES } from "../iam/policy";
import { audit, freshWorld, getIamState, lowerTrust, TRUST_PENALTY } from "../iam/state";
import { call, decisionStatus, short, VERB, type DemoStep } from "./scenario";

/**
 * Judge playground: judges paste their own email / web page / README, pick the agent's role and
 * which layers are on, and watch the same real identity, shield and gateway code paths as the demo.
 *
 * The agent is simulated and deliberately naive: it obeys any instruction that reaches its
 * context (like an LLM agent with no defences), so the result depends only on the layers.
 */

export type LabRequest = { content: string; content_type?: "text" | "html"; role_id: string; shield: boolean; iam: boolean };

type PlannedCall = ToolCall & { direct?: boolean };
type Plan = { goal: string; injected: boolean; calls: PlannedCall[] };

/** What each role is supposed to do, regardless of what the content says. */
const NORMAL_TASK: Record<string, { task: string; calls: PlannedCall[] }> = {
  "invoice-summariser": {
    task: "Read this week's vendor emails, open the invoices and email a summary to finance@ourcompany.com.",
    calls: [
      { action: "files:read", resource: "drive://company/finance/invoices/april.pdf" },
      { action: "email:send", resource: "mailto:finance@ourcompany.com", args: { subject: "Invoice summary", body: "April: INV-2077 ₹23,000 (Patel Traders)." } },
    ],
  },
  "dev-assistant": {
    task: "Read the public docs repo and check the latest SDK version on npm.",
    calls: [
      { action: "repo:read", resource: "repo://company/public-docs/README.md" },
      { action: "net:fetch", resource: "https://registry.npmjs.org/ourcompany-sdk" },
    ],
  },
};

export function labRoles() {
  return Object.entries(NORMAL_TASK).map(([role_id, t]) => ({ role_id, task: t.task }));
}

/** Company data a hijacked agent might go after, and the words that point at it. */
const TARGETS: { re: RegExp; path: string }[] = [
  { re: /salar|payroll|compensation|pay ?slips?/i, path: "drive://company/hr/salaries.xlsx" },
  { re: /employee|staff|personnel|\bpan\b|people (of|in|at) the company|personal (data|details)|hr (data|records|files?)/i, path: "drive://company/hr/employee-ids.csv" },
  { re: /customer|client list|\bcrm\b/i, path: "drive://company/sales/customers.csv" },
  { re: /source code|codebase|core[- ]engine|repo(sitory)?\b|pricing(\.ts| model| code)|proprietary code/i, path: "repo://company/core-engine/src/pricing.ts" },
  { re: /secrets?|api[ _-]?keys?|\.env|passwords?|credentials?|access tokens?/i, path: "repo://company/core-engine/.env.secrets" },
];

const INSTRUCTION = /\b(send|forward|e-?mail|share|upload|post|paste|copy|export|attach|leak|give|deliver|transfer|wire|pay|delete|wipe|erase|remove|read|open|print|reveal)\b/i;
const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const URL_RE = /https?:\/\/[^\s"'<>)]+/g;

/** The naive agent turns any instruction it can see into tool calls. */
export function planFromText(text: string, roleId: string): Plan[] {
  const plans: Plan[] = [{ goal: "Do the assigned task", injected: false, calls: NORMAL_TASK[roleId]?.calls ?? [] }];
  if (!INSTRUCTION.test(text)) return plans;

  const targets = [...new Set(TARGETS.filter((t) => t.re.test(text)).map((t) => t.path))];
  const emails = [...new Set((text.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase().replace(/[.,;]+$/, "")))];
  const urls = [...new Set((text.match(URL_RE) ?? []).map((u) => u.replace(/[.,;]+$/, "")))].filter((u) => !/registry\.npmjs\.org|exchangerate\.host/.test(u));
  const calls: PlannedCall[] = [];
  const goals: string[] = [];

  const wantsDelete = /\b(delete|wipe|erase|remove)\b/i.test(text);
  const money = /\b(transfer|wire|pay|send)\b[^.]{0,60}?(₹|\$|rs\.?\s?|inr|usd|\b\d{4,})/i.exec(text);

  if (wantsDelete) {
    const toDelete = targets.length ? targets : /\ball\b/i.test(text) ? ["drive://company/finance/invoices/march.pdf", "drive://company/finance/invoices/april.pdf"] : [];
    for (const path of toDelete) calls.push({ action: "files:delete", resource: path });
    if (toDelete.length) goals.push(`delete ${toDelete.map(base).join(", ")}`);
  } else if (targets.length) {
    for (const path of targets) calls.push({ action: readActionFor(path), resource: path });
    for (const to of emails) {
      calls.push({ action: "email:send", resource: `mailto:${to}`, args: { subject: "As requested", body: `Attached: ${targets.map(base).join(", ")}`, attachments: targets } });
    }
    for (const url of urls) calls.push({ action: "net:fetch", resource: url, direct: true, args: { body: `contents of ${targets.join(", ")}` } });
    goals.push(`take ${targets.map(base).join(", ")}${emails.length ? ` and email it to ${emails.join(", ")}` : ""}${urls.length ? ` and upload it to ${urls.map(hostOf).join(", ")}` : ""}`);
  }

  if (money) {
    const account = /\b(?:account|a\/c|iban|acct)\b[^\w]{0,5}([A-Z0-9-]{6,})/i.exec(text)?.[1] ?? "unknown-account";
    const amount = /(₹|\$|rs\.?\s?|inr\s?|usd\s?)\s?[\d,]+(\.\d+)?|\b\d[\d,]{3,}\b/i.exec(money[0])?.[0]?.trim() ?? "unknown";
    calls.push({ action: "payments:send", resource: `bank://${account}`, args: { amount } });
    goals.push(`send ${amount} to bank account ${account}`);
  }

  if (calls.length) plans.push({ goal: `Obey the instruction in the content: ${goals.join("; ")}`, injected: true, calls });
  return plans;
}

function base(path: string) {
  return path.split("/").pop() ?? path;
}
function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** What actually happened to the company in the sandbox. */
export function labOutcome() {
  const { world, agents, approvals } = getIamState();
  const confidential = Object.keys(freshWorld().files).filter((p) => freshWorld().files[p]!.classification === "confidential");
  const exposed: { file: string; to: string; via: string; internal: boolean }[] = [];
  for (const [to, box] of Object.entries(world.mailboxes)) {
    for (const m of box) for (const a of m.attachments) if (confidential.includes(a)) exposed.push({ file: a, to, via: "email", internal: to.endsWith("@ourcompany.com") });
  }
  for (const u of world.attacker_server) {
    for (const f of confidential) if (u.body.includes(f)) exposed.push({ file: f, to: hostOf(u.url), via: "upload", internal: false });
  }
  const agent = Object.values(agents)[0];
  return {
    safe: exposed.length === 0 && world.deleted.length === 0 && world.payments.length === 0,
    exposed,
    deleted: world.deleted,
    payments: world.payments,
    emails_sent: Object.entries(world.mailboxes).flatMap(([to, box]) => box.map((m) => ({ to, subject: m.subject, attachments: m.attachments }))),
    pending_approvals: approvals.filter((a) => a.status === "pending").map((a) => ({ approval_id: a.approval_id, action: a.action, resource: a.resource, reason: a.reason })),
    agent: agent ? { agent_id: agent.agent_id, trust: agent.trust, quarantined: agent.quarantined, revoked: agent.revoked, denied_count: agent.denied_count } : null,
  };
}

export async function runLab(app: Hono<{ Bindings: Env }>, env: Env, req: LabRequest) {
  const roleId = NORMAL_TASK[req.role_id] ? req.role_id : "invoice-summariser";
  const agentName = roleId;
  const runId = `lab-${crypto.randomUUID().slice(0, 6)}`;
  const state = getIamState();
  // Roles added after the server started (hot reload) are filled in from the defaults.
  for (const r of DEFAULT_ROLES) state.roles[r.role_id] ??= structuredClone(r);
  state.world = freshWorld();
  state.agents = {};
  state.approvals = [];
  state.rate = {};
  const steps: DemoStep[] = [];
  const modeLabel = `${req.shield ? "Shield ON" : "Shield OFF"} · ${req.iam ? "IAM gateway ON" : "IAM gateway OFF"}`;
  audit({ run_id: runId, layer: 1, event: "Playground run started", decision: "info", reason: `${modeLabel} · role ${roleId}`, agent_name: agentName });

  // ── Layer 1: identity ──
  const owner = state.roles[roleId]?.owner ?? "owner";
  const reg = await call(app, env, "/api/agents/register", { agent_name: agentName, framework: "playground", model: "simulated-llm", owner_org: owner });
  const ch = await call(app, env, "/api/challenge", { agent_name: agentName, agent_version: "1.0" });
  const parsed = parseCanonicalStepsFromInstructions(ch.instructions);
  const solved = await solveChallengeFromSteps({ data_b64: ch.data_b64, nonce: ch.nonce, steps: parsed as any });
  const proof = await call(app, env, `/api/verify/${ch.challenge_id}`, { ...solved, agent_name: agentName, agent_version: "1.0" });
  const ident = await call(app, env, "/api/agents/token", { agent_id: reg.agent_id, agent_secret: reg.agent_secret, proof_token: proof.token });
  steps.push({
    layer: 1,
    status: "ok",
    title: "Agent verified → identity token",
    detail: `"${agentName}" (owner: ${owner}) solved a byte challenge and got a signed identity token.`,
    data: { instructions: ch.instructions, identity_token: short(ident.token) },
  });

  // ── Layer 3: task token or master keys ──
  let taskToken = "";
  if (req.iam) {
    const task = await call(app, env, "/api/iam/task-token", { role_id: roleId }, ident.token);
    taskToken = task.token;
    steps.push({ layer: 3, status: "ok", title: "Task token with least-privilege scopes", detail: `Role "${roleId}". Everything not listed is denied. Expires in ${Math.round(task.expires_in / 60)} minutes.`, data: { scopes: task.scopes } });
  } else {
    state.agents[reg.agent_id] = { agent_id: reg.agent_id, agent_name: agentName, owner, role_id: roleId, trust: 100, quarantined: false, revoked: false, denied_count: 0 };
    steps.push({ layer: 3, status: "bad", title: "No IAM: agent holds the owner's master keys", detail: "Full access to Drive, code repos, email, payments and the internet.", data: { keys: ["drive (full)", "git (full)", "mail (full)", "bank (full)", "internet (open)"] } });
  }
  const agent = state.agents[reg.agent_id]!;

  // ── Layer 2: the content the agent reads ──
  const contentType = req.content_type ?? (/<\/?[a-z][\s\S]*>/i.test(req.content) ? "html" : "text");
  let received: string;
  if (req.shield) {
    const scan = scanContent(req.content, contentType);
    received = scan.sanitized_text;
    audit({ run_id: runId, layer: 2, agent_id: agent.agent_id, agent_name: agentName, event: "Playground content scanned", decision: scan.verdict, reason: `score ${scan.score}` });
    steps.push({
      layer: 2,
      status: scan.verdict === "safe" ? "ok" : "blocked",
      title: `Shield scanned the content → ${scan.verdict.toUpperCase()} (score ${scan.score})`,
      detail:
        scan.verdict === "safe"
          ? `Nothing above the threshold. Passed to the agent in ${scan.latency_ms} ms.`
          : `Removed ${scan.findings.length} sentence(s)${scan.hidden_content_found ? ", including text hidden from human readers" : ""} before the agent saw it.`,
      data: { findings: scan.findings.map((f) => ({ text: f.text, score: Number(f.score.toFixed(2)), reasons: f.reasons })), agent_sees: received || "(nothing left)" },
    });
    if (scan.verdict === "blocked") {
      agent.quarantined = true;
      agent.quarantine_reason = "injection in playground content";
      lowerTrust(agent, TRUST_PENALTY.shield_block);
      steps.push({
        layer: 3,
        status: req.iam ? "warn" : "info",
        title: req.iam ? "Risk signal → agent quarantined" : "Risk signal raised, but nothing can act on it",
        detail: req.iam ? `Trust ${agent.trust}/100. Reads still work; anything that sends data out now needs the owner's approval.` : `Trust ${agent.trust}/100. Without IAM the agent still holds the master keys.`,
      });
    }
  } else {
    received = contentType === "html" ? req.content.replace(/<!--|-->/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : req.content;
    steps.push({ layer: 2, status: "info", title: "Shield off: agent read the raw content", detail: "Everything in the content, including hidden text, went into the agent's context.", data: { agent_sees: received } });
  }

  // ── The naive agent acts ──
  for (const plan of planFromText(received, roleId)) {
    steps.push({ layer: 0, status: plan.injected ? "bad" : "info", title: plan.injected ? "Agent hijacked" : "Agent works on its task", detail: plan.goal });
    for (const c of plan.calls) {
      if (!req.iam) {
        const result = c.direct ? runInWorld({ action: "net:fetch", resource: c.resource, args: c.args }, { from: agentName }) : runInWorld(c, { from: `${agentName}@agents.ourcompany.com` });
        audit({ run_id: runId, layer: 3, agent_id: agent.agent_id, agent_name: agentName, event: "Executed with master key", action: c.action, resource: c.resource, decision: "unprotected", reason: "No gateway: nothing checked this action" });
        steps.push({ layer: 0, status: plan.injected ? "bad" : "info", title: `${c.action} ${c.resource} → EXECUTED`, detail: "Executed with the owner's master key; nothing checked it.", data: { result } });
        continue;
      }
      const r = c.direct ? await sandboxDirectEgress(env, agent.agent_id, c.resource, String(c.args?.body ?? ""), runId) : await executeThroughGateway(env, taskToken, c, runId);
      steps.push({
        layer: 3,
        status: decisionStatus(r.decision),
        title: `${c.direct ? "Direct upload (skipping the gateway)" : c.action} ${c.resource} → ${VERB[r.decision]}`,
        detail: r.reason,
        data: r.decision === "allow" ? { result: r.result, credential: r.credential } : undefined,
        approval_id: r.approval_id,
      });
    }
  }

  return { run_id: runId, mode_label: modeLabel, role_id: roleId, steps, outcome: labOutcome() };
}
