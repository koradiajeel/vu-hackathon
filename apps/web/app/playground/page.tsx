"use client"

import { createClient } from "capgent-sdk"
import { solveChallengeFromSteps } from "capgent-sdk/solver"
import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowsCounterClockwise, CheckCircle, Cpu, LockOpen, LockSimple, SpinnerGap, Terminal } from "@phosphor-icons/react"
import * as motion from "motion/react-client"

type SolverOutput = {
  answer: string
  hmac: string
}

async function solveWithLLM(payload: {
  instructions: string[]
  data_b64: string
  nonce: string
}): Promise<SolverOutput> {
  const res = await fetch("/api/parse-instructions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instructions: payload.instructions ?? [] }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.error ?? `Parse failed: ${res.status}`)
  }
  const { steps } = await res.json()
  if (!Array.isArray(steps) || steps.length === 0) throw new Error("No steps returned from LLM")
  return await solveChallengeFromSteps({
    data_b64: payload.data_b64,
    nonce: payload.nonce,
    steps,
  })
}

export default function PlaygroundPage() {
  const router = useRouter()
  const baseUrl = process.env.NEXT_PUBLIC_CAPAGENT_API_BASE_URL || "/api/capgent"
  const client = useMemo(
    () =>
      createClient({
        baseUrl,
        agentName: "capgent-web-playground",
        agentVersion: "0.0.0",
      }),
    [baseUrl]
  )

  const [challenge, setChallenge] = useState<any | null>(null)
  const [solve, setSolve] = useState<SolverOutput | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("")
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const [flowStartMs, setFlowStartMs] = useState<number | null>(null)

  async function onGetChallenge() {
    setError(null)
    setToken(null)
    setSolve(null)
    setChallenge(null)
    setBusy(true)
    setFlowStartMs(Date.now())
    setElapsedMs(null)
    setStatus("Fetching challenge from the AgentWarden API...")
    try {
      const ch = await client.getChallenge()
      if (ch?.challenge_id && ch?.data_b64 != null) {
        setChallenge(ch)
        setStatus("")
      } else {
        setError("API returned invalid challenge (missing challenge_id or data_b64)")
      }
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  async function onSolve() {
    setError(null)
    setSolve(null)
    setBusy(true)
    setStatus("Sending instructions to LLM for parsing...")
    try {
      if (!challenge) throw new Error("Get a challenge first")
      const out = await solveWithLLM({
        instructions: challenge.instructions ?? [],
        data_b64: challenge.data_b64,
        nonce: challenge.nonce,
      })
      setSolve(out)
      setStatus("")
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  async function onVerify() {
    setError(null)
    setToken(null)
    setBusy(true)
    setStatus("Submitting solution to AgentWarden for verification...")
    try {
      if (!challenge) throw new Error("no challenge")
      if (!solve) throw new Error("solve first")
      const res = await client.verifyChallenge(challenge.challenge_id, solve.answer, solve.hmac)
      const totalMs = flowStartMs ? Date.now() - flowStartMs : 0
      setElapsedMs(totalMs)
      setToken(res.token)
      const exp = new Date(res.expires_at).getTime()
      const maxAge = Number.isFinite(exp) ? Math.max(0, Math.floor((exp - Date.now()) / 1000)) : 300
      document.cookie = `capgent_proof=${res.token}; Path=/; Max-Age=${maxAge}; SameSite=Lax`
      setStatus("Redirecting to protected area...")
      router.push("/protected")
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  function onReset() {
    setChallenge(null)
    setSolve(null)
    setToken(null)
    setError(null)
    setStatus("")
    setElapsedMs(null)
    setFlowStartMs(null)
    document.cookie = "capgent_proof=; Path=/; Max-Age=0; SameSite=Lax"
  }

  const stepIndex = token ? 3 : solve ? 2 : challenge ? 1 : 0

  return (
    <div className="container max-w-3xl py-16 md:py-24">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="space-y-2">
          <Badge variant="secondary" className="gap-1.5">
            <Terminal className="h-3 w-3" /> Live Demo
          </Badge>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Playground</h1>
          <p className="max-w-2xl text-muted-foreground">
            Experience the full AgentWarden verification flow: request a challenge, let an LLM parse the byte-level
            instructions, compute the answer, and receive a signed proof JWT. This is exactly what an agent does.
          </p>
        </div>

        <Card className="mt-8">
          <CardContent className="p-6 space-y-6">
            {/* Session status */}
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className={`h-2.5 w-2.5 rounded-full ${token ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
                <span className="text-sm font-medium">{token ? "Agent Verified" : "Unverified"}</span>
              </div>
              <div className="flex items-center gap-3">
                {elapsedMs !== null && (
                  <Badge variant="secondary" className="text-xs tabular-nums">
                    {(elapsedMs / 1000).toFixed(1)}s total
                  </Badge>
                )}
                {token && (
                  <code className="hidden text-xs text-muted-foreground sm:block">
                    {token.slice(0, 10)}...{token.slice(-8)}
                  </code>
                )}
              </div>
            </div>

            {/* Step progress */}
            <div className="flex items-center gap-2">
              {[
                { label: "Challenge", done: stepIndex >= 1 },
                { label: "Solve", done: stepIndex >= 2 },
                { label: "Verify", done: stepIndex >= 3 },
              ].map((s, i) => (
                <div key={s.label} className="flex items-center gap-2">
                  {i > 0 && <div className={`h-px w-6 ${s.done ? "bg-emerald-500" : "bg-border"}`} />}
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${s.done ? "bg-emerald-500 text-white" : "border bg-muted text-muted-foreground"}`}>
                    {s.done ? <CheckCircle className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className={`text-xs ${s.done ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                </div>
              ))}
            </div>

            <Separator />

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <Button onClick={onGetChallenge} disabled={busy || !!challenge} size="sm">
                {busy && status.includes("Fetching") ? <SpinnerGap className="h-4 w-4 animate-spin" /> : <LockSimple className="h-4 w-4" />}
                Get Challenge
              </Button>
              <Button onClick={onSolve} disabled={busy || !challenge || !!solve} variant="secondary" size="sm">
                {busy && status.includes("LLM") ? <SpinnerGap className="h-4 w-4 animate-spin" /> : <Cpu className="h-4 w-4" />}
                Solve with LLM
              </Button>
              <Button
                onClick={onVerify}
                disabled={busy || !solve || !!token}
                variant="secondary"
                size="sm"
                className={token ? "border-emerald-500/50 text-emerald-500" : ""}
              >
                {busy && status.includes("Submitting") ? <SpinnerGap className="h-4 w-4 animate-spin" /> : token ? <CheckCircle className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                Verify & Get JWT
              </Button>
              {(challenge || token) && (
                <Button variant="ghost" size="sm" onClick={onReset}>
                  <ArrowsCounterClockwise className="h-4 w-4" /> Reset
                </Button>
              )}
            </div>

            {status && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <SpinnerGap className="h-3 w-3 animate-spin" />
                {status}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* After verify we redirect directly to /protected */}

        {/* Challenge details */}
        {challenge && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="mt-6">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Terminal className="h-4 w-4" /> Challenge Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Instructions</p>
                  <div className="rounded-md bg-muted p-3">
                    <ol className="list-decimal list-inside space-y-1 font-mono text-xs">
                      {(Array.isArray(challenge.instructions)
                        ? challenge.instructions
                        : typeof challenge.instructions === "string"
                          ? challenge.instructions.split(/\n+/).filter(Boolean)
                          : []
                      ).map((raw: string, i: number) => {
                        const line = raw.replace(/^\d+\.\s*/, "")
                        return (
                          <li key={i} className="text-muted-foreground">
                            <span className="text-foreground">{line}</span>
                          </li>
                        )
                      })}
                    </ol>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">ID</p>
                    <code className="block truncate rounded bg-muted px-2 py-1 font-mono text-xs">{challenge.challenge_id}</code>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Nonce</p>
                    <code className="block truncate rounded bg-muted px-2 py-1 font-mono text-xs">{challenge.nonce}</code>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Expires</p>
                    <code className="block truncate rounded bg-muted px-2 py-1 font-mono text-xs">
                      {challenge.expires_at ? new Date(challenge.expires_at).toLocaleTimeString() : "—"}
                    </code>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Solution details */}
        {solve && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="mt-6">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Cpu className="h-4 w-4" /> Computed Solution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Answer (SHA-256)</p>
                  <code className="block break-all rounded bg-muted px-2 py-1 font-mono text-xs">{solve.answer}</code>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">HMAC Signature</p>
                  <code className="block break-all rounded bg-muted px-2 py-1 font-mono text-xs">{solve.hmac}</code>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Explainer for newcomers */}
        {!challenge && !token && (
          <Card className="mt-8 border-border/50">
            <CardContent className="p-6 space-y-3">
              <h3 className="font-semibold">How this works</h3>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li><strong className="text-foreground">1. Challenge</strong> — AgentWarden generates 256 random bytes and natural-language instructions describing byte operations (slice, reverse, XOR, NOT).</li>
                <li><strong className="text-foreground">2. Solve</strong> — An LLM parses the instructions into structured steps. The solver executes the byte transforms and computes SHA-256 + HMAC.</li>
                <li><strong className="text-foreground">3. Verify</strong> — The answer is submitted. If correct and within the time limit, AgentWarden issues a signed JWT proof token.</li>
              </ol>
              <p className="text-xs text-muted-foreground">
                This is exactly what happens when a real AI agent encounters an AgentWarden-protected endpoint.
                Click <strong className="text-foreground">Get Challenge</strong> above to start.
              </p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  )
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}
