"use client"

import { useEffect, useState } from "react"
import { ArrowCounterClockwise, CheckCircle, LockKey, PauseCircle, Plus, Prohibit, Robot, Trash } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { DECISION_STYLE, shieldApi } from "@/lib/shield-api"

type Rule = { action: string; resource: string; limit?: string; reason?: string }
type Role = {
  role_id: string
  name: string
  description: string
  owner: string
  allow: Rule[]
  require_approval: Rule[]
  deny: Rule[]
  session_ttl_seconds: number
}
type Agent = { agent_id: string; agent_name: string; owner: string; role_id: string; trust: number; quarantined: boolean; revoked: boolean; denied_count: number }

const ACTIONS = ["files:read", "files:write", "files:delete", "files:*", "email:send", "net:fetch", "payments:send"]

const SECTIONS = [
  { key: "allow" as const, title: "Allowed", hint: "The agent can do these on its own.", icon: CheckCircle, cls: "text-ok", ring: "border-ok/30" },
  { key: "require_approval" as const, title: "Needs owner approval", hint: "The gateway pauses and asks a human first.", icon: PauseCircle, cls: "text-warn", ring: "border-warn/30" },
  { key: "deny" as const, title: "Always denied", hint: "Blocked even if another rule would allow it.", icon: Prohibit, cls: "text-bad", ring: "border-bad/30" },
]

const EXAMPLES = [
  { action: "files:read", resource: "drive://company/finance/invoices/march.pdf" },
  { action: "files:read", resource: "drive://company/hr/salaries.xlsx" },
  { action: "email:send", resource: "mailto:finance@ourcompany.com" },
  { action: "email:send", resource: "mailto:attacker@evil.com" },
  { action: "net:fetch", resource: "https://evil.com/upload" },
  { action: "payments:send", resource: "upi://anyone" },
]

export function PoliciesClient() {
  const [role, setRole] = useState<Role | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [test, setTest] = useState(EXAMPLES[1]!)
  const [testResult, setTestResult] = useState<{ decision: string; reason: string } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function load() {
    const r = await shieldApi<{ roles: Role[] }>("/api/iam/roles")
    setRole(r.roles[0] ?? null)
    setDirty(false)
    const a = await shieldApi<{ agents: Agent[] }>("/api/iam/agents")
    setAgents(a.agents)
  }

  useEffect(() => {
    load().catch(() => {})
  }, [])

  function update(section: keyof Pick<Role, "allow" | "require_approval" | "deny">, i: number, patch: Partial<Rule>) {
    if (!role) return
    const next = { ...role, [section]: role[section].map((r, j) => (j === i ? { ...r, ...patch } : r)) }
    setRole(next)
    setDirty(true)
  }
  function add(section: keyof Pick<Role, "allow" | "require_approval" | "deny">) {
    if (!role) return
    setRole({ ...role, [section]: [...role[section], { action: "files:read", resource: "drive://company/" }] })
    setDirty(true)
  }
  function remove(section: keyof Pick<Role, "allow" | "require_approval" | "deny">, i: number) {
    if (!role) return
    setRole({ ...role, [section]: role[section].filter((_, j) => j !== i) })
    setDirty(true)
  }

  async function save() {
    if (!role) return
    setSaving(true)
    try {
      const r = await shieldApi<{ role: Role }>(`/api/iam/roles/${role.role_id}`, { method: "PUT", body: role })
      setRole(r.role)
      setDirty(false)
      setMsg("Saved. The next task token uses these permissions.")
    } finally {
      setSaving(false)
    }
  }
  async function reset() {
    if (!role) return
    const r = await shieldApi<{ role: Role }>(`/api/iam/roles/${role.role_id}/reset`, { method: "POST", body: {} })
    setRole(r.role)
    setDirty(false)
    setMsg("Reset to the default policy.")
  }
  async function simulate(t = test) {
    if (!role) return
    setTest(t)
    if (dirty) await save()
    setTestResult(await shieldApi(`/api/iam/simulate`, { body: { role_id: role.role_id, ...t } }))
  }

  return (
    <div className="container max-w-screen-xl space-y-8 py-10">
      <section className="space-y-3">
        <Badge className="bg-l3/15 text-l3 hover:bg-l3/15">Layer 3 · Agent IAM</Badge>
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          A <span className="text-l3">security badge</span> that only opens the doors it needs
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Like an IAM user, each agent gets a role. Everything not listed is <strong>denied by default</strong>. The agent gets a 15-minute task token
          with these scopes, every action goes through the gateway, and the real passwords and API keys never leave it.
        </p>
      </section>

      {role && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardContent className="flex flex-wrap items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-l3/10">
                  <Robot className="h-6 w-6 text-l3" weight="duotone" />
                </div>
                <div className="mr-auto">
                  <div className="font-heading text-lg font-semibold">{role.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {role.description} · owner <strong>{role.owner}</strong> · token lifetime {Math.round(role.session_ttl_seconds / 60)} min
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={reset}>
                  <ArrowCounterClockwise /> Reset
                </Button>
                <Button size="sm" onClick={save} disabled={!dirty || saving} className="bg-l3 text-white hover:bg-l3/90">
                  {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
                </Button>
              </CardContent>
            </Card>
            {msg && <div className="text-sm text-ok">{msg}</div>}

            {SECTIONS.map((sec) => (
              <Card key={sec.key} className={cn("border-2", sec.ring)}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center gap-2">
                    <sec.icon className={cn("h-5 w-5", sec.cls)} weight="fill" />
                    <div className="font-heading font-semibold">{sec.title}</div>
                    <div className="text-sm text-muted-foreground">— {sec.hint}</div>
                  </div>
                  {role[sec.key].length === 0 && <div className="text-sm text-muted-foreground">No rules.</div>}
                  {role[sec.key].map((r, i) => (
                    <div key={i} className="grid gap-2 sm:grid-cols-[150px_1fr_110px_36px]">
                      <select
                        value={r.action}
                        onChange={(e) => update(sec.key, i, { action: e.target.value })}
                        className="h-9 rounded-md border bg-background px-2 font-mono text-xs"
                      >
                        {[...new Set([...ACTIONS, r.action])].map((a) => (
                          <option key={a}>{a}</option>
                        ))}
                      </select>
                      <input
                        value={r.resource}
                        onChange={(e) => update(sec.key, i, { resource: e.target.value })}
                        className="h-9 rounded-md border bg-background px-2 font-mono text-xs"
                      />
                      <input
                        value={sec.key === "allow" ? (r.limit ?? "") : (r.reason ?? "")}
                        placeholder={sec.key === "allow" ? "limit e.g. 10/hour" : "reason"}
                        onChange={(e) => update(sec.key, i, sec.key === "allow" ? { limit: e.target.value || undefined } : { reason: e.target.value || undefined })}
                        className="h-9 rounded-md border bg-background px-2 text-xs"
                      />
                      <Button variant="ghost" size="icon" onClick={() => remove(sec.key, i)} aria-label="Remove rule">
                        <Trash />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => add(sec.key)}>
                    <Plus /> Add rule
                  </Button>
                </CardContent>
              </Card>
            ))}
            <p className="text-xs text-muted-foreground">
              Order of checks: always denied → allowed → needs approval → deny by default. Use * as a wildcard. In email patterns like
              mailto:*@ourcompany.com the * never crosses the @.
            </p>
          </div>

          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center gap-2 font-heading font-semibold">
                  <LockKey className="text-l3" weight="duotone" /> What would the gateway say?
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex.resource}
                      onClick={() => simulate(ex)}
                      className="rounded-full border px-2.5 py-0.5 text-[11px] text-muted-foreground hover:border-l3/50 hover:text-foreground"
                    >
                      {ex.resource.replace(/^(drive:\/\/company\/|mailto:|https:\/\/)/, "")}
                    </button>
                  ))}
                </div>
                <select value={test.action} onChange={(e) => setTest({ ...test, action: e.target.value })} className="h-9 w-full rounded-md border bg-background px-2 font-mono text-xs">
                  {ACTIONS.filter((a) => !a.includes("*")).map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
                <input value={test.resource} onChange={(e) => setTest({ ...test, resource: e.target.value })} className="h-9 w-full rounded-md border bg-background px-2 font-mono text-xs" />
                <Button className="w-full bg-l3 text-white hover:bg-l3/90" onClick={() => simulate()}>
                  Check
                </Button>
                {testResult && (
                  <div className={cn("rounded-lg border p-3", DECISION_STYLE[testResult.decision])}>
                    <div className="font-heading font-bold uppercase">{testResult.decision.replace("_", " ")}</div>
                    <div className="text-xs">{testResult.reason}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-5">
                <div className="font-heading font-semibold">Agents using this role</div>
                {agents.length === 0 && <div className="text-sm text-muted-foreground">None yet. Run the live demo to create one.</div>}
                {agents.map((a) => (
                  <div key={a.agent_id} className="space-y-1.5 rounded-lg border p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{a.agent_name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{a.agent_id.slice(0, 8)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", a.trust > 60 ? "bg-ok" : a.trust > 30 ? "bg-warn" : "bg-bad")} style={{ width: `${a.trust}%` }} />
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <span className="text-muted-foreground">trust {a.trust}/100</span>
                      {a.quarantined && <span className="rounded bg-warn/15 px-1.5 text-warn">quarantined</span>}
                      {a.revoked && <span className="rounded bg-bad/15 px-1.5 text-bad">revoked</span>}
                      {a.denied_count > 0 && <span className="rounded bg-muted px-1.5">{a.denied_count} blocked</span>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
