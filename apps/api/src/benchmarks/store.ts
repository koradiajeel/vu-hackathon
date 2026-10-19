import type { Env } from "../config";
import { createDb } from "../storage/db";

export type BenchmarkReport = {
  id: string;
  model_id: string;
  framework: string;
  agent_name: string;
  agent_version: string;
  project_id?: string;
  runs: number;
  successes: number;
  success_runs: number;
  avg_ms: number;
  p95_ms: number;
  created_at: string;
};

export async function getBenchmarkReports(env: Env): Promise<BenchmarkReport[]> {
  const sql = createDb(env);
  const rows = await sql`
    SELECT id, model_id, framework, agent_name, agent_version, project_id,
           runs, successes, success_runs, avg_ms, p95_ms, "createdAt" as created_at
    FROM benchmark_report
    ORDER BY "createdAt" DESC
  `;
  
  return rows.map((row: any) => ({
    ...row,
    created_at: row.created_at.toISOString(),
    runs: Number(row.runs),
    successes: Number(row.successes),
    success_runs: Number(row.success_runs),
    avg_ms: Number(row.avg_ms),
    p95_ms: Number(row.p95_ms)
  })) as BenchmarkReport[];
}

export async function saveBenchmarkReport(env: Env, report: BenchmarkReport): Promise<void> {
  const sql = createDb(env);
  
  await sql`
    INSERT INTO benchmark_report (
      id, model_id, framework, agent_name, agent_version, project_id,
      runs, successes, success_runs, avg_ms, p95_ms, "createdAt"
    )
    VALUES (
      ${report.id}, ${report.model_id}, ${report.framework}, ${report.agent_name}, 
      ${report.agent_version}, ${report.project_id || null}, ${report.runs}, 
      ${report.successes}, ${report.success_runs}, ${report.avg_ms}, 
      ${report.p95_ms}, ${new Date(report.created_at)}
    )
    ON CONFLICT (model_id) DO UPDATE SET
      framework = EXCLUDED.framework,
      agent_name = EXCLUDED.agent_name,
      agent_version = EXCLUDED.agent_version,
      runs = EXCLUDED.runs,
      successes = EXCLUDED.successes,
      success_runs = EXCLUDED.success_runs,
      avg_ms = EXCLUDED.avg_ms,
      p95_ms = EXCLUDED.p95_ms,
      "createdAt" = EXCLUDED."createdAt"
  `;
}

export async function clearBenchmarks(env: Env): Promise<void> {
  const sql = createDb(env);
  await sql`DELETE FROM benchmark_report`;
}
