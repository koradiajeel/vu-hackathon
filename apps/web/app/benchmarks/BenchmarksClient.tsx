"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  ArrowsClockwise, ArrowRight, ChartBar, Lightning,
  SpinnerGap, Target, Terminal, Trophy, Timer,
} from "@phosphor-icons/react"
import * as motion from "motion/react-client"

type BenchmarkReport = {
  id: string
  model_id: string
  framework: string
  agent_name: string
  agent_version: string
  runs: number
  successes: number
  avg_ms: number
  p95_ms: number
  created_at: string
}

const API_BASE = process.env.NEXT_PUBLIC_CAPAGENT_API_BASE_URL ?? "http://127.0.0.1:8787"

export function BenchmarksClient({ initialReports }: { initialReports: BenchmarkReport[] }) {
  const [reports, setReports] = useState<BenchmarkReport[]>(initialReports)
  const [isPending, startTransition] = useTransition()

  function refresh() {
    startTransition(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/benchmarks`, { cache: "no-store" })
        if (res.ok) {
          const json = (await res.json()) as { reports?: BenchmarkReport[] }
          setReports(json.reports ?? [])
        }
      } catch {
        // silent — keep existing data on failure
      }
    })
  }

  const displayedReports = reports.filter(r => r.runs >= 50)
  const totalRuns = displayedReports.reduce((a, r) => a + r.runs, 0)
  const totalSuccesses = displayedReports.reduce((a, r) => a + r.successes, 0)
  const overallSuccessRate = totalRuns > 0 ? Math.round((totalSuccesses / totalRuns) * 100) : 0
  const fastestModel =
    displayedReports.length > 0
      ? displayedReports.reduce((best, r) => (r.avg_ms < best.avg_ms && r.runs > 0 ? r : best), displayedReports[0]!)
      : null

  const sorted = [...displayedReports].sort((a, b) => {
    const aRate = a.runs > 0 ? a.successes / a.runs : 0
    const bRate = b.runs > 0 ? b.successes / b.runs : 0
    return bRate !== aRate ? bRate - aRate : a.avg_ms - b.avg_ms
  })

  const maxAvg = sorted.reduce((max, m) => (m.avg_ms > max ? m.avg_ms : max), 1)

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Trophy className="h-3 w-3" /> Leaderboard
        </div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Agent Performance Leaderboard
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Which AI model solves AgentWarden challenges fastest and most reliably? Each model gets one
          entry that accumulates over time. Ranked by success rate, then speed.
        </p>
      </div>

      {displayedReports.length > 0 && (
        <div className="mt-10 grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <ChartBar className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums">{displayedReports.length}</p>
                <p className="text-[11px] text-muted-foreground">Models Tested</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Terminal className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums">{totalRuns}</p>
                <p className="text-[11px] text-muted-foreground">Total Runs</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                <Target className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums">{overallSuccessRate}%</p>
                <p className="text-[11px] text-muted-foreground">Overall Success</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Timer className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums">
                  {fastestModel ? `${fastestModel.avg_ms.toFixed(0)}ms` : "—"}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  Fastest{fastestModel ? `: ${fastestModel.model_id.replace(" [Stability]", "").replace(" [Baseline]", "").split("/").pop()}` : ""}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Rankings</CardTitle>
              <CardDescription>Live model rankings from verified challenge runs.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={refresh} disabled={isPending} aria-label="Refresh leaderboard">
              {isPending ? <SpinnerGap className="h-4 w-4 animate-spin" /> : <ArrowsClockwise className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                <Lightning className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">No benchmark data yet</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Run a sample agent or integrate the SDK. Each successful verification automatically
                  creates or updates this model&apos;s leaderboard entry.
                </p>
              </div>
              <Button asChild size="sm" className="gap-1.5">
                <Link href="/docs">
                  Integration Guide <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              {sorted.map((m, i) => {
                const successRate = m.runs > 0 ? Math.round((m.successes / m.runs) * 100) : 0
                const speedScore = Math.max(5, Math.min(100, (1000 / m.avg_ms) * 100))
                const barColor =
                  successRate >= 90 ? "from-emerald-500 to-emerald-400"
                  : successRate >= 70 ? "from-emerald-600 to-emerald-500"
                  : successRate >= 50 ? "from-amber-500 to-amber-400"
                  : "from-red-500 to-red-400"
                const rankBadge =
                  i === 0 ? "bg-amber-500/10 text-amber-500"
                  : i === 1 ? "bg-neutral-300/10 text-neutral-400"
                  : i === 2 ? "bg-orange-500/10 text-orange-500"
                  : "bg-muted text-muted-foreground"

                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums ${rankBadge}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <span className="font-mono text-sm font-semibold truncate block">
                              {m.model_id.replace(" [Stability]", "").replace(" [Baseline]", "")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {m.framework} &middot; {m.agent_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-5 shrink-0">
                            <div className="text-right">
                              <p className="text-sm font-bold tabular-nums">{successRate}%</p>
                              <p className="text-[10px] text-muted-foreground">success</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold tabular-nums">{Math.min(100, m.runs)}</p>
                              <p className="text-[10px] text-muted-foreground">runs</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold tabular-nums">
                                {m.avg_ms.toFixed(0)}<span className="text-xs font-normal text-muted-foreground">ms</span>
                              </p>
                              <p className="text-[10px] text-muted-foreground">avg</p>
                            </div>
                            <div className="text-right hidden sm:block">
                              <p className="text-sm font-bold tabular-nums">
                                {m.p95_ms.toFixed(0)}<span className="text-xs font-normal text-muted-foreground">ms</span>
                              </p>
                              <p className="text-[10px] text-muted-foreground">p95</p>
                            </div>
                          </div>
                        </div>
                        <div
                          className="h-2 rounded-full bg-muted"
                          role="progressbar"
                          aria-valuenow={speedScore}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Speed score: ${speedScore}%`}
                        >
                          <div
                            className={`h-2 rounded-full bg-gradient-to-r ${barColor} transition-all duration-700`}
                            style={{ width: `${speedScore}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    {i < sorted.length - 1 && <Separator className="mt-5" />}
                  </motion.div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
