/**
 * Who may read what. Each registered agent belongs to a department and has a policy.
 * Patterns use "schema.table" with "*" wildcards, e.g. "finance.*".
 * Anything not allowed is denied, and a deny always wins over an allow.
 */
export type AgentPolicy = {
  /** Tables and views the agent may read, e.g. ["finance.*", "production.summary"]. */
  allow: string[];
  /** Tables it may never read, even if an allow pattern matches, e.g. ["hr.*"]. */
  deny?: string[];
  /** Columns it may never read, e.g. ["hr.employees.pan", "*.bank_account"]. */
  denyColumns?: string[];
  /** Hard cap on rows returned per query (default 200). */
  maxRows?: number;
};

export type AgentConfig = {
  id: string;
  name: string;
  department: string;
  /** Shared secret the agent proves it holds (store it in a secret manager in production). */
  secret: string;
  policy: AgentPolicy;
  description?: string;
};

function globToRegex(glob: string) {
  return new RegExp(`^${glob.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^\\s]*")}$`, "i");
}

export function matchesAny(patterns: string[] | undefined, value: string) {
  return (patterns ?? []).some((p) => globToRegex(p).test(value));
}

export type TableDecision = { allowed: boolean; reason: string };

export function tableDecision(policy: AgentPolicy, qualifiedTable: string, department: string): TableDecision {
  const deny = (policy.deny ?? []).find((p) => globToRegex(p).test(qualifiedTable));
  if (deny) return { allowed: false, reason: `${qualifiedTable} is explicitly denied to the ${department} agent (rule "${deny}")` };
  const allow = policy.allow.find((p) => globToRegex(p).test(qualifiedTable));
  if (allow) return { allowed: true, reason: `allowed by rule "${allow}"` };
  return { allowed: false, reason: `${qualifiedTable} is not in the ${department} agent's permissions (deny by default)` };
}

export function columnDenied(policy: AgentPolicy, qualifiedTable: string, column: string) {
  return matchesAny(policy.denyColumns, `${qualifiedTable}.${column}`);
}

/** Postgres role used to run this agent's queries, so the database enforces the same policy. */
export function roleFor(agentId: string) {
  return `aw_agent_${agentId.toLowerCase().replace(/[^a-z0-9_]/g, "_")}`.slice(0, 60);
}

/** Human-readable list of what the agent may do, written into its access token. */
export function scopesFor(policy: AgentPolicy) {
  return [
    ...policy.allow.map((p) => `read ${p}`),
    ...(policy.deny ?? []).map((p) => `never ${p}`),
    ...(policy.denyColumns ?? []).map((p) => `never column ${p}`),
    `max ${policy.maxRows ?? 200} rows`,
  ];
}
