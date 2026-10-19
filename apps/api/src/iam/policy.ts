/**
 * Layer 3 — Agent IAM.
 * Each agent gets a role with a deny-by-default policy, like an IAM user.
 * Evaluation order: explicit deny → allow → needs approval → default deny.
 */

export type Action = "files:read" | "files:write" | "files:delete" | "repo:read" | "repo:write" | "email:send" | "net:fetch" | "payments:send";

export type Rule = {
  action: Action | string;
  resource: string;
  /** e.g. "10/hour" — only for allow rules */
  limit?: string;
  reason?: string;
};

export type Role = {
  role_id: string;
  name: string;
  description: string;
  owner: string;
  default: "deny";
  allow: Rule[];
  require_approval: Rule[];
  deny: Rule[];
  session_ttl_seconds: number;
};

export type Decision = "allow" | "deny" | "needs_approval";

export type PolicyResult = {
  decision: Decision;
  reason: string;
  rule?: Rule;
};

export const DEFAULT_ROLES: Role[] = [
  {
    role_id: "invoice-summariser",
    name: "Invoice Summariser",
    description: "Reads finance invoices and emails a summary to the finance team.",
    owner: "finance-team",
    default: "deny",
    allow: [
      { action: "files:read", resource: "drive://company/finance/invoices/*" },
      { action: "email:send", resource: "mailto:*@ourcompany.com", limit: "10/hour" },
      { action: "net:fetch", resource: "https://api.exchangerate.host/*" },
    ],
    require_approval: [{ action: "email:send", resource: "mailto:*", reason: "external recipient" }],
    deny: [
      { action: "files:*", resource: "drive://company/hr/*", reason: "HR data is never available to this agent" },
      { action: "payments:send", resource: "*", reason: "this agent can never move money" },
    ],
    session_ttl_seconds: 900,
  },
  {
    role_id: "dev-assistant",
    name: "Dev Assistant",
    description: "Answers questions about the public docs repo and checks package versions.",
    owner: "eng-team",
    default: "deny",
    allow: [
      { action: "repo:read", resource: "repo://company/public-docs/*" },
      { action: "email:send", resource: "mailto:*@ourcompany.com", limit: "10/hour" },
      { action: "net:fetch", resource: "https://registry.npmjs.org/*" },
    ],
    require_approval: [
      { action: "repo:write", resource: "repo://company/public-docs/*", reason: "code change" },
      { action: "email:send", resource: "mailto:*", reason: "external recipient" },
    ],
    deny: [
      { action: "repo:*", resource: "repo://company/core-engine/*", reason: "proprietary source code" },
      { action: "*", resource: "*secrets*", reason: "secrets are never readable by agents" },
      { action: "payments:send", resource: "*", reason: "this agent can never move money" },
    ],
    session_ttl_seconds: 900,
  },
];

function globToRegex(glob: string) {
  // In a pattern like "mailto:*@ourcompany.com" the "*" must not cross the "@",
  // so it can't match "mailto:x@evil.com?@ourcompany.com". Plain "mailto:*" still matches any address.
  const star = glob.startsWith("mailto:") && glob.includes("@") ? "[^@\\s?&]*" : "[^\\s]*";
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, star);
  return new RegExp(`^${escaped}$`, "i");
}

export function matches(rule: Rule, action: string, resource: string) {
  return globToRegex(rule.action).test(action) && globToRegex(rule.resource).test(resource);
}

export function evaluatePolicy(role: Role, action: string, resource: string): PolicyResult {
  const denied = role.deny.find((r) => matches(r, action, resource));
  if (denied) return { decision: "deny", reason: `Explicitly denied: ${denied.reason ?? `${denied.action} on ${denied.resource}`}`, rule: denied };

  const allowed = role.allow.find((r) => matches(r, action, resource));
  if (allowed) return { decision: "allow", reason: `Allowed by policy: ${allowed.action} on ${allowed.resource}`, rule: allowed };

  const approval = role.require_approval.find((r) => matches(r, action, resource));
  if (approval) return { decision: "needs_approval", reason: `Owner approval required: ${approval.reason ?? "sensitive action"}`, rule: approval };

  return { decision: "deny", reason: `Not in policy (deny by default): ${action} on ${resource}` };
}

/** Actions that send data somewhere or change things. Paused while an agent is quarantined. */
export const OUTBOUND_ACTIONS = ["email:send", "files:write", "files:delete", "repo:write", "payments:send"];

/** Scopes written into the task token, e.g. "files:read drive://company/finance/invoices/*". */
export function scopesForRole(role: Role) {
  return role.allow.map((r) => `${r.action} ${r.resource}`);
}

export function parseLimit(limit?: string): { count: number; windowMs: number } | null {
  if (!limit) return null;
  const m = /^(\d+)\s*\/\s*(minute|hour|day)$/i.exec(limit.trim());
  if (!m) return null;
  const unit = m[2]!.toLowerCase();
  const windowMs = unit === "minute" ? 60_000 : unit === "hour" ? 3_600_000 : 86_400_000;
  return { count: Number(m[1]), windowMs };
}
