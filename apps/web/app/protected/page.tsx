"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShieldCheck, SpinnerGap, WarningCircle } from "@phosphor-icons/react"
import * as motion from "motion/react-client"

export default function ProtectedPage() {
  const [data, setData] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const baseUrl = process.env.NEXT_PUBLIC_CAPAGENT_API_BASE_URL || "http://127.0.0.1:8787"

  useEffect(() => {
    (async () => {
      try {
        const cookies = document.cookie.split(";").map((s) => s.trim())
        const token =
          cookies.find((s) => s.startsWith("capgent_proof="))?.split("=")[1] ??
          cookies.find((s) => s.startsWith("capgent_identity="))?.split("=")[1]
        if (!token) throw new Error("No proof or identity token found. Complete the playground flow first.")
        const res = await fetch(`${baseUrl}/api/protected/ping`, {
          headers: { authorization: `Bearer ${token}` },
        })
        const body = await res.json()
        if (!res.ok) throw new Error(body?.error ?? "Request failed")
        setData(body)
      } catch (e: any) {
        setErr(e?.message ?? String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [baseUrl])

  return (
    <div className="container max-w-2xl py-16 md:py-24">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="space-y-2">
          <Badge variant="secondary" className="gap-1.5">
            <ShieldCheck className="h-3 w-3" /> Protected
          </Badge>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Protected Area</h1>
          <p className="text-muted-foreground">
            This page makes an authenticated API call using your proof token.
          </p>
        </div>

        {loading && (
          <Card className="mt-8">
            <CardContent className="flex items-center justify-center gap-3 p-12">
              <SpinnerGap className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Verifying proof token...</span>
            </CardContent>
          </Card>
        )}

        {err && (
          <Card className="mt-8 border-destructive/50">
            <CardContent className="flex items-start gap-3 p-5">
              <WarningCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Access Denied</p>
                <p className="mt-1 text-sm text-muted-foreground">{err}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            <Card className="mt-8">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Access Granted</CardTitle>
                    <CardDescription>The gateway accepted your proof token. This endpoint is protected by AgentWarden.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Decoded Token Claims</p>
                  <div className="rounded-lg bg-neutral-950 p-4">
                    <pre className="overflow-auto font-mono text-xs text-neutral-200">
                      {JSON.stringify(data, null, 2)}
                    </pre>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button asChild variant="ghost" size="sm" className="gap-1.5">
                    <Link href="/playground">Back to Playground</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </motion.div>
    </div>
  )
}
