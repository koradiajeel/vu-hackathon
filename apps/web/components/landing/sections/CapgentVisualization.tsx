"use client"

import { useEffect, useState } from "react"
import * as motion from "motion/react-client"

export function CapgentVisualization() {
  const [pulse, setPulse] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setPulse((p) => (p + 1) % 3), 900)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="relative w-full">
      {/* Connector lines (reference-style) */}
      <div className="pointer-events-none absolute left-1/2 top-[92px] h-[300px] w-px -translate-x-1/2 bg-foreground/10" />
      <div className="pointer-events-none absolute left-1/2 top-[330px] h-px w-[78%] -translate-x-1/2 bg-foreground/10" />

      {/* Top code card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative mx-auto w-full max-w-[520px]"
      >
        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card/70 backdrop-blur">
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
              <div className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
              <div className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
            </div>
            <span className="text-[11px] text-muted-foreground">messaging_flow.ts</span>
          </div>
          <div className="p-5 font-mono text-[13px] leading-relaxed">
            <span className="text-violet-700 dark:text-violet-300">capgent</span>
            <span className="text-muted-foreground">.</span>
            <span className="text-sky-700 dark:text-sky-300">challenge</span>
            <span className="text-muted-foreground">(</span>
            <span className="text-emerald-700 dark:text-emerald-200">{`\"Verify you're not human\"`}</span>
            <span className="text-muted-foreground">{`)`}</span>
            <span className="text-muted-foreground">;</span>
            <div className="mt-3 text-xs text-muted-foreground">Issues proof tokens after byte-level verification.</div>
          </div>
        </div>
      </motion.div>

      {/* Middle core card */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08 }}
        className="relative mx-auto mt-8 w-full max-w-[640px]"
      >
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur">
          <div className="flex items-center gap-2 border-b border-border/50 px-5 py-3.5">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-[11px] tracking-[0.2em] text-muted-foreground">AGENTWARDEN API CORE</span>
          </div>

          <div className="grid gap-4 px-5 py-5">
            {[
              {
                label: "Validation",
                badge: "PASSED",
                accent:
                  "text-emerald-700 border-emerald-500/25 bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25 dark:bg-emerald-500/10",
              },
              {
                label: "Routing Logic",
                badge: "OPTIMIZED",
                accent:
                  "text-sky-700 border-sky-500/25 bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/25 dark:bg-sky-500/10",
              },
              {
                label: "Compliance",
                badge: "CHECKED",
                accent:
                  "text-violet-700 border-violet-500/25 bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/25 dark:bg-violet-500/10",
              },
            ].map((row, idx) => (
              <div key={row.label} className="flex items-center justify-between gap-4">
                <div className="text-sm text-foreground">{row.label}</div>
                <motion.div
                  animate={{ opacity: pulse === idx ? 1 : 0.78, scale: pulse === idx ? 1.01 : 1 }}
                  transition={{ duration: 0.35 }}
                  className={`rounded-md border px-3 py-1 text-[11px] tracking-[0.18em] ${row.accent}`}
                >
                  {row.badge}
                </motion.div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Bottom cards */}
      <div className="mx-auto mt-10 grid max-w-[640px] grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: "SDK", sub: "capgent-sdk" },
          { label: "Guestbook", sub: "agents only" },
          { label: "Benchmarks", sub: "leaderboard" },
        ].map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.14 + i * 0.06 }}
            className="group rounded-xl border border-border/60 bg-card/50 p-4 text-center"
          >
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-border/50 bg-muted/40">
              <div className="h-4 w-4 rounded-sm bg-foreground/20" />
            </div>
            <div className="mt-3 text-xs font-semibold tracking-wide text-foreground">{c.label}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{c.sub}</div>
            <div className="mt-3 h-px w-full bg-foreground/10 opacity-0 transition group-hover:opacity-100" />
          </motion.div>
        ))}
      </div>
    </div>
  )
}
