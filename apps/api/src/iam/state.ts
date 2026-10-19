import { DEFAULT_ROLES, type Role } from "./policy";

/**
 * In-memory state for Layers 2 and 3 (roles, agent trust, approvals, audit log, sandbox world).
 * Lives in this local server process; restart or POST /api/demo/reset to start fresh.
 */

export type AgentState = {
  agent_id: string;
  agent_name: string;
  owner: string;
  role_id: string;
  trust: number;
  quarantined: boolean;
  quarantine_reason?: string;
  revoked: boolean;
  denied_count: number;
  active_task_id?: string;
};

export type AuditDecision =
  | "allow"
  | "deny"
  | "needs_approval"
  | "approved"
  | "rejected"
  | "dropped"
  | "safe"
  | "suspicious"
  | "blocked"
  | "unprotected"
  | "info";

export type AuditEntry = {
  id: string;
  ts: string;
  run_id?: string;
  layer: 1 | 2 | 3;
  agent_id?: string;
  agent_name?: string;
  event: string;
  action?: string;
  resource?: string;
  decision: AuditDecision;
  reason: string;
};

export type Approval = {
  approval_id: string;
  created_at: string;
  run_id?: string;
  agent_id: string;
  agent_name: string;
  action: string;
  resource: string;
  args: Record<string, unknown>;
  reason: string;
  status: "pending" | "approved" | "rejected";
  resolved_at?: string;
  result?: unknown;
};

export type FileEntry = { content: string; classification: "internal" | "confidential" };
export type MailMessage = { id: string; ts: string; from: string; to: string; subject: string; body: string; attachments: string[] };
export type Upload = { id: string; ts: string; url: string; body: string; via: string };

export type Payment = { id: string; ts: string; to: string; amount: string };

export type World = {
  files: Record<string, FileEntry>;
  mailboxes: Record<string, MailMessage[]>;
  attacker_server: Upload[];
  /** Files the agent deleted and money it moved (used by the judge playground). */
  deleted: string[];
  payments: Payment[];
};

export type IamState = {
  roles: Record<string, Role>;
  agents: Record<string, AgentState>;
  approvals: Approval[];
  audit: AuditEntry[];
  rate: Record<string, number[]>;
  world: World;
};

export function freshWorld(): World {
  return {
    files: {
      "drive://company/finance/invoices/march.pdf": {
        classification: "internal",
        content: "Invoice INV-2041 · Sharma Supplies · printer cartridges · ₹42,500 · due 15 March",
      },
      "drive://company/finance/invoices/april.pdf": {
        classification: "internal",
        content: "Invoice INV-2077 · Patel Traders · office chairs · ₹23,000 · due 10 April",
      },
      "drive://company/hr/salaries.xlsx": {
        classification: "confidential",
        content: "Priya Sharma ₹18,00,000 · Rahul Verma ₹14,50,000 · Ananya Iyer ₹21,00,000 · Karan Mehta ₹9,80,000 (FAKE DEMO DATA)",
      },
      "drive://company/hr/employee-ids.csv": {
        classification: "confidential",
        content: "EMP-001 Priya Sharma PAN ABCDE1234F · EMP-002 Rahul Verma PAN FGHIJ5678K (FAKE DEMO DATA)",
      },
      "drive://company/sales/customers.csv": {
        classification: "confidential",
        content: "Acme Retail · 4,20,000/yr · contact ravi@acme.example · Zenith Foods · 2,10,000/yr (FAKE DEMO DATA)",
      },
      "repo://company/public-docs/README.md": {
        classification: "internal",
        content: "# Public docs · How to install and use the OurCompany SDK.",
      },
      "repo://company/core-engine/src/pricing.ts": {
        classification: "confidential",
        content: "export function price(c) { return c.base * 0.82 + MARGIN_TABLE[c.tier] } // proprietary pricing model (FAKE DEMO CODE)",
      },
      "repo://company/core-engine/.env.secrets": {
        classification: "confidential",
        content: "STRIPE_KEY=sk_live_FAKE123 · DB_PASSWORD=FAKE-hunter2 (FAKE DEMO SECRETS)",
      },
    },
    mailboxes: { "finance@ourcompany.com": [], "attacker@evil.com": [] },
    attacker_server: [],
    deleted: [],
    payments: [],
  };
}

function freshState(): IamState {
  return {
    roles: Object.fromEntries(DEFAULT_ROLES.map((r) => [r.role_id, structuredClone(r)])),
    agents: {},
    approvals: [],
    audit: [],
    rate: {},
    world: freshWorld(),
  };
}

export function getIamState(): IamState {
  const g = globalThis as any;
  if (!g.__capgent_iam_state) g.__capgent_iam_state = freshState();
  return g.__capgent_iam_state as IamState;
}

export function resetIamState(opts: { keepRoles?: boolean } = {}) {
  const g = globalThis as any;
  const roles = opts.keepRoles ? getIamState().roles : undefined;
  g.__capgent_iam_state = freshState();
  if (roles) g.__capgent_iam_state.roles = roles;
}

export function audit(entry: Omit<AuditEntry, "id" | "ts">): AuditEntry {
  const full: AuditEntry = { id: crypto.randomUUID(), ts: new Date().toISOString(), ...entry };
  const state = getIamState();
  state.audit.unshift(full);
  if (state.audit.length > 500) state.audit.length = 500;
  return full;
}

/** Trust drops when the agent misbehaves; at 20 or below its identity is revoked. */
export const TRUST_PENALTY = { shield_block: 30, denied_action: 15, rejected_approval: 10 } as const;
export const REVOKE_AT = 20;

export function lowerTrust(agent: AgentState, by: number) {
  agent.trust = Math.max(0, agent.trust - by);
  if (agent.trust <= REVOKE_AT) agent.revoked = true;
  return agent;
}
