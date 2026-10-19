"use client"

import { useEffect, useState } from "react"
import { CheckCircle, CircleNotch, Fingerprint, LockKey, Prohibit, ShieldCheck, Warning } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

type StepStatus = "ok" | "info" | "warn" | "blocked" | "error"
type Layer = "identity" | "request" | "sql" | "policy" | "sandbox" | "agent"
export type TraceStep = { layer: Layer; status: StepStatus; title: string; detail: string; data?: any; ms?: number }
export type PhaseResult = {
  decision: "allowed" | "blocked" | "error"
  stopped_at?: Layer
  reason: string
  risk?: { score: number; verdict: string; reasons: string[] }
  row_count?: number
  trace: TraceStep[]
  agent_trace: TraceStep[]
}

type PhaseState = "waiting" | "checking" | "passed" | "warned" | "blocked" | "skipped"
type PuzzleStep = { type: "slice_reverse_xor" | "slice_not"; start: number; end: number; xor_key?: number }

const PHASES = [
  { key: "identity", n: 1, title: "Prove identity", sub: "Solve the puzzle in 30 s", icon: Fingerprint, text: "text-l1", bg: "bg-l1", soft: "bg-l1/10", border: "border-l1" },
  { key: "request", n: 2, title: "Score the request", sub: "Is the question risky?", icon: ShieldCheck, text: "text-l2", bg: "bg-l2", soft: "bg-l2/10", border: "border-l2" },
  { key: "sql", n: 3, title: "Check SQL & run", sub: "Permissions + sandbox", icon: LockKey, text: "text-l3", bg: "bg-l3", soft: "bg-l3/10", border: "border-l3" },
] as const

const STEP_COLORS = ["bg-l1/30 ring-l1", "bg-l2/30 ring-l2", "bg-l3/30 ring-l3", "bg-warn/30 ring-warn", "bg-primary/30 ring-primary"]
const REVEAL_MS = 1100

/** Final state of each phase, from the connect trace (puzzle) and the query result. */
function finalStates(connect: TraceStep[] | null, result: PhaseResult | null): [PhaseState, PhaseState, PhaseState] {
  const connectBlocked = connect?.some((s) => s.status === "blocked" || s.status === "error") ?? false
  const idOk = connect?.some((s) => s.layer === "identity" && s.status === "ok") || result?.trace.some((s) => s.layer === "identity" && s.status === "ok")
  const p1: PhaseState = connectBlocked || result?.stopped_at === "identity" ? "blocked" : idOk ? "passed" : "waiting"
  if (p1 === "blocked") return [p1, "skipped", "skipped"]
  if (!result) return [p1, "waiting", "waiting"]
  const req = result.trace.find((s) => s.layer === "request")
  const p2: PhaseState = !req ? "skipped" : req.status === "blocked" ? "blocked" : req.status === "warn" ? "warned" : "passed"
  if (p2 === "blocked") return [p1, p2, "skipped"]
  const p3: PhaseState = result.decision === "allowed" ? "passed" : "blocked"
  return [p1, p2, p3]
}

export function PhaseTracker({
  busy,
  connectTrace,
  earlierPuzzle,
  result,
  question,
  runId,
}: {
  busy: boolean
  question: string
  connectTrace: TraceStep[] | null
  /** Puzzle from an earlier connect, shown when this question reused a valid access ID. */
  earlierPuzzle: TraceStep[] | null
  result: PhaseResult | null
  runId: number
}) {
  const [revealed, setRevealed] = useState(3)
  const [elapsed, setElapsed] = useState(0)

  // Replay: open the phases one by one so the audience can follow along.
  const [replays, setReplays] = useState(0)
  useEffect(() => {
    if (busy || runId === 0) return
    setRevealed(0)
    const timers = [1, 2, 3].map((n) => setTimeout(() => setRevealed(n), n * REVEAL_MS))
    return () => timers.forEach(clearTimeout)
  }, [runId, busy, replays])

  // While the agent is working, tick a clock against the 30 s puzzle limit.
  useEffect(() => {
    if (!busy) return
    const t0 = performance.now()
    setElapsed(0)
    const id = setInterval(() => setElapsed((performance.now() - t0) / 1000), 100)
    return () => clearInterval(id)
  }, [busy])

  const puzzleTrace = connectTrace ?? earlierPuzzle
  const reused = !connectTrace && !!earlierPuzzle && !!result
  const finals = finalStates(connectTrace ?? (result ? null : earlierPuzzle), result)
  const states: PhaseState[] = busy
    ? ["checking", "waiting", "waiting"]
    : finals.map((f, i) => (i < revealed ? f : i === revealed && f !== "waiting" && f !== "skipped" ? "checking" : "waiting"))

  const puzzle = puzzleTrace?.find((s) => s.data?.instructions)?.data as
    | { instructions: string[]; time_limit_seconds?: number; bytes_hex?: string; nonce?: string }
    | undefined
  const solved = puzzleTrace?.find((s) => s.layer === "agent")
  const solveData = solved?.data as { steps?: PuzzleStep[]; answer?: string; hmac?: string } | undefined
  const issued = puzzleTrace?.find((s) => s.layer === "identity" && s.status === "ok")
  const refused = puzzleTrace?.find((s) => s.status === "blocked" || s.status === "error")
  const limit = puzzle?.time_limit_seconds ?? 30
  const solvedIn = Number(/solved in ([\d.]+)s/.exec(issued?.title ?? "")?.[1] ?? NaN)

  const reqStep = result?.trace.find((s) => s.layer === "request")
  const sqlWritten = result?.agent_trace.find((s) => s.title.includes("SQL"))
  const p3Steps = result?.trace.filter((s) => s.layer === "sql" || s.layer === "policy" || s.layer === "sandbox") ?? []

  const current = states.findIndex((s) => s === "checking")
  const headline = busy
    ? "Phase 1 · The agent is asking for a puzzle and solving it…"
    : current >= 0
      ? `Phase ${current + 1} · ${PHASES[current]!.title}…`
      : result
        ? result.decision === "allowed"
          ? `Done · all 3 phases passed, ${result.row_count} row(s) returned`
          : `Stopped in phase ${finals.findIndex((f) => f === "blocked") + 1} · ${PHASES[Math.max(0, finals.findIndex((f) => f === "blocked"))]!.title}`
        : finals[0] === "passed"
          ? "Phase 1 passed · the agent has an access ID. Ask a question for phases 2 and 3."
          : finals[0] === "blocked"
            ? "Stopped in phase 1 · Prove identity"
            : "Waiting for an agent"

  return (
    <div className="space-y-4">
      {/* ── Stepper ── */}
      <div className="rounded-2xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold" aria-live="polite">
            {headline}
          </div>
          {!busy && runId > 0 && revealed >= 3 && (
            <button type="button" onClick={() => setReplays((n) => n + 1)} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
              Replay
            </button>
          )}
        </div>
        <ol className="flex flex-col items-stretch gap-2 sm:flex-row">
          {PHASES.map((p, i) => {
            const st = states[i]!
            const Icon = p.icon
            return (
              <li key={p.key} className="flex min-w-0 flex-1 items-center gap-2">
                <div
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 rounded-xl border-2 p-2.5 transition-all duration-500",
                    st === "waiting" && "border-dashed border-border opacity-50",
                    st === "checking" && cn(p.border, p.soft, "shadow-lg"),
                    st === "passed" && "border-ok bg-ok/10",
                    st === "warned" && "border-warn bg-warn/10",
                    st === "blocked" && "border-bad bg-bad/10",
                    st === "skipped" && "border-dashed border-border opacity-40"
                  )}
                >
                  <div className={cn("relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white", st === "passed" ? "bg-ok" : st === "warned" ? "bg-warn" : st === "blocked" ? "bg-bad" : st === "checking" ? p.bg : "bg-muted-foreground/40")}>
                    {st === "checking" ? (
                      <CircleNotch className="h-5 w-5 animate-spin" weight="bold" />
                    ) : st === "passed" ? (
                      <CheckCircle className="h-5 w-5" weight="fill" />
                    ) : st === "warned" ? (
                      <Warning className="h-5 w-5" weight="fill" />
                    ) : st === "blocked" ? (
                      <Prohibit className="h-5 w-5" weight="bold" />
                    ) : (
                      <Icon className="h-5 w-5" weight="bold" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className={cn("text-[10px] font-bold uppercase tracking-wider", p.text)}>Phase {p.n}</div>
                    <div className="text-sm font-semibold leading-tight">{p.title}</div>
                    <div className="text-[11px] leading-tight text-muted-foreground">
                      {st === "checking" ? "checking…" : st === "passed" ? "passed" : st === "warned" ? "passed with a warning" : st === "blocked" ? "STOPPED here" : st === "skipped" ? "not reached" : p.sub}
                    </div>
                  </div>
                </div>
                {i < 2 && <div className={cn("hidden h-0.5 w-4 shrink-0 sm:block", states[i + 1] !== "waiting" && states[i + 1] !== "skipped" ? "bg-ok" : "bg-border")} />}
              </li>
            )
          })}
        </ol>
      </div>

      {/* ── Phase 1: the puzzle ── */}
      {(busy || puzzleTrace) && (
        <PhaseCard n={1} state={states[0]!}>
          {busy && !puzzle ? (
            <div className="space-y-2">
              <p className="text-sm">The gateway sends 256 random bytes and instructions in plain English. The agent&apos;s own AI model must turn them into byte operations and answer within {limit} seconds.</p>
              <Timer seconds={elapsed} limit={limit} live />
            </div>
          ) : refused && !puzzle ? (
            <p className="text-sm">
              <span className="font-semibold text-bad">{refused.title}.</span> {refused.detail}
            </p>
          ) : puzzle ? (
            <div className="space-y-3">
              {reused && <p className="rounded-md bg-muted px-2.5 py-1.5 text-xs">This agent already had a valid access ID, so it did not need a new puzzle. Below is the puzzle it solved earlier.</p>}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="min-w-0 space-y-1.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">① The puzzle (instructions)</div>
                  <ol className="space-y-1 text-sm">
                    {puzzle.instructions.map((x, i) => (
                      <li key={x} className="flex gap-2">
                        <span className={cn("mt-0.5 h-4 w-4 shrink-0 rounded-sm ring-1", i < (solveData?.steps?.length ?? 0) ? STEP_COLORS[i % STEP_COLORS.length] : "bg-muted ring-border")} />
                        <span className="min-w-0 break-words">{x}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                {puzzle.bytes_hex && <ByteGrid hex={puzzle.bytes_hex} steps={solveData?.steps ?? []} />}
              </div>
              {solved && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">② What the agent&apos;s AI understood</div>
                  <div className="flex flex-wrap gap-1.5">
                    {solveData?.steps?.map((s, i) => (
                      <code key={i} className={cn("rounded px-1.5 py-0.5 text-[11px] ring-1", STEP_COLORS[i % STEP_COLORS.length])}>
                        bytes {s.start}–{s.end - 1}: {s.type === "slice_not" ? "flip all bits (NOT)" : `reverse, then XOR 0x${(s.xor_key ?? 0).toString(16).padStart(2, "0")}`}
                      </code>
                    ))}
                    {solved.status !== "ok" && <span className="text-sm text-bad">{solved.detail}</span>}
                  </div>
                </div>
              )}
              {solveData?.answer && (
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">③ Answer sent back</div>
                  <code className="block break-all rounded bg-muted px-2 py-1 font-mono text-[11px]">SHA-256 {solveData.answer}</code>
                </div>
              )}
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">④ Gateway&apos;s decision</div>
                {issued ? (
                  <>
                    <Timer seconds={Number.isFinite(solvedIn) ? solvedIn : 0} limit={limit} />
                    <p className="text-sm">
                      <span className="font-semibold text-ok">{issued.title}.</span> {issued.detail}
                      {issued.data?.access_id && <code className="ml-1.5 rounded bg-l1/10 px-1.5 py-0.5 text-[11px] text-l1">access ID {String(issued.data.access_id).slice(0, 8)}…</code>}
                    </p>
                  </>
                ) : refused ? (
                  <p className="text-sm">
                    <span className="font-semibold text-bad">{refused.title}.</span> {refused.detail}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </PhaseCard>
      )}

      {/* ── Phase 2: request risk ── */}
      {result && states[1] !== "waiting" && (
        <PhaseCard n={2} state={states[1]!}>
          {states[1] === "skipped" || !reqStep ? (
            <p className="text-sm text-muted-foreground">Not reached: the agent was stopped in phase 1.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm">
                Question: <span className="font-medium">&ldquo;{question}&rdquo;</span>
              </p>
              {result.risk && <RiskBar score={result.risk.score} />}
              <p className="text-sm text-muted-foreground">{reqStep.detail}</p>
            </div>
          )}
        </PhaseCard>
      )}

      {/* ── Phase 3: SQL, permissions, sandbox ── */}
      {result && states[2] !== "waiting" && (
        <PhaseCard n={3} state={states[2]!}>
          {states[2] === "skipped" ? (
            <p className="text-sm text-muted-foreground">Not reached: the request was stopped in an earlier phase.</p>
          ) : (
            <div className="space-y-2">
              {sqlWritten && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">SQL written by the agent&apos;s AI</div>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-muted px-2.5 py-2 font-mono text-xs">{sqlWritten.detail}</pre>
                </div>
              )}
              <ul className="space-y-1.5">
                {p3Steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    {s.status === "ok" ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-ok" weight="fill" /> : <Prohibit className="mt-0.5 h-4 w-4 shrink-0 text-bad" weight="bold" />}
                    <span className="min-w-0 break-words">
                      <span className="font-medium">{s.title}</span> <span className="text-muted-foreground">— {s.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </PhaseCard>
      )}
    </div>
  )
}

function PhaseCard({ n, state, children }: { n: 1 | 2 | 3; state: PhaseState; children: React.ReactNode }) {
  const p = PHASES[n - 1]!
  const Icon = p.icon
  return (
    <section
      className={cn(
        "animate-in fade-in slide-in-from-bottom-2 rounded-2xl border-2 bg-card p-4 duration-500",
        state === "passed" ? "border-ok/50" : state === "warned" ? "border-warn/60" : state === "blocked" ? "border-bad/60" : state === "checking" ? p.border : "border-border"
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", p.soft)}>
          <Icon className={cn("h-5 w-5", p.text)} weight="duotone" />
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn("text-[10px] font-bold uppercase tracking-wider", p.text)}>Phase {n}</div>
          <div className="font-heading font-semibold">{p.title}</div>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
            state === "passed" && "bg-ok/15 text-ok",
            state === "warned" && "bg-warn/15 text-warn",
            state === "blocked" && "bg-bad/15 text-bad",
            state === "checking" && cn(p.soft, p.text),
            (state === "skipped" || state === "waiting") && "bg-muted text-muted-foreground"
          )}
        >
          {state === "checking" ? "checking…" : state === "passed" ? "PASSED" : state === "warned" ? "PASSED (warning)" : state === "blocked" ? "STOPPED" : "not reached"}
        </span>
      </div>
      {state === "checking" && n !== 1 ? <p className="text-sm text-muted-foreground">Checking…</p> : children}
    </section>
  )
}

function Timer({ seconds, limit, live = false }: { seconds: number; limit: number; live?: boolean }) {
  const pct = Math.min(100, (seconds / limit) * 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>{live ? "Time used" : "Solved in"}: {seconds.toFixed(seconds < 1 ? 2 : 1)} s</span>
        <span>limit {limit} s</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", pct > 80 ? "bg-bad" : "bg-l1")} style={{ width: `${Math.max(pct, 1.5)}%` }} />
      </div>
    </div>
  )
}

function RiskBar({ score }: { score: number }) {
  return (
    <div className="space-y-1">
      <div className="relative h-3 overflow-hidden rounded-full" style={{ background: "linear-gradient(90deg, hsl(var(--ok)) 0 45%, hsl(var(--warn)) 45% 75%, hsl(var(--bad)) 75% 100%)" }}>
        <div className="absolute top-1/2 h-5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow ring-2 ring-background" style={{ left: `${Math.min(100, Math.max(0, score * 100))}%` }} />
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>safe</span>
        <span className="font-semibold tabular-nums text-foreground">risk {score.toFixed(2)}</span>
        <span>blocked ≥ 0.75</span>
      </div>
    </div>
  )
}

function ByteGrid({ hex, steps }: { hex: string; steps: PuzzleStep[] }) {
  const bytes = hex.match(/../g) ?? []
  const stepOf = (i: number) => steps.findIndex((s) => i >= s.start && i < s.end)
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">The 256 random bytes</div>
      <div className="grid gap-px rounded-md bg-border p-px font-mono text-[9px] leading-none" style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}>
        {bytes.map((b, i) => {
          const s = stepOf(i)
          return (
            <span key={i} title={`byte ${i}`} className={cn("flex aspect-square items-center justify-center bg-card text-muted-foreground", s >= 0 && cn(STEP_COLORS[s % STEP_COLORS.length], "font-semibold text-foreground"))}>
              {b}
            </span>
          )
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">Coloured bytes are the ones the instructions tell the agent to change.</p>
    </div>
  )
}
