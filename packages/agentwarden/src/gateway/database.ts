import type { CatalogTable } from "../shared/types";
import { columnDenied, roleFor, tableDecision, type AgentConfig } from "./policy";

export type QueryResult = { columns: string[]; rows: Record<string, unknown>[] };

export interface Tx {
  exec(sql: string): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
}

/** The database the departments' data lives in. The gateway connects as an admin user. */
export interface Database extends Tx {
  kind: "pglite" | "postgres";
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** Embedded PostgreSQL (WebAssembly) — no server needed. Pass a folder to keep data on disk. */
export async function pgliteDatabase(dataDir?: string): Promise<Database> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite(dataDir);
  await db.waitReady;
  const wrap = (q: { exec: (s: string) => Promise<unknown>; query: (s: string, p?: unknown[]) => Promise<any> }): Tx => ({
    async exec(sql) {
      await q.exec(sql);
    },
    async query(sql, params) {
      const r = await q.query(sql, params);
      return { columns: (r.fields ?? []).map((f: any) => f.name), rows: r.rows };
    },
  });
  return {
    kind: "pglite",
    ...wrap(db),
    transaction: (fn) => db.transaction((tx) => fn(wrap(tx))),
    close: () => db.close(),
  };
}

/** A real PostgreSQL server, e.g. "postgres://admin:pw@localhost:5432/company". Needs the "pg" package. */
export async function postgresDatabase(connectionString: string): Promise<Database> {
  const pg: any = await import(/* webpackIgnore: true */ "pg" as string).catch(() => {
    throw new Error('postgresDatabase needs the "pg" package: npm install pg');
  });
  const Pool = pg.Pool ?? pg.default?.Pool;
  const pool = new Pool({ connectionString, max: 5 });
  const wrap = (c: any): Tx => ({
    async exec(sql) {
      await c.query(sql);
    },
    async query(sql, params) {
      const r = await c.query(sql, params);
      return { columns: (r.fields ?? []).map((f: any) => f.name), rows: r.rows };
    },
  });
  return {
    kind: "postgres",
    ...wrap(pool),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const out = await fn(wrap(client));
        await client.query("COMMIT");
        return out;
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

const SYSTEM_SCHEMAS = ["pg_catalog", "information_schema", "agentwarden", "public"];

/** Every table and view in the department schemas, with its columns. */
export async function readCatalog(db: Database): Promise<CatalogTable[]> {
  const r = await db.query(
    `SELECT c.table_schema || '.' || c.table_name AS t, c.column_name AS col, obj_description(pc.oid) AS descr
       FROM information_schema.columns c
       JOIN pg_namespace n ON n.nspname = c.table_schema
       JOIN pg_class pc ON pc.relname = c.table_name AND pc.relnamespace = n.oid
      WHERE c.table_schema <> ALL($1)
      ORDER BY c.table_schema, c.table_name, c.ordinal_position`,
    [SYSTEM_SCHEMAS]
  );
  const map = new Map<string, CatalogTable>();
  for (const row of r.rows as { t: string; col: string; descr: string | null }[]) {
    if (!map.has(row.t)) map.set(row.t, { table: row.t, columns: [], description: row.descr ?? undefined });
    map.get(row.t)!.columns.push(row.col);
  }
  const tables = [...map.values()];
  // Category columns: text columns whose values repeat and number 12 or fewer (never unique ones like names or IDs).
  const text = await db.query(
    `SELECT table_schema || '.' || table_name AS t, column_name AS col FROM information_schema.columns
      WHERE table_schema <> ALL($1) AND data_type IN ('text', 'character varying', 'character')`,
    [SYSTEM_SCHEMAS]
  );
  for (const { t, col } of text.rows as { t: string; col: string }[]) {
    const table = map.get(t);
    if (!table) continue;
    const stats = await db.query(`SELECT count(DISTINCT ${q(col)})::int AS d, count(*)::int AS n FROM ${qualified(t)}`);
    const { d, n } = stats.rows[0] as { d: number; n: number };
    if (d === 0 || d > 12 || d >= n) continue;
    const vals = await db.query(`SELECT DISTINCT ${q(col)}::text AS v FROM ${qualified(t)} WHERE ${q(col)} IS NOT NULL ORDER BY 1`);
    const list = (vals.rows as { v: string }[]).map((r) => r.v);
    if (list.every((v) => v.length <= 40)) (table.values ??= {})[col] = list;
  }
  return tables;
}

/** The part of the catalog an agent is allowed to see (denied columns removed). */
export function catalogFor(agent: AgentConfig, catalog: CatalogTable[]): CatalogTable[] {
  return catalog
    .filter((t) => tableDecision(agent.policy, t.table, agent.department).allowed)
    .map((t) => {
      const columns = t.columns.filter((c) => !columnDenied(agent.policy, t.table, c));
      const values = t.values && Object.fromEntries(Object.entries(t.values).filter(([c]) => columns.includes(c)));
      return { ...t, columns, values: values && Object.keys(values).length ? values : undefined };
    })
    .filter((t) => t.columns.length > 0);
}

const q = (ident: string) => `"${ident.replace(/"/g, '""')}"`;
const qualified = (table: string) => table.split(".").map(q).join(".");

/**
 * Mirrors every agent's policy into PostgreSQL permissions: one role per agent with SELECT
 * only on its allowed tables and columns. Even a query that slips past the gateway's own
 * checks then fails inside the database.
 */
export async function syncDatabaseRoles(db: Database, agents: AgentConfig[], catalog: CatalogTable[]) {
  const schemas = [...new Set(catalog.map((t) => t.table.split(".")[0]!))];
  for (const agent of agents) {
    const role = roleFor(agent.id);
    await db.exec(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN CREATE ROLE ${q(role)} NOLOGIN; END IF; END $$;`);
    // Start from nothing, then grant exactly what the policy allows.
    for (const s of schemas) {
      await db.exec(`REVOKE ALL ON ALL TABLES IN SCHEMA ${q(s)} FROM ${q(role)}; REVOKE ALL ON SCHEMA ${q(s)} FROM ${q(role)};`);
    }
    const visible = catalogFor(agent, catalog);
    for (const s of new Set(visible.map((t) => t.table.split(".")[0]!))) await db.exec(`GRANT USAGE ON SCHEMA ${q(s)} TO ${q(role)}`);
    for (const t of visible) await db.exec(`GRANT SELECT (${t.columns.map(q).join(", ")}) ON ${qualified(t.table)} TO ${q(role)}`);
  }
}
