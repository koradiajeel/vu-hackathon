/** Browser helpers for the AgentWarden API (Layers 2 + 3), served by this app at /api/capgent. */
export const SHIELD_API = "/api/capgent"

export async function shieldApi<T = any>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${SHIELD_API}${path}`, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: init?.body ? { "content-type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok && res.status !== 202 && res.status !== 403) {
    throw new Error((json as any)?.message ?? (json as any)?.error ?? `Request failed (${res.status})`)
  }
  return json as T
}

export type Layer = 0 | 1 | 2 | 3
export type StepStatus = "ok" | "info" | "warn" | "bad" | "blocked"

export type DemoStep = {
  layer: Layer
  title: string
  detail: string
  status: StepStatus
  data?: any
  approval_id?: string
}

export type MailMessage = { id: string; ts: string; from: string; to: string; subject: string; body: string; attachments: string[] }

export type DemoOutcome = {
  data_leaked: boolean
  leaked_files: string[]
  attacker_inbox: MailMessage[]
  attacker_server: { id: string; ts: string; url: string; body: string }[]
  finance_inbox: MailMessage[]
  pending_approvals: { approval_id: string; action: string; resource: string; reason: string }[]
  agent: { agent_id: string; trust: number; quarantined: boolean; revoked: boolean; denied_count: number } | null
}

export type DemoRun = {
  run_id: string
  mode: { shield: boolean; iam: boolean }
  mode_label: string
  steps: DemoStep[]
  outcome: DemoOutcome
}

export const LAYERS = {
  0: { name: "Agent", short: "Agent", color: "text-bad", bg: "bg-bad/10", border: "border-bad/40", dot: "bg-bad" },
  1: { name: "Layer 1 · Identity", short: "Passport", color: "text-l1", bg: "bg-l1/10", border: "border-l1/40", dot: "bg-l1" },
  2: { name: "Layer 2 · Injection Shield", short: "Immune system", color: "text-l2", bg: "bg-l2/10", border: "border-l2/40", dot: "bg-l2" },
  3: { name: "Layer 3 · IAM + Sandbox", short: "Security badge", color: "text-l3", bg: "bg-l3/10", border: "border-l3/40", dot: "bg-l3" },
} as const

export const DECISION_STYLE: Record<string, string> = {
  allow: "bg-ok/15 text-ok border-ok/30",
  approved: "bg-ok/15 text-ok border-ok/30",
  safe: "bg-ok/15 text-ok border-ok/30",
  info: "bg-muted text-muted-foreground border-border",
  needs_approval: "bg-warn/15 text-warn border-warn/30",
  suspicious: "bg-warn/15 text-warn border-warn/30",
  deny: "bg-bad/15 text-bad border-bad/30",
  rejected: "bg-bad/15 text-bad border-bad/30",
  dropped: "bg-bad/15 text-bad border-bad/30",
  blocked: "bg-bad/15 text-bad border-bad/30",
  unprotected: "bg-bad/15 text-bad border-bad/30",
}
