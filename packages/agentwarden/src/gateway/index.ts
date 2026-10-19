import type { CatalogTable, ConnectResponse, QueryResponse, TraceStep } from "../shared/types";
import { catalogFor, readCatalog, syncDatabaseRoles, type Database } from "./database";
import { IdentityError, IdentityService } from "./identity";
import { roleFor, type AgentConfig } from "./policy";
import { scoreRequest } from "./risk";
import { dockerSandbox, localSandbox, type Sandbox } from "./sandbox";
import { checkSql } from "./sqlguard";

export * from "./database";
export * from "./policy";
export { scoreRequest } from "./risk";
export { checkSql } from "./sqlguard";
export { localSandbox, dockerSandbox, dockerRunFlags, SANDBOX_LABEL, type Sandbox, type DockerSandboxOptions } from "./sandbox";

export type GatewayOptions = {
  /** The company database (admin connection). See pgliteDatabase() and postgresDatabase(). */
  database: Database;
  /** Agents registered with a department, each with its own policy. */
  agents: AgentConfig[];
  /** Secret used to sign access IDs. Defaults to a random value (access IDs then die on restart). */
  jwtSecret?: string;
  /** Seconds an agent has to solve the identity puzzle. Default 30. */
  challengeTtlSeconds?: number;
  /** Lifetime of an access ID. Default 900 (15 minutes). */
  tokenTtlSeconds?: number;
  /** Where approved SQL runs. Default: local sandbox (read-only transaction as the agent's role). */
  sandbox?: "local" | { type: "docker"; dbHost: string; dbPort?: number; dbName: string; network?: string; image?: string };
  /** URL prefix the gateway is mounted under, e.g. "/api/agentwarden". */
  basePath?: string;
};

export type AuditEntry = {
  id: string;
  ts: string;
  agent_id: string;
  department?: string;
  event: "puzzle" | "connect" | "query" | "register";
  decision: "allowed" | "blocked" | "error";
  stopped_at?: string;
  reason: string;
  question?: string;
  sql?: string;
  risk_score?: number;
  rows?: number;
};

export type Gateway = {
  /** Standard fetch handler: (Request) => Response. Mount it in any framework. */
  fetch(req: Request): Promise<Response>;
  ready: Promise<void>;
  audit(): AuditEntry[];
  catalog(): CatalogTable[];
  agents(): AgentConfig[];
  /** Registers a new agent with a department while running: gives it a database role and lets it ask for puzzles. */
  registerAgent(agent: AgentConfig): Promise<void>;
  sandbox(): Sandbox;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export function createGateway(opts: GatewayOptions): Gateway {
  const db = opts.database;
  const agentList = [...opts.agents];
  const agents = new Map(agentList.map((a) => [a.id, a]));
  const identity = new IdentityService(agents, {
    jwtSecret: opts.jwtSecret ?? crypto.randomUUID() + crypto.randomUUID(),
    challengeTtlSeconds: opts.challengeTtlSeconds ?? 30,
    tokenTtlSeconds: opts.tokenTtlSeconds ?? 900,
    challengesPerMinute: 20,
  });
  const rolePasswords = new Map<string, string>();
  let catalog: CatalogTable[] = [];
  const auditLog: AuditEntry[] = [];

  let sandbox: Sandbox;
  if (!opts.sandbox || opts.sandbox === "local") sandbox = localSandbox(db);
  else {
    if (db.kind !== "postgres") throw new Error("The Docker sandbox needs a real PostgreSQL server (postgresDatabase), not the embedded one.");
    sandbox = dockerSandbox({ ...opts.sandbox, rolePassword: (role) => rolePasswords.get(role) ?? "" });
  }

  const ready = (async () => {
    await identity.init();
    await db.exec(`CREATE SCHEMA IF NOT EXISTS agentwarden;
      CREATE TABLE IF NOT EXISTS agentwarden.audit (
        id uuid PRIMARY KEY, ts timestamptz NOT NULL, agent_id text NOT NULL, department text, event text NOT NULL,
        decision text NOT NULL, stopped_at text, reason text NOT NULL, question text, sql text, risk_score numeric, rows int)`);
    catalog = await readCatalog(db);
    await syncDatabaseRoles(db, agentList, catalog);
    for (const a of agentList) await setLoginPassword(a);
  })();

  /** The Docker sandbox logs in as each agent's role, so those roles need a password. */
  async function setLoginPassword(a: AgentConfig) {
    if (sandbox.kind !== "docker") return;
    const role = roleFor(a.id);
    const pw = crypto.randomUUID().replace(/-/g, "");
    rolePasswords.set(role, pw);
    await db.exec(`ALTER ROLE "${role}" LOGIN PASSWORD '${pw}'`);
  }

  async function registerAgent(agent: AgentConfig) {
    await ready;
    if (agents.has(agent.id)) throw new Error(`Agent "${agent.id}" is already registered.`);
    await syncDatabaseRoles(db, [agent], catalog);
    await setLoginPassword(agent);
    await identity.addAgent(agent);
    agentList.push(agent);
    await record({ agent_id: agent.id, department: agent.department, event: "register", decision: "allowed", reason: `Registered with the ${agent.department} department` });
  }

  async function record(entry: Omit<AuditEntry, "id" | "ts">) {
    const full: AuditEntry = { id: crypto.randomUUID(), ts: new Date().toISOString(), ...entry };
    auditLog.unshift(full);
    if (auditLog.length > 500) auditLog.length = 500;
    await db
      .query(
        `INSERT INTO agentwarden.audit (id, ts, agent_id, department, event, decision, stopped_at, reason, question, sql, risk_score, rows)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [full.id, full.ts, full.agent_id, full.department ?? null, full.event, full.decision, full.stopped_at ?? null, full.reason, full.question ?? null, full.sql ?? null, full.risk_score ?? null, full.rows ?? null]
      )
      .catch(() => {});
    return full;
  }

  async function bearer(req: Request) {
    const h = req.headers.get("authorization") ?? "";
    if (!h.startsWith("Bearer ")) throw new IdentityError(401, "missing_access_id", "No access ID. Solve the puzzle first.");
    return identity.verifyToken(h.slice(7).trim());
  }

  /** Steps 2 and 3: score the request, check the SQL, run it in the sandbox. */
  async function handleQuery(req: Request): Promise<Response> {
    const trace: TraceStep[] = [];
    let auth: Awaited<ReturnType<typeof bearer>>;
    try {
      auth = await bearer(req);
    } catch (e) {
      const err = e as IdentityError;
      const entry = await record({ agent_id: "unknown", event: "query", decision: "blocked", stopped_at: "identity", reason: err.message });
      const body: QueryResponse = { decision: "blocked", stopped_at: "identity", reason: err.message, trace: [{ layer: "identity", status: "blocked", title: "Access ID check failed", detail: err.message }], audit_id: entry.id };
      return json(body, err.status);
    }
    const { agent, claims } = auth;
    trace.push({ layer: "identity", status: "ok", title: "Access ID valid", detail: `${agent.name} (${agent.department}) · access ID ${claims.jti.slice(0, 8)}… · expires ${new Date(claims.exp * 1000).toLocaleTimeString("en-IN")}` });

    const body = (await req.json().catch(() => null)) as null | { question?: string; sql?: string };
    const question = String(body?.question ?? "").slice(0, 2000);
    const sql = String(body?.sql ?? "").slice(0, 10_000);
    const base = { agent_id: agent.id, department: agent.department, event: "query" as const, question, sql };
    const finish = async (res: Omit<QueryResponse, "trace" | "audit_id">, status = 200) => {
      const entry = await record({ ...base, decision: res.decision, stopped_at: res.stopped_at, reason: res.reason, risk_score: res.risk?.score, rows: res.row_count });
      return json({ ...res, sql_submitted: sql, trace, audit_id: entry.id } satisfies QueryResponse, status);
    };

    // Step 2a: how risky is the plain-English request?
    const t0 = performance.now();
    const risk = scoreRequest(question);
    const riskMs = Number((performance.now() - t0).toFixed(2));
    if (risk.verdict === "blocked") {
      trace.push({ layer: "request", status: "blocked", title: `Request risk ${risk.score} → BLOCKED`, detail: risk.reasons.join(" · ") || "High risk", ms: riskMs, data: { score: risk.score } });
      return finish({ decision: "blocked", stopped_at: "request", reason: `Request blocked (risk ${risk.score}): ${risk.reasons[0] ?? "high risk"}`, risk }, 403);
    }
    trace.push({
      layer: "request",
      status: risk.verdict === "safe" ? "ok" : "warn",
      title: `Request risk ${risk.score} → ${risk.verdict.toUpperCase()}`,
      detail: risk.reasons.length ? risk.reasons.join(" · ") : "No signs of misuse",
      ms: riskMs,
      data: { score: risk.score },
    });

    // Step 2b + 3a: is the SQL safe, and allowed for this agent?
    const check = checkSql(sql, agent, catalog);
    if (!check.ok) {
      const layer = check.failed === "policy" ? "policy" : "sql";
      if (layer === "policy") trace.push({ layer: "sql", status: "ok", title: "SQL is a single read-only query", detail: check.findings.join(" · ") });
      trace.push({ layer, status: "blocked", title: layer === "policy" ? "Permission check → DENIED" : "SQL check → REJECTED", detail: check.reason, data: { tables: check.tables } });
      return finish({ decision: "blocked", stopped_at: layer, reason: check.reason, risk }, 403);
    }
    trace.push({ layer: "sql", status: "ok", title: "SQL check passed", detail: check.findings.slice(0, 1).concat(check.findings.slice(-1)).join(" · ") });
    trace.push({ layer: "policy", status: "ok", title: "Permission check passed", detail: `${check.tables.join(", ")} allowed for ${agent.department}`, data: { tables: check.tables } });

    // Step 3b: run it in the sandbox as the agent's own database role.
    const role = roleFor(agent.id);
    const t1 = performance.now();
    try {
      const result = await sandbox.run(check.rewritten!, role);
      const ms = Number((performance.now() - t1).toFixed(1));
      trace.push({ layer: "sandbox", status: "ok", title: `Ran in ${sandbox.kind} sandbox → ${result.rows.length} row(s)`, detail: sandbox.limits().join(" · "), ms });
      return finish({ decision: "allowed", reason: "All checks passed", risk, sql_executed: check.rewritten, columns: result.columns, rows: result.rows, row_count: result.rows.length });
    } catch (e) {
      const msg = (e as Error).message;
      const dbDenied = /permission denied|read-only transaction/i.test(msg);
      trace.push({
        layer: "sandbox",
        status: "blocked",
        title: dbDenied ? "Database refused the query" : "Query failed in the sandbox",
        detail: dbDenied ? `PostgreSQL said: "${msg}". The database's own permissions stopped it.` : msg,
      });
      return finish({ decision: dbDenied ? "blocked" : "error", stopped_at: "sandbox", reason: msg, risk, sql_executed: check.rewritten }, dbDenied ? 403 : 400);
    }
  }

  const base = (opts.basePath ?? "").replace(/\/$/, "");

  async function handle(req: Request): Promise<Response> {
    await ready;
    const path = new URL(req.url).pathname.slice(base.length) || "/";
    try {
      if (req.method === "GET" && path === "/health") return json({ ok: true, sandbox: sandbox.kind, database: db.kind });

      if (req.method === "POST" && path === "/challenge") {
        const body = (await req.json().catch(() => null)) as null | { agent_id?: string };
        const agentId = String(body?.agent_id ?? "");
        try {
          const challenge = identity.issueChallenge(agentId);
          return json({ ...challenge, time_limit_seconds: opts.challengeTtlSeconds ?? 30 });
        } catch (e) {
          const err = e as IdentityError;
          await record({ agent_id: agentId || "unknown", event: "puzzle", decision: "blocked", stopped_at: "identity", reason: err.message });
          throw e;
        }
      }

      if (req.method === "POST" && path === "/verify") {
        const body = (await req.json().catch(() => ({}))) as any;
        try {
          const r = await identity.verify(body);
          await record({ agent_id: r.agent.id, department: r.agent.department, event: "connect", decision: "allowed", reason: `Puzzle solved in ${r.elapsed.toFixed(1)}s` });
          const out: ConnectResponse = { access_token: r.token, access_id: r.jti, agent_id: r.agent.id, department: r.agent.department, expires_at: new Date(r.exp * 1000).toISOString(), scopes: r.scopes };
          return json({ ...out, solved_in_seconds: Number(r.elapsed.toFixed(2)) });
        } catch (e) {
          await record({ agent_id: String(body?.agent_id ?? "unknown"), event: "connect", decision: "blocked", stopped_at: "identity", reason: (e as Error).message });
          throw e;
        }
      }

      if (req.method === "GET" && path === "/catalog") {
        const { agent } = await bearer(req);
        return json({ department: agent.department, tables: catalogFor(agent, catalog) });
      }

      if (req.method === "POST" && path === "/query") return handleQuery(req);

      return json({ error: "not_found" }, 404);
    } catch (e) {
      if (e instanceof IdentityError) return json({ error: e.code, message: e.message }, e.status);
      return json({ error: "internal_error", message: (e as Error).message }, 500);
    }
  }

  return {
    fetch: handle,
    ready,
    audit: () => auditLog,
    catalog: () => catalog,
    agents: () => agentList,
    registerAgent,
    sandbox: () => sandbox,
  };
}
