import { PGlite } from "@electric-sql/pglite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { SCHEMA_SQL } from "./schema-sql";

/**
 * Local, embedded Postgres (PGlite) so Capgent runs with no cloud services.
 * Exposes the same tagged-template shape as `neon()` so existing queries work unchanged:
 *   const rows = await sql`SELECT * FROM "user" WHERE id = ${id}`
 */
export type LocalSql = <T = any>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<T[]>;

type LocalDbState = { db: PGlite; ready: Promise<void> };

function getState(): LocalDbState {
  const g = globalThis as any;
  if (!g.__capgent_local_db) {
    const dataDir = resolve(process.env.CAPGENT_DATA_DIR ?? resolve(process.cwd(), ".data/pglite"));
    mkdirSync(dataDir, { recursive: true });
    const db = new PGlite(dataDir);
    const ready = db.exec(SCHEMA_SQL).then(() => undefined);
    g.__capgent_local_db = { db, ready } satisfies LocalDbState;
  }
  return g.__capgent_local_db as LocalDbState;
}

export const localSql: LocalSql = async (strings, ...values) => {
  const { db, ready } = getState();
  await ready;
  let text = strings[0] ?? "";
  for (let i = 0; i < values.length; i++) text += `$${i + 1}${strings[i + 1] ?? ""}`;
  const params = values.map((v) => (v === undefined ? null : v));
  const result = await db.query(text, params);
  return result.rows as any[];
};
