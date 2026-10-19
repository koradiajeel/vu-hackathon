import { base64ToBytes, bytesToHex, solveWithSteps, type Challenge } from "../shared/challenge";
import type { CatalogTable, ConnectResponse, QueryResponse, TraceStep } from "../shared/types";
import type { AgentModel } from "../models";

export type ClientOptions = {
  /** Where the gateway is mounted, e.g. "https://data-gateway.company.in/api/agentwarden". */
  gatewayUrl: string;
  agentId: string;
  /** The agent's secret. Leave empty for an agent that was never registered. */
  agentSecret?: string;
  /** The AI model that powers this agent. */
  model: AgentModel;
  /** Custom fetch (for tests or in-process use). */
  fetch?: (req: Request) => Promise<Response>;
};

export type ConnectResult =
  | ({ ok: true; trace: TraceStep[]; solved_in_seconds: number } & ConnectResponse)
  | { ok: false; reason: string; trace: TraceStep[] };

export type AskResult = QueryResponse & { agent_trace: TraceStep[] };

/**
 * The agent's side. connect() solves the identity puzzle with the agent's own model and gets an
 * access ID; ask() turns a plain-English question into SQL with the same model and sends both to
 * the gateway, which decides whether it runs.
 */
export class AgentWardenClient {
  private token: string | null = null;
  private expiresAt = 0;
  private catalog: CatalogTable[] | null = null;

  constructor(private opts: ClientOptions) {}

  get connected() {
    return Boolean(this.token) && Date.now() < this.expiresAt;
  }

  private async call(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}) {
    const url = `${this.opts.gatewayUrl.replace(/\/$/, "")}${path}`;
    const req = new Request(url, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: { "content-type": "application/json", ...(init.auth && this.token ? { authorization: `Bearer ${this.token}` } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    const res = await (this.opts.fetch ?? fetch)(req);
    const body = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, body: body as any };
  }

  async connect(): Promise<ConnectResult> {
    const trace: TraceStep[] = [];
    const model = this.opts.model;

    const ch = await this.call("/challenge", { body: { agent_id: this.opts.agentId } });
    if (!ch.ok) {
      trace.push({ layer: "identity", status: "blocked", title: "Gateway refused to give a puzzle", detail: ch.body.message ?? ch.body.error ?? `HTTP ${ch.status}` });
      return { ok: false, reason: ch.body.message ?? "refused", trace };
    }
    const challenge = ch.body as Challenge & { time_limit_seconds: number };
    trace.push({
      layer: "identity",
      status: "info",
      title: `Puzzle received (${challenge.time_limit_seconds}s limit)`,
      detail: "256 random bytes plus instructions in randomly varied wording",
      data: {
        instructions: challenge.instructions,
        time_limit_seconds: challenge.time_limit_seconds,
        bytes_hex: bytesToHex(base64ToBytes(challenge.data_b64)),
        nonce: challenge.nonce,
      },
    });

    const started = performance.now();
    let solution: { answer: string; hmac: string };
    try {
      const steps = await model.parsePuzzle(challenge.instructions);
      solution = await solveWithSteps(challenge, steps);
      trace.push({
        layer: "agent",
        status: "ok",
        title: `${model.label} read the puzzle`,
        detail: `Turned the wording into ${steps.length} byte steps, ran them, hashed the result (SHA-256) and stamped it with the nonce (HMAC)`,
        ms: Math.round(performance.now() - started),
        data: { steps, answer: solution.answer, hmac: solution.hmac },
      });
    } catch (e) {
      trace.push({ layer: "agent", status: "blocked", title: `${model.label} could not solve the puzzle`, detail: (e as Error).message, ms: Math.round(performance.now() - started) });
      return { ok: false, reason: `Puzzle not solved: ${(e as Error).message}`, trace };
    }

    const v = await this.call("/verify", {
      body: { challenge_id: challenge.challenge_id, agent_id: this.opts.agentId, agent_secret: this.opts.agentSecret ?? "", ...solution },
    });
    if (!v.ok) {
      trace.push({ layer: "identity", status: "blocked", title: "Gateway rejected the answer", detail: v.body.message ?? `HTTP ${v.status}` });
      return { ok: false, reason: v.body.message ?? "rejected", trace };
    }
    const conn = v.body as ConnectResponse & { solved_in_seconds: number };
    this.token = conn.access_token;
    this.expiresAt = Date.parse(conn.expires_at);
    this.catalog = null;
    trace.push({
      layer: "identity",
      status: "ok",
      title: `Access ID issued (solved in ${conn.solved_in_seconds}s)`,
      detail: `${conn.department} department · valid until ${new Date(conn.expires_at).toLocaleTimeString("en-IN")}`,
      data: { access_id: conn.access_id, scopes: conn.scopes },
    });
    return { ok: true, trace, ...conn };
  }

  /** Tables this agent may see (its model only learns about these). */
  async getCatalog(): Promise<CatalogTable[]> {
    if (this.catalog) return this.catalog;
    const r = await this.call("/catalog", { auth: true });
    if (!r.ok) throw new Error(r.body.message ?? `catalog: HTTP ${r.status}`);
    this.catalog = r.body.tables as CatalogTable[];
    return this.catalog;
  }

  async ask(question: string): Promise<AskResult> {
    const agentTrace: TraceStep[] = [];
    let sql = "";
    if (this.connected) {
      try {
        const catalog = await this.getCatalog();
        const t = performance.now();
        sql = await this.opts.model.writeSql(question, catalog);
        agentTrace.push({ layer: "agent", status: "info", title: `${this.opts.model.label} wrote SQL`, detail: sql, ms: Math.round(performance.now() - t) });
      } catch (e) {
        agentTrace.push({ layer: "agent", status: "error", title: `${this.opts.model.label} could not write SQL`, detail: (e as Error).message });
      }
    }
    const r = await this.call("/query", { body: { question, sql }, auth: true });
    return { ...(r.body as QueryResponse), agent_trace: agentTrace };
  }
}
