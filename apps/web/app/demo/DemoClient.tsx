"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  Fingerprint,
  Info,
  LockKey,
  PauseCircle,
  Play,
  Prohibit,
  Robot,
  ShieldCheck,
  Skull,
  Warning,
  XCircle,
} from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { LAYERS, shieldApi, type DemoOutcome, type DemoRun, type DemoStep } from "@/lib/shield-api"

type Email = { id: string; from: string; subject: string; html: string }

const RUNS = [
  { n: 1, shield: false, iam: false, name: "No protection", blurb: "How most AI agents run today." },
  { n: 2, shield: true, iam: false, name: "Shield only", blurb: "AI scans everything the agent reads." },
  { n: 3, shield: false, iam: true, name: "IAM only", blurb: "Pretend the shield failed. Does the badge still say no?" },
  { n: 4, shield: true, iam: true, name: "Full AgentWarden", blurb: "All three layers working together." },
] as const

const LAYER_CARDS = [
  { layer: 1 as const, icon: Fingerprint, title: "Passport", text: "Every agent solves a challenge and gets an identity tied to an accountable owner." },
  { layer: 2 as const, icon: ShieldCheck, title: "Immune system", text: "An AI shield scans emails and web pages and removes hidden hijack instructions." },
  { layer: 3 as const, icon: LockKey, title: "Security badge", text: "The agent only gets the permissions its task needs. Real keys never leave the gateway." },
]

function StatusIcon({ status }: { status: DemoStep["status"] }) {
  const cls = "h-5 w-5 shrink-0"
  if (status === "ok") return <CheckCircle className={cn(cls, "text-ok")} weight="fill" />
  if (status === "warn") return <PauseCircle className={cn(cls, "text-warn")} weight="fill" />
  if (status === "blocked") return <Prohibit className={cn(cls, "text-ok")} weight="bold" />
  if (status === "bad") return <Warning className={cn(cls, "text-bad")} weight="fill" />
  return <Info className={cn(cls, "text-muted-foreground")} weight="fill" />
}

function hiddenPart(html: string) {
  const m = /<div style="[^"]*">([\s\S]*?)<\/div>/.exec(html)
  return m?.[1] ?? ""
}
function visiblePart(html: string) {
  return html
    .replace(/<div style="[^"]*">[\s\S]*?<\/div>/, "")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<\/p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .trim()
}

function TrustMeter({ value }: { value: number }) {
  const color = value > 60 ? "bg-ok" : value > 30 ? "bg-warn" : "bg-bad"
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted-foreground">Agent trust score</span>
        <span className="font-semibold tabular-nums">{value}/100</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function StepData({ step }: { step: DemoStep }) {
  const d = step.data
  if (!d) return null
  if (d.findings) {
    return (
      <div className="mt-2 space-y-1.5">
        {d.findings.map((f: any, i: number) => (
          <div key={i} className="rounded-md border border-l2/30 bg-l2/5 px-2.5 py-1.5 text-xs">
            <div className="font-medium text-foreground">“{f.text}”</div>
            <div className="mt-0.5 text-muted-foreground">
              score {f.score} · {f.reasons.join(" · ")}
            </div>
          </div>
        ))}
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Agent sees instead:</span> “{d.agent_sees}”
        </div>
      </div>
    )
  }
  if (d.scopes) {
    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {d.scopes.map((s: string) => (
          <code key={s} className="rounded bg-l3/10 px-1.5 py-0.5 text-[11px] text-l3">
            {s}
          </code>
        ))}
      </div>
    )
  }
  if (d.keys) {
    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {d.keys.map((s: string) => (
          <code key={s} className="rounded bg-bad/10 px-1.5 py-0.5 text-[11px] text-bad">
            {s}
          </code>
        ))}
      </div>
    )
  }
  if (d.agent_sees) {
    return <div className="mt-2 rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">Agent context: “{d.agent_sees}”</div>
  }
  if (d.credential) {
    return <div className="mt-1 text-xs text-muted-foreground">🔑 Credential {d.credential}</div>
  }
  if (d.instructions) {
    return (
      <details className="mt-1 text-xs text-muted-foreground">
        <summary className="cursor-pointer">Show the challenge</summary>
        <ol className="mt-1 list-inside space-y-0.5">
          {d.instructions.map((x: string) => (
            <li key={x}>{x}</li>
          ))}
        </ol>
      </details>
    )
  }
  return null
}

export function DemoClient() {
  const [emails, setEmails] = useState<Email[]>([])
  const [reveal, setReveal] = useState(false)
  const [runIdx, setRunIdx] = useState(0)
  const [running, setRunning] = useState(false)
  const [run, setRun] = useState<DemoRun | null>(null)
  const [shown, setShown] = useState(0)
  const [outcome, setOutcome] = useState<DemoOutcome | null>(null)
  const [resolved, setResolved] = useState<Record<string, "approved" | "rejected">>({})
  const [history, setHistory] = useState<Record<number, { leaked: boolean; stoppedBy: string }>>({})
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const resultsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    shieldApi<{ emails: Email[] }>("/api/demo/emails").then((r) => setEmails(r.emails)).catch(() => {})
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [])

  const selected = RUNS[runIdx]!
  const done = run !== null && shown >= run.steps.length

  async function start() {
    if (timer.current) clearInterval(timer.current)
    setError(null)
    setRunning(true)
    setRun(null)
    setOutcome(null)
    setShown(0)
    setResolved({})
    try {
      const r = await shieldApi<DemoRun>("/api/demo/run", { body: { shield: selected.shield, iam: selected.iam } })
      setRun(r)
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      let i = 0
      timer.current = setInterval(() => {
        i++
        setShown(i)
        if (i >= r.steps.length) {
          clearInterval(timer.current!)
          setOutcome(r.outcome)
          setRunning(false)
          const stoppedBy = r.outcome.data_leaked
            ? "—"
            : selected.shield && selected.iam
              ? "Shield + IAM"
              : selected.shield
                ? "Shield (Layer 2)"
                : "IAM gateway (Layer 3)"
          setHistory((h) => ({ ...h, [selected.n]: { leaked: r.outcome.data_leaked, stoppedBy } }))
        }
      }, 420)
    } catch (e) {
      setError((e as Error).message)
      setRunning(false)
    }
  }

  async function decide(approvalId: string, verdict: "approve" | "reject") {
    try {
      const r = await shieldApi<{ outcome: DemoOutcome }>(`/api/iam/approvals/${approvalId}/${verdict}`, { method: "POST", body: {} })
      setResolved((m) => ({ ...m, [approvalId]: verdict === "approve" ? "approved" : "rejected" }))
      setOutcome(r.outcome)
      if (r.outcome.data_leaked) setHistory((h) => ({ ...h, [selected.n]: { leaked: true, stoppedBy: "—" } }))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const visibleSteps = run ? run.steps.slice(0, shown) : []
  const e2 = emails.find((e) => e.id === "e2")

  return (
    <div className="container max-w-screen-xl space-y-10 py-10">
      {/* Header */}
      <section className="space-y-3">
        <Badge className="bg-l2/15 text-l2 hover:bg-l2/15">Live attack demo</Badge>
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          Watch an AI agent get hijacked <span className="text-primary">— then stop it.</span>
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          An invoice assistant reads two vendor emails. One of them hides an instruction in white text that humans can&apos;t see. Run the same task
          with different layers switched on and watch what happens to the company&apos;s HR data.
        </p>
      </section>

      {/* Three layers */}
      <section className="grid gap-4 md:grid-cols-3">
        {LAYER_CARDS.map(({ layer, icon: Icon, title, text }) => (
          <Card key={layer} className={cn("border-2", LAYERS[layer].border)}>
            <CardContent className="flex gap-3 p-5">
              <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", LAYERS[layer].bg)}>
                <Icon className={cn("h-6 w-6", LAYERS[layer].color)} weight="duotone" />
              </div>
              <div>
                <div className={cn("text-xs font-semibold uppercase tracking-wide", LAYERS[layer].color)}>{LAYERS[layer].name}</div>
                <div className="font-heading text-lg font-semibold">{title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* The task */}
      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <Robot className="h-6 w-6 text-primary" weight="duotone" />
              </div>
              <div>
                <div className="font-heading font-semibold">invoice-summariser</div>
                <div className="text-xs text-muted-foreground">AI agent · owner: finance-team</div>
              </div>
            </div>
            <div className="rounded-lg bg-muted p-3 text-sm">
              <span className="font-medium">Task:</span> &ldquo;Read this week&apos;s vendor emails, open the invoices, and email a summary to finance@ourcompany.com.&rdquo;
            </div>
            <div className="text-sm">
              <div className="mb-1.5 font-medium">What the attacker wants</div>
              <div className="flex items-start gap-2 rounded-lg border border-bad/30 bg-bad/5 p-3 text-muted-foreground">
                <Skull className="mt-0.5 h-4 w-4 shrink-0 text-bad" weight="fill" />
                <span>
                  Get the agent to send <code className="text-bad">hr/salaries.xlsx</code> to <code className="text-bad">attacker@evil.com</code>.
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              The agent is simulated: it behaves like an LLM agent that obeys any instruction in its context, so the demo is repeatable. Identity,
              shield and gateway are real.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-heading font-semibold">
                <EnvelopeSimple className="h-5 w-5 text-primary" weight="duotone" /> Agent&apos;s inbox
              </div>
              <Button size="sm" variant={reveal ? "default" : "outline"} onClick={() => setReveal((v) => !v)}>
                {reveal ? <EyeSlash /> : <Eye />}
                {reveal ? "Hide" : "Show"} what humans can&apos;t see
              </Button>
            </div>
            {emails.map((e) => (
              <div key={e.id} className="rounded-lg border bg-card p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-sm font-medium">{e.subject}</div>
                  <div className="text-xs text-muted-foreground">{e.from}</div>
                </div>
                <div className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground">{visiblePart(e.html)}</div>
                {e.id === "e2" && reveal && (
                  <div className="mt-2 rounded-md border-2 border-dashed border-bad/60 bg-bad/5 p-2.5 text-sm">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-bad">Hidden: white text, 1px font</div>
                    <span className="text-foreground">{hiddenPart(e.html)}</span>
                  </div>
                )}
              </div>
            ))}
            {e2 && !reveal && <p className="text-xs text-muted-foreground">Both emails look normal to a person.</p>}
          </CardContent>
        </Card>
      </section>

      {/* Run picker */}
      <section className="space-y-4">
        <h2 className="font-heading text-xl font-semibold">Pick a run</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {RUNS.map((r, i) => {
            const h = history[r.n]
            return (
              <button
                key={r.n}
                onClick={() => setRunIdx(i)}
                disabled={running}
                className={cn(
                  "rounded-xl border-2 p-4 text-left transition-all hover:-translate-y-0.5 disabled:opacity-60",
                  i === runIdx ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-border bg-card hover:border-primary/40"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{r.n}</span>
                  {h && (
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", h.leaked ? "bg-bad/15 text-bad" : "bg-ok/15 text-ok")}>
                      {h.leaked ? "Leaked" : "Safe"}
                    </span>
                  )}
                </div>
                <div className="mt-2 font-heading font-semibold">{r.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{r.blurb}</div>
                <div className="mt-3 flex gap-1.5">
                  <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium", r.shield ? "bg-l2/15 text-l2" : "bg-muted text-muted-foreground line-through")}>Shield</span>
                  <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium", r.iam ? "bg-l3/15 text-l3" : "bg-muted text-muted-foreground line-through")}>IAM</span>
                </div>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-3">
          <Button size="lg" onClick={start} disabled={running} className="h-11 px-6 text-base">
            <Play weight="fill" /> {running ? "Agent running…" : `Run ${selected.n}: ${selected.name}`}
          </Button>
          {error && <span className="text-sm text-bad">{error}</span>}
        </div>
      </section>

      {/* Results */}
      <section ref={resultsRef} className="grid scroll-mt-24 gap-6 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-2">
          <h2 className="font-heading text-xl font-semibold">What happened</h2>
          {!run && !running && <Card className="p-8 text-center text-sm text-muted-foreground">Pick a run and press the button. Steps appear here one by one.</Card>}
          {running && !run && <Card className="p-8 text-center text-sm text-muted-foreground">Starting the agent…</Card>}
          <ol className="space-y-2">
            {visibleSteps.map((s, i) => {
              const L = LAYERS[s.layer]
              const res = s.approval_id ? resolved[s.approval_id] : undefined
              return (
                <li
                  key={i}
                  className={cn(
                    "animate-in fade-in slide-in-from-bottom-2 rounded-xl border border-l-4 bg-card p-3.5 duration-300",
                    L.border,
                    s.layer === 0 && "bg-bad/5",
                    s.status === "bad" && "border-bad/50"
                  )}
                  style={{ borderLeftColor: `hsl(var(--${s.layer === 0 ? "bad" : `l${s.layer}`}))` }}
                >
                  <div className="flex items-start gap-3">
                    <StatusIcon status={s.status} />
                    <div className="min-w-0 flex-1">
                      <div className={cn("text-[11px] font-semibold uppercase tracking-wide", L.color)}>{L.name}</div>
                      <div className="break-words font-medium">{s.title}</div>
                      <div className="text-sm text-muted-foreground">{s.detail}</div>
                      <StepData step={s} />
                      {s.approval_id && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg border border-warn/40 bg-warn/10 p-2.5">
                          {res ? (
                            <span className={cn("text-sm font-semibold", res === "approved" ? "text-ok" : "text-bad")}>
                              Owner {res} this request.
                            </span>
                          ) : (
                            <>
                              <span className="mr-auto text-sm font-medium">Owner approval needed:</span>
                              <Button size="sm" variant="outline" onClick={() => decide(s.approval_id!, "reject")}>
                                <XCircle /> Reject
                              </Button>
                              <Button size="sm" onClick={() => decide(s.approval_id!, "approve")}>
                                <CheckCircle /> Approve
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <h2 className="font-heading text-xl font-semibold">Outcome</h2>
          <Card className={cn("border-2 transition-colors", outcome ? (outcome.data_leaked ? "border-bad bg-bad/5" : "border-ok bg-ok/5") : "")}>
            <CardContent className="space-y-4 p-5">
              {!outcome ? (
                <div className="text-sm text-muted-foreground">{run && !done ? "Agent is working…" : "No run yet."}</div>
              ) : outcome.data_leaked ? (
                <div>
                  <div className="flex items-center gap-2 font-heading text-xl font-bold text-bad">
                    <Skull weight="fill" /> Data leaked
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {outcome.leaked_files.map((f) => f.split("/").pop()).join(", ")} reached the attacker
                    {outcome.attacker_inbox.length > 0 && " by email"}
                    {outcome.attacker_server.length > 0 && " and by upload to evil.com"}.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 font-heading text-xl font-bold text-ok">
                    <ShieldCheck weight="fill" /> No data left the company
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">The hijack attempt was stopped.</p>
                </div>
              )}
              {outcome && (
                <>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg bg-card p-2.5 shadow-sm">
                      <div className={cn("text-2xl font-bold tabular-nums", outcome.attacker_inbox.length ? "text-bad" : "text-ok")}>{outcome.attacker_inbox.length}</div>
                      <div className="text-[11px] text-muted-foreground">emails to attacker</div>
                    </div>
                    <div className="rounded-lg bg-card p-2.5 shadow-sm">
                      <div className={cn("text-2xl font-bold tabular-nums", outcome.attacker_server.length ? "text-bad" : "text-ok")}>{outcome.attacker_server.length}</div>
                      <div className="text-[11px] text-muted-foreground">uploads to evil.com</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-card p-2.5 text-sm shadow-sm">
                    <span className="text-muted-foreground">Summary reached finance</span>
                    <span className={cn("font-semibold", outcome.finance_inbox.length ? "text-ok" : "text-warn")}>
                      {outcome.finance_inbox.length ? "Yes" : outcome.pending_approvals.length ? "Waiting for approval" : "No"}
                    </span>
                  </div>
                  {outcome.agent && (
                    <div className="space-y-2">
                      <TrustMeter value={outcome.agent.trust} />
                      <div className="flex flex-wrap gap-1.5">
                        {outcome.agent.quarantined && <Badge className="bg-warn/15 text-warn hover:bg-warn/15">Quarantined</Badge>}
                        {outcome.agent.revoked && <Badge className="bg-bad/15 text-bad hover:bg-bad/15">Identity revoked</Badge>}
                        {outcome.agent.denied_count > 0 && (
                          <Badge variant="secondary">{outcome.agent.denied_count} blocked attempt{outcome.agent.denied_count > 1 ? "s" : ""}</Badge>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {Object.keys(history).length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="mb-2 text-sm font-semibold">Scoreboard</div>
                <table className="w-full text-sm">
                  <tbody>
                    {RUNS.filter((r) => history[r.n]).map((r) => (
                      <tr key={r.n} className="border-t first:border-0">
                        <td className="py-1.5 pr-2 text-muted-foreground">
                          {r.n}. {r.name}
                        </td>
                        <td className={cn("py-1.5 text-right font-semibold", history[r.n]!.leaked ? "text-bad" : "text-ok")}>
                          {history[r.n]!.leaked ? "Leaked" : `Stopped · ${history[r.n]!.stoppedBy}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-2 text-sm">
            <Link href="/audit" className="inline-flex items-center gap-1 text-primary hover:underline">
              See the full audit log <ArrowRight />
            </Link>
            <Link href="/policies" className="inline-flex items-center gap-1 text-primary hover:underline">
              Edit the agent&apos;s permissions <ArrowRight />
            </Link>
            <Link href="/shield" className="inline-flex items-center gap-1 text-primary hover:underline">
              Try the shield on your own text <ArrowRight />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
