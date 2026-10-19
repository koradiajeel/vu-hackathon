import { BenchmarksClient } from "./BenchmarksClient"

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

export default async function BenchmarksPage() {
  const apiBase =
    process.env.CAPAGENT_API_BASE_URL ??
    process.env.NEXT_PUBLIC_CAPAGENT_API_BASE_URL ??
    "http://127.0.0.1:8787"

  let reports: BenchmarkReport[] = []
  try {
    const res = await fetch(`${apiBase}/api/benchmarks`, { cache: "no-store" })
    if (res.ok) {
      const json = (await res.json()) as { reports?: BenchmarkReport[] }
      reports = json.reports ?? []
    }
  } catch {
    // API offline — client will show empty state
  }

  return (
    <div className="container max-w-5xl py-16 md:py-24">
      <BenchmarksClient initialReports={reports} />
    </div>
  )
}
