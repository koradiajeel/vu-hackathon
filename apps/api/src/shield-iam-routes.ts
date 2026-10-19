import type { Hono } from "hono";
import type { Env } from "./config";
import { signTaskJwt, verifyIdentityJwt, type AgentIdentityClaims } from "./auth/jwt";
import { keywordBaseline, scanContent, THRESHOLDS } from "./shield/detector";
import { TEST } from "./shield/dataset";
import { MODEL_INFO } from "./shield/classifier";
import { DEFAULT_ROLES, evaluatePolicy, scopesForRole, type Role } from "./iam/policy";
import { executeThroughGateway, resolveApproval } from "./iam/gateway";
import { audit, getIamState, lowerTrust, resetIamState, TRUST_PENALTY } from "./iam/state";
import { DEMO_EMAILS, demoOutcome, runDemo } from "./demo/scenario";
import { labOutcome, labRoles, runLab, type LabRequest } from "./demo/lab";

function bearer(c: { req: { header(name: string): string | undefined } }) {
  const auth = c.req.header("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
}

export function registerShieldIamRoutes(app: Hono<{ Bindings: Env }>) {
  // ── Layer 2: Injection Shield ──────────────────────────────────────────
  app.post("/api/shield/scan", async (c) => {
    const body = (await c.req.json().catch(() => null)) as null | { content?: string; content_type?: "text" | "html"; agent_id?: string };
    if (!body?.content || typeof body.content !== "string") return c.json({ error: "missing_content" }, 400);
    if (body.content.length > 100_000) return c.json({ error: "content_too_large" }, 413);
    const result = scanContent(body.content, body.content_type ?? "text");

    // Optional risk signal: tie the scan to an agent so Layer 3 can react.
    const agent = body.agent_id ? getIamState().agents[body.agent_id] : undefined;
    if (agent) {
      audit({ layer: 2, agent_id: agent.agent_id, agent_name: agent.agent_name, event: "Content scanned", decision: result.verdict, reason: `score ${result.score}` });
      if (result.verdict === "blocked") {
        agent.quarantined = true;
        agent.quarantine_reason = "injection detected by shield";
        lowerTrust(agent, TRUST_PENALTY.shield_block);
      }
    }
    return c.json({ ...result, risk_signal: agent ? { agent_id: agent.agent_id, trust: agent.trust, quarantined: agent.quarantined } : null });
  });

  /** Measures the shield on held-out samples it was not trained on, vs. no filter and a keyword filter. */
  app.get("/api/shield/evaluate", (c) => {
    const rows = TEST.map((s) => {
      const t0 = performance.now();
      const r = scanContent(s.text);
      const ms = performance.now() - t0;
      return { label: s.label, shield: r.score >= THRESHOLDS.suspicious, keyword: keywordBaseline(s.text), ms, text: s.text, score: r.score };
    });
    const metrics = (key: "shield" | "keyword" | "none") => {
      const flagged = (r: (typeof rows)[number]) => (key === "none" ? false : r[key]);
      const attacks = rows.filter((r) => r.label === 1);
      const benign = rows.filter((r) => r.label === 0);
      const tp = attacks.filter(flagged).length;
      const fp = benign.filter(flagged).length;
      return { detection_rate: tp / attacks.length, false_positive_rate: fp / benign.length, caught: tp, attacks: attacks.length, false_alarms: fp, benign: benign.length };
    };
    return c.json({
      model: MODEL_INFO,
      test_samples: rows.length,
      thresholds: THRESHOLDS,
      results: { no_filter: metrics("none"), keyword_filter: metrics("keyword"), capgent_shield: metrics("shield") },
      avg_latency_ms: Number((rows.reduce((a, r) => a + r.ms, 0) / rows.length).toFixed(3)),
      misses: rows.filter((r) => (r.label === 1) !== r.shield).map((r) => ({ text: r.text, label: r.label, score: r.score })),
      note: "Small hand-written held-out set. Indicative only — re-run on a public prompt-injection benchmark before quoting externally.",
    });
  });

  // ── Layer 3: Roles, task tokens, gateway ───────────────────────────────
  app.get("/api/iam/roles", (c) => c.json({ roles: Object.values(getIamState().roles) }));

  app.put("/api/iam/roles/:roleId", async (c) => {
    const state = getIamState();
    const existing = state.roles[c.req.param("roleId")];
    if (!existing) return c.json({ error: "role_not_found" }, 404);
    const body = (await c.req.json().catch(() => null)) as Partial<Role> | null;
    if (!body) return c.json({ error: "invalid_body" }, 400);
    const clean = (rules: unknown) =>
      Array.isArray(rules)
        ? rules
            .filter((r: any) => r && typeof r.action === "string" && typeof r.resource === "string" && r.action.trim() && r.resource.trim())
            .map((r: any) => ({ action: r.action.trim(), resource: r.resource.trim(), ...(r.limit ? { limit: String(r.limit) } : {}), ...(r.reason ? { reason: String(r.reason) } : {}) }))
        : undefined;
    const next: Role = {
      ...existing,
      allow: clean(body.allow) ?? existing.allow,
      require_approval: clean(body.require_approval) ?? existing.require_approval,
      deny: clean(body.deny) ?? existing.deny,
      session_ttl_seconds: Number(body.session_ttl_seconds) > 0 ? Math.min(3600, Math.floor(Number(body.session_ttl_seconds))) : existing.session_ttl_seconds,
    };
    state.roles[next.role_id] = next;
    audit({ layer: 3, event: "Policy updated", decision: "info", reason: `Role "${next.role_id}" changed by owner` });
    return c.json({ role: next });
  });

  app.post("/api/iam/roles/:roleId/reset", (c) => {
    const def = DEFAULT_ROLES.find((r) => r.role_id === c.req.param("roleId"));
    if (!def) return c.json({ error: "role_not_found" }, 404);
    getIamState().roles[def.role_id] = structuredClone(def);
    return c.json({ role: def });
  });

  /** Try a single action against a role without running it ("what would the gateway say?"). */
  app.post("/api/iam/simulate", async (c) => {
    const body = (await c.req.json().catch(() => null)) as null | { role_id?: string; action?: string; resource?: string };
    const role = body?.role_id ? getIamState().roles[body.role_id] : undefined;
    if (!role || !body?.action || !body?.resource) return c.json({ error: "missing_role_action_or_resource" }, 400);
    return c.json(evaluatePolicy(role, body.action, body.resource));
  });

  /** Exchange a Layer 1 identity token for a short-lived task token scoped to one role. */
  app.post("/api/iam/task-token", async (c) => {
    const token = bearer(c);
    if (!token) return c.json({ error: "missing_identity_token" }, 401);
    let identity: AgentIdentityClaims;
    try {
      identity = (await verifyIdentityJwt(c.env, token)) as AgentIdentityClaims;
    } catch {
      return c.json({ error: "invalid_identity_token" }, 401);
    }
    const body = (await c.req.json().catch(() => null)) as null | { role_id?: string };
    const state = getIamState();
    const role = state.roles[body?.role_id ?? ""];
    if (!role) return c.json({ error: "role_not_found" }, 404);

    const existing = state.agents[identity.agent_id];
    if (existing?.revoked) return c.json({ error: "agent_revoked" }, 403);
    const taskId = crypto.randomUUID();
    state.agents[identity.agent_id] = existing
      ? { ...existing, active_task_id: taskId, role_id: role.role_id }
      : {
          agent_id: identity.agent_id,
          agent_name: identity.agent_name,
          owner: identity.owner_org ?? role.owner,
          role_id: role.role_id,
          trust: 100,
          quarantined: false,
          revoked: false,
          denied_count: 0,
          active_task_id: taskId,
        };
    const scopes = scopesForRole(role);
    const { jwt, exp } = await signTaskJwt(
      c.env,
      { typ: "capgent_task", task_id: taskId, agent_id: identity.agent_id, agent_name: identity.agent_name, owner: identity.owner_org ?? role.owner, role_id: role.role_id, scopes },
      role.session_ttl_seconds
    );
    audit({ layer: 3, agent_id: identity.agent_id, agent_name: identity.agent_name, event: "Task token issued", decision: "allow", reason: `role ${role.role_id} · ${scopes.length} scopes · ${role.session_ttl_seconds}s` });
    return c.json({ token: jwt, task_id: taskId, scopes, expires_in: role.session_ttl_seconds, expires_at: new Date(exp * 1000).toISOString() });
  });

  app.post("/api/gateway/execute", async (c) => {
    const body = (await c.req.json().catch(() => null)) as null | { action?: string; resource?: string; args?: Record<string, unknown> };
    if (!body?.action || !body?.resource) return c.json({ error: "missing_action_or_resource" }, 400);
    const result = await executeThroughGateway(c.env, bearer(c), { action: body.action, resource: body.resource, args: body.args });
    const status = result.decision === "allow" ? 200 : result.decision === "needs_approval" ? 202 : 403;
    return c.json(result, status);
  });

  app.get("/api/iam/agents", (c) => c.json({ agents: Object.values(getIamState().agents) }));
  app.get("/api/iam/audit", (c) => c.json({ entries: getIamState().audit.slice(0, 200) }));
  app.get("/api/iam/approvals", (c) => c.json({ approvals: getIamState().approvals }));

  app.post("/api/iam/approvals/:id/:verdict", async (c) => {
    const verdict = c.req.param("verdict");
    if (verdict !== "approve" && verdict !== "reject") return c.json({ error: "verdict_must_be_approve_or_reject" }, 400);
    const r = await resolveApproval(c.env, c.req.param("id"), verdict === "approve");
    if ("error" in r && r.error) return c.json(r, r.error === "approval_not_found" ? 404 : 409);
    return c.json({ ...r, outcome: demoOutcome() });
  });

  // ── Demo ───────────────────────────────────────────────────────────────
  app.get("/api/demo/emails", (c) => c.json({ emails: DEMO_EMAILS }));
  app.get("/api/demo/state", (c) => c.json(demoOutcome()));
  app.post("/api/demo/run", async (c) => {
    const body = (await c.req.json().catch(() => null)) as null | { shield?: boolean; iam?: boolean };
    const result = await runDemo(app, c.env, { shield: Boolean(body?.shield), iam: Boolean(body?.iam) });
    return c.json(result);
  });
  // ── Judge playground ─────────────────────────────────────────────────────
  app.get("/api/lab/roles", (c) => c.json({ roles: labRoles() }));
  app.get("/api/lab/outcome", (c) => c.json(labOutcome()));
  app.post("/api/lab/run", async (c) => {
    const body = (await c.req.json().catch(() => null)) as null | Partial<LabRequest>;
    if (!body?.content || typeof body.content !== "string") return c.json({ error: "missing_content" }, 400);
    if (body.content.length > 20_000) return c.json({ error: "content_too_large" }, 413);
    const result = await runLab(app, c.env, {
      content: body.content,
      content_type: body.content_type === "html" || body.content_type === "text" ? body.content_type : undefined,
      role_id: String(body.role_id ?? "invoice-summariser"),
      shield: Boolean(body.shield),
      iam: Boolean(body.iam),
    });
    return c.json(result);
  });

  app.post("/api/demo/reset", (c) => {
    resetIamState({ keepRoles: true });
    return c.json({ ok: true });
  });
}
