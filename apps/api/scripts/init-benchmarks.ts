import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load .env
dotenv.config({ path: join(process.cwd(), '.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function init() {
  console.log("Initializing benchmark_report table...");
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS "benchmark_report" (
        "id" text PRIMARY KEY NOT NULL,
        "model_id" text NOT NULL,
        "framework" text NOT NULL,
        "agent_name" text NOT NULL,
        "agent_version" text NOT NULL,
        "project_id" text,
        "runs" integer DEFAULT 0 NOT NULL,
        "successes" integer DEFAULT 0 NOT NULL,
        "success_runs" integer DEFAULT 0 NOT NULL,
        "avg_ms" integer DEFAULT 0 NOT NULL,
        "p95_ms" integer DEFAULT 0 NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "benchmark_report_model_id_unique" UNIQUE("model_id")
      );
    `;
    console.log("✓ benchmark_report table ensured.");
  } catch (err) {
    console.error("Failed to initialize table:", err);
    process.exit(1);
  }
}

init();
