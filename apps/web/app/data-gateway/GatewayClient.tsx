"use client"

import { useEffect, useRef, useState } from "react"
import {
  ArrowCounterClockwise,
  CheckCircle,
  Database,
  Fingerprint,
  Info,
  Key,
  LockKey,
  PaperPlaneRight,
  PauseCircle,
  Prohibit,
  Robot,
  ShieldCheck,
  Warning,
  XCircle,
} from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type StepStatus = "ok" | "info" | "warn" | "blocked" | "error"
type Layer = "identity" | "request" | "sql" | "policy" | "sandbox" | "agent"
type TraceStep = { layer: Layer; status: StepStatus; title: string; detail: string; data?: any; ms?: number }

type AgentInfo = {
  id: string
  name: string
  department: string
  description: string
  registered: boolean
  model: { provider: string; label: string }
  connected: boolean
  connect: ConnectResult | null
  policy: { allow: string[]; deny?: string[]; denyColumns?: string[]; maxRows?: number } | null
  tables: { table: string; allowed: boolean; hidden_columns: string[] }[]
}
type ConnectResult = { ok: boolean; reason?: string; access_id?: string; expires_at?: string; scopes?: string[]; solved_in_seconds?: number; trace: TraceStep[] }
type QueryResult = {
  decision: "allowed" | "blocked" | "error"
  stopped_at?: Layer
  reason: string
  risk?: { score: number; verdict: string; reasons: string[] }
  sql_submitted?: string
  sql_executed?: string
  columns?: string[]
  rows?: Record<string, unknown>[]
  row_count?: number
  trace: TraceStep[]
  agent_trace: TraceStep[]
}
type AuditEntry = { id: string; ts: string; agent_id: string; event: string; decision: string; stopped_at?: string; reason: string; question?: string }
type DemoState = {
  agents: AgentInfo[]
  database: { table: string; columns: string[]; description: string }[]
  sandbox: { kind: string; limits: string[] }
  audit: AuditEntry[]
  questions: Record<string, { label: string; question: string; expect: "allowed" | "blocked" }[]>
  model_note: string | null
}

const API = "/api/agentwarden/demo"

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok && (json as any)?.error) throw new Error((json as any).error)
  return json as T
}

const LAYER: Record<Layer, { label: string; color: string; border: string }> = {
  identity: { label: "Step 1 · Identity", color: "text-l1", border: "hsl(var(--l1))" },
  agent: { label: "Agent's AI model", color: "text-primary", border: "hsl(var(--primary))" },
  request: { label: "Step 2 · Request risk", color: "text-l2", border: "hsl(var(--l2))" },
  sql: { label: "Step 3 · SQL check", color: "text-l3", border: "hsl(var(--l3))" },
  policy: { label: "Step 3 · Permissions", color: "text-l3", border: "hsl(var(--l3))" },
  sandbox: { label: "Step 3 · Sandbox", color: "text-l3", border: "hsl(var(--l3))" },
}

const STEPS = [
  { icon: Fingerprint, layer: "l1", title: "Prove identity", text: "Only registered agents get a puzzle. Solve it in 30 seconds with your own AI model to get a 15-minute access ID." },
  { icon: ShieldCheck, layer: "l2", title: "Score the request", text: "The plain-English request is scored for misuse: bulk personal data, deleting data, secrets, rule-bending." },
  { icon: LockKey, layer: "l3", title: "Check SQL, run in a sandbox", text: "The AI-written SQL is parsed and checked against the department's permissions, then runs read-only as that agent's own database role." },
]

function StatusIcon({ status }: { status: StepStatus }) {
  const cls = "h-5 w-5 shrink-0"
  if (status === "ok") return <CheckCircle className={cn(cls, "text-ok")} weight="fill" />
  if (status === "warn") return <PauseCircle className={cn(cls, "text-warn")} weight="fill" />
  if (status === "blocked") return <Prohibit className={cn(cls, "text-bad")} weight="bold" />
  if (status === "error") return <Warning className={cn(cls, "text-bad")} weight="fill" />
  return <Info className={cn(cls, "text-muted-foreground")} weight="fill" />
}

function TraceList({ steps }: { steps: TraceStep[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => {
        const L = LAYER[s.layer]
        return (
          <li
            key={i}
            className="animate-in fade-in slide-in-from-bottom-1 rounded-xl border border-l-4 bg-card p-3"
            style={{ borderLeftColor: L.border, animationDelay: `${i * 70}ms`, animationFillMode: "backwards" }}
          >
            <div className="flex items-start gap-3">
              <StatusIcon status={s.status} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className={cn("text-[11px] font-semibold uppercase tracking-wide", L.color)}>{L.label}</span>
                  {s.ms !== undefined && <span className="text-[11px] tabular-nums text-muted-foreground">{s.ms} ms</span>}
                </div>
                <div className="break-words font-medium">{s.title}</div>
                {s.layer === "agent" && s.title.includes("wrote SQL") ? (
                  <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-muted px-2.5 py-2 font-mono text-xs">{s.detail}</pre>
                ) : (
                  <div className="break-words text-sm text-muted-foreground">{s.detail}</div>
                )}
                {s.data?.instructions && (
                  <details className="mt-1 text-xs text-muted-foreground">
                    <summary className="cursor-pointer">Show the puzzle</summary>
                    <ol className="mt-1 space-y-0.5">
                      {s.data.instructions.map((x: string) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ol>
                  </details>
                )}
                {s.data?.steps && (
                  <code className="mt-1 block break-words text-[11px] text-muted-foreground">{JSON.stringify(s.data.steps)}</code>
                )}
                {s.data?.access_id && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <code className="rounded bg-l1/10 px-1.5 py-0.5 text-[11px] text-l1">access ID {s.data.access_id.slice(0, 8)}…</code>
                    {s.data.scopes?.map((sc: string) => (
                      <code key={sc} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {sc}
                      </code>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function ResultTable({ columns, rows }: { columns: string[]; rows: Record<string, unknown>[] }) {
  const fmt = (v: unknown) => {
    if (v === null || v === undefined) return "—"
    const n = Number(v)
    if (typeof v !== "boolean" && v !== "" && Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(String(v))) return n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
    return String(v)
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr>
            {columns.map((c) => (
              <th key={c} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              {columns.map((c) => (
                <td key={c} className="whitespace-nowrap px-3 py-1.5 tabular-nums">
                  {fmt(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function GatewayClient() {
  const [state, setState] = useState<DemoState | null>(null)
  const [agentId, setAgentId] = useState("finance-analyst")
  const [question, setQuestion] = useState("")
  const [busy, setBusy] = useState<"connect" | "ask" | null>(null)
  const [connectTrace, setConnectTrace] = useState<TraceStep[] | null>(null)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const resultsRef = useRef<HTMLDivElement | null>(null)

  async function refresh() {
    try {
      setState(await api<DemoState>("/state"))
    } catch (e) {
      setError((e as Error).message)
    }
  }
  useEffect(() => {
    refresh()
  }, [])

  const agent = state?.agents.find((a) => a.id === agentId) ?? null
  const questions = state?.questions[agentId] ?? []

  function pickAgent(id: string) {
    if (busy) return
    setAgentId(id)
    setQuestion("")
    setResult(null)
    setConnectTrace(null)
    setError(null)
  }

  async function connect() {
    setBusy("connect")
    setError(null)
    setResult(null)
    try {
      const r = await api<ConnectResult>("/connect", { agent: agentId })
      setConnectTrace(r.trace)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function ask() {
    if (!question.trim()) {
      setError("Type a question or pick an example first.")
      return
    }
    setBusy("ask")
    setError(null)
    setResult(null)
    try {
      const r = await api<{ connect: ConnectResult | null; result: QueryResult }>("/ask", { agent: agentId, question })
      setConnectTrace(r.connect ? r.connect.trace : null)
      setResult(r.result)
      await refresh()
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function reset() {
    setBusy("connect")
    try {
      setState(await api<DemoState>("/reset", {}))
      setResult(null)
      setConnectTrace(null)
    } finally {
      setBusy(null)
    }
  }

  const fullTrace = result ? [...result.trace.filter((s) => s.layer === "identity").slice(0, 1), ...result.agent_trace, ...result.trace.filter((s, i) => !(s.layer === "identity" && i === 0))] : []

  return (
    <div className="container max-w-screen-xl space-y-8 py-10">
      <section className="space-y-3">
        <Badge className="bg-l3/15 text-l3 hover:bg-l3/15">
          <Database className="mr-1" weight="fill" /> Department data gateway
        </Badge>
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          One department&apos;s AI agent wants another department&apos;s data. <span className="text-primary">Should it get it?</span>
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          Each agent asks in plain English. Its own AI model writes the SQL. AgentWarden decides, in three steps, whether that SQL may touch the
          company database, and the database enforces the same rules again.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {STEPS.map(({ icon: Icon, layer, title, text }, i) => (
          <Card key={title} className="min-w-0">
            <CardContent className="flex gap-3 p-4">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", `bg-${layer}/10`)}>
                <Icon className={cn("h-5 w-5", `text-${layer}`)} weight="duotone" />
              </div>
              <div>
                <div className={cn("text-xs font-semibold uppercase tracking-wide", `text-${layer}`)}>Step {i + 1}</div>
                <div className="font-heading font-semibold">{title}</div>
                <p className="mt-0.5 text-sm text-muted-foreground">{text}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {state?.model_note && (
        <div className="flex items-start gap-2 rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warn" weight="fill" />
          <span>
            {state.model_note} Add <code>GEMINI_API_KEY</code> to <code>apps/web/.env.local</code> and restart to use Gemini for any question.
          </span>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-xl font-semibold">1. Pick an agent</h2>
          <Button variant="ghost" size="sm" onClick={reset} disabled={busy !== null}>
            <ArrowCounterClockwise /> Reset demo
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {state?.agents.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => pickAgent(a.id)}
              className={cn(
                "min-w-0 rounded-xl border-2 p-4 text-left transition-colors",
                a.id === agentId ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Robot className={cn("h-6 w-6", a.registered ? "text-primary" : "text-bad")} weight="duotone" />
                  <div>
                    <div className="font-heading font-semibold">{a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.registered ? `${a.department} department` : "no department"}</div>
                  </div>
                </div>
                {a.registered ? (
                  <span className="rounded-full bg-ok/15 px-2 py-0.5 text-[11px] font-semibold text-ok">Registered</span>
                ) : (
                  <span className="rounded-full bg-bad/15 px-2 py-0.5 text-[11px] font-semibold text-bad">Not registered</span>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{a.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium">Model: {a.model.label}</span>
                {a.connected ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-l1/10 px-1.5 py-0.5 font-medium text-l1">
                    <Key weight="fill" /> Access ID active
                  </span>
                ) : (
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground">No access ID</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-5">
        <div className="min-w-0 space-y-4 lg:col-span-3">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-heading text-xl font-semibold">2. Ask in plain English</h2>
                <Button variant="outline" size="sm" onClick={connect} disabled={busy !== null || !agent}>
                  <Fingerprint /> {busy === "connect" ? "Solving puzzle…" : agent?.connected ? "Get a new access ID" : "Connect (solve puzzle)"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {questions.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => {
                      setQuestion(q.question)
                      setError(null)
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:border-primary/50",
                      question === q.question ? "border-primary bg-primary text-primary-foreground" : "bg-card"
                    )}
                  >
                    {q.label}
                    <span className={cn("ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle", q.expect === "allowed" ? "bg-ok" : "bg-bad")} />
                  </button>
                ))}
              </div>
              <div>
                <label htmlFor="aw-question" className="sr-only">
                  Question for the agent
                </label>
                <textarea
                  id="aw-question"
                  value={question}
                  onChange={(e) => {
                    setQuestion(e.target.value)
                    setError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask()
                  }}
                  rows={3}
                  maxLength={1000}
                  placeholder={`Ask ${agent?.name ?? "the agent"} something, e.g. "What was our revenue by segment in Q1 2026?"`}
                  className="w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    Green dot: should be allowed · red dot: should be stopped. Ctrl+Enter to send.
                  </span>
                  <Button onClick={ask} disabled={busy !== null}>
                    <PaperPlaneRight weight="fill" /> {busy === "ask" ? "Working…" : "Ask"}
                  </Button>
                </div>
                {error && <p className="mt-2 text-sm text-bad">{error}</p>}
              </div>
            </CardContent>
          </Card>

          <div ref={resultsRef} className="scroll-mt-24 space-y-3">
            {(connectTrace || result) && <h2 className="font-heading text-xl font-semibold">3. What happened</h2>}
            {result && (
              <Card className={cn("border-2", result.decision === "allowed" ? "border-ok bg-ok/5" : "border-bad bg-bad/5")}>
                <CardContent className="flex items-start gap-3 p-4">
                  {result.decision === "allowed" ? (
                    <ShieldCheck className="h-7 w-7 shrink-0 text-ok" weight="fill" />
                  ) : (
                    <XCircle className="h-7 w-7 shrink-0 text-bad" weight="fill" />
                  )}
                  <div className="min-w-0">
                    <div className={cn("font-heading text-lg font-bold", result.decision === "allowed" ? "text-ok" : "text-bad")}>
                      {result.decision === "allowed"
                        ? `Allowed: ${result.row_count} row(s) returned`
                        : `Stopped at ${result.stopped_at ? LAYER[result.stopped_at].label : "the gateway"}`}
                    </div>
                    <p className="break-words text-sm text-muted-foreground">{result.reason}</p>
                  </div>
                </CardContent>
              </Card>
            )}
            {connectTrace && <TraceList steps={connectTrace} />}
            {result && <TraceList steps={fullTrace} />}
            {result?.decision === "allowed" && result.columns && result.rows && (
              <div className="space-y-2">
                <ResultTable columns={result.columns} rows={result.rows} />
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">SQL that actually ran</summary>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-md bg-muted p-2 font-mono">{result.sql_executed}</pre>
                </details>
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Card>
            <CardContent className="space-y-3 p-5">
              <h3 className="font-heading font-semibold">What {agent?.name ?? "this agent"} may read</h3>
              {!agent?.registered && (
                <p className="text-sm text-muted-foreground">Nothing. It is not registered, so it never gets an access ID.</p>
              )}
              <ul className="space-y-1.5">
                {agent?.tables.map((t) => (
                  <li key={t.table} className="flex items-start justify-between gap-2 text-sm">
                    <code className={cn("break-all text-xs", t.allowed ? "text-foreground" : "text-muted-foreground line-through")}>{t.table}</code>
                    <span className="shrink-0 text-right text-[11px]">
                      {t.allowed ? (
                        t.hidden_columns.length ? (
                          <span className="text-warn">read, hides {t.hidden_columns.join(", ")}</span>
                        ) : (
                          <span className="text-ok">read</span>
                        )
                      ) : (
                        <span className="text-bad">denied</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {agent?.policy && <p className="text-xs text-muted-foreground">Max {agent.policy.maxRows ?? 200} rows per query. Anything not listed is denied.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-5">
              <h3 className="font-heading font-semibold">Sandbox ({state?.sandbox.kind})</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {state?.sandbox.limits.map((l) => (
                  <li key={l} className="flex gap-2">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-ok" weight="fill" /> {l}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-5">
              <h3 className="font-heading font-semibold">Audit log</h3>
              {!state?.audit.length && <p className="text-sm text-muted-foreground">No requests yet.</p>}
              <ul className="space-y-2">
                {state?.audit.map((e) => (
                  <li key={e.id} className="text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {e.agent_id} · {e.event}
                      </span>
                      <span className={cn("rounded px-1.5 py-0.5 font-semibold", e.decision === "allowed" ? "bg-ok/15 text-ok" : "bg-bad/15 text-bad")}>
                        {e.decision}
                      </span>
                    </div>
                    <div className="break-words text-muted-foreground">{e.question ? `“${e.question}” · ` : ""}{e.reason}</div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
