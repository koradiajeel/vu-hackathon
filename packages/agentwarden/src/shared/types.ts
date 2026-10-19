/** Types shared by the agent client and the gateway. */

export type Layer = "identity" | "request" | "sql" | "policy" | "sandbox" | "agent";
export type StepStatus = "ok" | "info" | "warn" | "blocked" | "error";

/** One line in the trace the gateway and client return, so every decision is explainable. */
export type TraceStep = {
  layer: Layer;
  status: StepStatus;
  title: string;
  detail: string;
  data?: Record<string, unknown>;
  ms?: number;
};

export type CatalogTable = {
  table: string;
  columns: string[];
  description?: string;
  /** For short category columns (e.g. department, status): the values that exist, so AI models don't guess. */
  values?: Record<string, string[]>;
};

export type QueryResponse = {
  decision: "allowed" | "blocked" | "error";
  /** Which check stopped the request, if any. */
  stopped_at?: Layer;
  reason: string;
  risk?: { score: number; verdict: "safe" | "suspicious" | "blocked"; reasons: string[] };
  sql_submitted?: string;
  sql_executed?: string;
  columns?: string[];
  rows?: Record<string, unknown>[];
  row_count?: number;
  trace: TraceStep[];
  audit_id: string;
};

export type ConnectResponse = {
  access_token: string;
  access_id: string;
  agent_id: string;
  department: string;
  expires_at: string;
  scopes: string[];
};
