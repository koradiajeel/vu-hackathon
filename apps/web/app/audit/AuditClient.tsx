"use client"

import { useEffect, useState } from "react"
import { ArrowsClockwise, CheckCircle, ListChecks, PauseCircle, XCircle } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { DECISION_STYLE, LAYERS, shieldApi } from "@/lib/shield-api"

type Entry = {
  id: string
  ts: string
  run_id?: string
  layer: 1 | 2 | 3
  agent_name?: string
  event: string
  action?: string
  resource?: string
  decision: string
  reason: string
}
type Approval = {
  approval_id: string
  created_at: string
  agent_name: string
  action: string
  resource: string
  args: Record<string, unknown>
  reason: string
  status: "pending" | "approved" | "rejected"
}

const FILTERS = ["all", "blocked", "approvals"] as const
const BLOCKED = new Set(["deny", "dropped", "blocked", "rejected"])

export function AuditClient() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all")

  async function load() {
    const [a, p] = await Promise.all([shieldApi<{ entries: Entry[] }>("/api/iam/audit"), shieldApi<{ approvals: Approval[] }>("/api/iam/approvals")])
    setEntries(a.entries)
    setApprovals(p.approvals)
  }

  useEffect(() => {
    load().catch(() => {})
    const t = setInterval(() => load().catch(() => {}), 3000)
    return () => clearInterval(t)
  }, [])

  async function decide(id: string, verdict: "approve" | "reject") {
    await shieldApi(`/api/iam/approvals/${id}/${verdict}`, { method: "POST", body: {} })
    await load()
  }

  const pending = approvals.filter((a) => a.status === "pending")
  const shown = entries.filter((e) => (filter === "all" ? true : filter === "blocked" ? BLOCKED.has(e.decision) : ["needs_approval", "approved", "rejected"].includes(e.decision)))
  const counts = {
    allowed: entries.filter((e) => e.decision === "allow").length,
    blocked: entries.filter((e) => BLOCKED.has(e.decision)).length,
    paused: entries.filter((e) => e.decision === "needs_approval").length,
  }

  return (
    <div className="container max-w-screen-xl space-y-8 py-10">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <Badge className="bg-primary/15 text-primary hover:bg-primary/15">All layers</Badge>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">Audit log</h1>
          <p className="max-w-2xl text-muted-foreground">Every check the identity layer, the shield and the gateway made, newest first. Updates every 3 seconds.</p>
        </div>
        <Button variant="outline" onClick={() => load()}>
          <ArrowsClockwise /> Refresh
        </Button>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Allowed", value: counts.allowed, icon: CheckCircle, cls: "text-ok bg-ok/10" },
          { label: "Blocked", value: counts.blocked, icon: XCircle, cls: "text-bad bg-bad/10" },
          { label: "Paused for approval", value: counts.paused, icon: PauseCircle, cls: "text-warn bg-warn/10" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", s.cls)}>
                <s.icon className="h-6 w-6" weight="fill" />
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-heading text-xl font-semibold">Waiting for you</h2>
          {pending.map((a) => (
            <Card key={a.approval_id} className="border-2 border-warn/50 bg-warn/5">
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <PauseCircle className="h-7 w-7 text-warn" weight="fill" />
                <div className="mr-auto min-w-0">
                  <div className="font-medium">
                    {a.agent_name} wants to <code className="text-l3">{a.action}</code> → <code className="break-all">{a.resource}</code>
                  </div>
                  <div className="text-sm text-muted-foreground">{a.reason}</div>
                  {Array.isArray(a.args.attachments) && (a.args.attachments as string[]).length > 0 && (
                    <div className="text-xs text-bad">Attachments: {(a.args.attachments as string[]).join(", ")}</div>
                  )}
                </div>
                <Button variant="outline" onClick={() => decide(a.approval_id, "reject")}>
                  <XCircle /> Reject
                </Button>
                <Button onClick={() => decide(a.approval_id, "approve")}>
                  <CheckCircle /> Approve
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          <h2 className="mr-auto font-heading text-xl font-semibold">Events</h2>
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn("rounded-full border px-3 py-1 text-xs capitalize", filter === f ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}
            >
              {f}
            </button>
          ))}
        </div>
        <Card>
          <div className="divide-y">
            {shown.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Nothing yet. Run the live demo to generate events.</div>}
            {shown.map((e) => {
              const L = LAYERS[e.layer]
              return (
                <div key={e.id} className="grid gap-x-4 gap-y-1 p-3 text-sm sm:grid-cols-[80px_150px_1fr_130px]">
                  <span className="font-mono text-xs text-muted-foreground">{new Date(e.ts).toLocaleTimeString()}</span>
                  <span className={cn("text-xs font-semibold", L.color)}>
                    <span className={cn("mr-1.5 inline-block h-2 w-2 rounded-full", L.dot)} />
                    {L.name.replace("Layer ", "L")}
                  </span>
                  <span className="min-w-0">
                    <span className="font-medium">{e.event}</span>
                    {e.action && (
                      <>
                        {" "}
                        · <code className="text-xs">{e.action}</code> <code className="break-all text-xs text-muted-foreground">{e.resource}</code>
                      </>
                    )}
                    <span className="block text-xs text-muted-foreground">{e.reason}</span>
                  </span>
                  <span>
                    <span className={cn("inline-block rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase", DECISION_STYLE[e.decision] ?? DECISION_STYLE.info)}>
                      {e.decision.replace("_", " ")}
                    </span>
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      </section>
    </div>
  )
}
