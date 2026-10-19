import pkg from "node-sql-parser";
import type { CatalogTable } from "../shared/types";
import { columnDenied, tableDecision, type AgentConfig } from "./policy";

const { Parser } = pkg as unknown as { Parser: new () => any };
const parser = new Parser();
const OPT = { database: "PostgresQL" };

/** Functions that read files, sleep, change settings or reach other servers. */
const FORBIDDEN_FUNCTIONS = /\b(pg_sleep\w*|pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|lo_import|lo_export|lo_get|dblink\w*|set_config|current_setting|pg_terminate_backend|pg_cancel_backend|pg_reload_conf|query_to_xml|xpath|copy)\s*\(/i;

export type SqlCheck = {
  ok: boolean;
  /** Which check failed: "sql" (unsafe or unreadable SQL) or "policy" (not allowed for this agent). */
  failed?: "sql" | "policy";
  reason: string;
  tables: string[];
  findings: string[];
  /** The SQL that will actually run (with a row limit added). */
  rewritten?: string;
};

function statementKind(ast: any) {
  return String(ast?.type ?? "unknown").toUpperCase();
}

/**
 * Parses the agent's SQL and checks it before it touches the database:
 *  - exactly one statement, and it must be a SELECT
 *  - no dangerous functions
 *  - every table must exist and be allowed by the agent's policy
 *  - no restricted columns, including through SELECT *
 * Anything it cannot parse is rejected (fail closed).
 */
export function checkSql(sqlIn: string, agent: AgentConfig, catalog: CatalogTable[]): SqlCheck {
  const sql = sqlIn.trim().replace(/;\s*$/, "");
  const findings: string[] = [];
  const fail = (failed: "sql" | "policy", reason: string, tables: string[] = []): SqlCheck => ({ ok: false, failed, reason, tables, findings });

  if (!sql) return fail("sql", "The agent did not produce any SQL.");
  const fn = FORBIDDEN_FUNCTIONS.exec(sql);
  if (fn) return fail("sql", `Uses a forbidden function: ${fn[1]}()`);

  let ast: any;
  try {
    ast = parser.astify(sql, OPT);
  } catch (e) {
    return fail("sql", `Could not parse the SQL, so it was rejected (${(e as Error).message.split("\n")[0]})`);
  }
  const statements = Array.isArray(ast) ? ast : [ast];
  if (statements.length !== 1) return fail("sql", `Contains ${statements.length} statements; only one query is allowed.`);
  const kind = statementKind(statements[0]);
  if (kind !== "SELECT") return fail("sql", `This is a ${kind} statement. Agents may only read data (SELECT).`);
  findings.push("Single read-only SELECT statement");

  let tableRefs: string[];
  let columnRefs: string[];
  try {
    tableRefs = parser.tableList(sql, OPT);
    columnRefs = parser.columnList(sql, OPT);
  } catch (e) {
    return fail("sql", `Could not analyse the SQL (${(e as Error).message})`);
  }

  // Names defined by WITH ... AS (...) are not real tables.
  const cteNames = new Set<string>();
  const collectCtes = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node.with)) for (const w of node.with) cteNames.add(String(w?.name?.value ?? w?.name ?? "").toLowerCase());
    for (const v of Object.values(node)) if (v && typeof v === "object") collectCtes(v);
  };
  collectCtes(statements[0]);

  const byName = new Map<string, string[]>();
  for (const t of catalog) {
    const name = t.table.split(".")[1]!.toLowerCase();
    byName.set(name, [...(byName.get(name) ?? []), t.table]);
  }
  const known = new Set(catalog.map((t) => t.table.toLowerCase()));

  const tables: string[] = [];
  for (const ref of tableRefs) {
    const [, schemaRaw, tableRaw] = ref.split("::");
    const table = String(tableRaw).toLowerCase();
    const schema = schemaRaw && schemaRaw !== "null" ? schemaRaw.toLowerCase() : null;
    if (!schema && cteNames.has(table)) continue;
    let qualified: string;
    if (schema) qualified = `${schema}.${table}`;
    else {
      const candidates = byName.get(table) ?? [];
      if (candidates.length !== 1) {
        return fail("sql", candidates.length ? `Table "${table}" is ambiguous (${candidates.join(", ")}); use schema.table.` : `Table "${table}" does not exist.`);
      }
      qualified = candidates[0]!;
    }
    if (!known.has(qualified)) return fail("sql", `Table ${qualified} does not exist.`);
    if (!tables.includes(qualified)) tables.push(qualified);
  }
  if (!tables.length) return fail("sql", "The query does not read any known table.");

  for (const t of tables) {
    const d = tableDecision(agent.policy, t, agent.department);
    if (!d.allowed) return fail("policy", d.reason, tables);
  }
  findings.push(`Tables allowed: ${tables.join(", ")}`);

  // Columns: block restricted ones, including "SELECT *" over a table that has any.
  const columnsOf = (t: string) => catalog.find((c) => c.table === t)?.columns ?? [];
  const tablesByShortName = (short: string | null) => (short && short !== "null" ? tables.filter((t) => t.split(".")[1] === short.toLowerCase()) : tables);
  for (const ref of columnRefs) {
    const [, tableShort, columnRaw] = ref.split("::");
    const column = String(columnRaw);
    const candidates = tablesByShortName(tableShort ?? null);
    if (column === "(.*)") {
      for (const t of candidates) {
        const hidden = columnsOf(t).filter((c) => columnDenied(agent.policy, t, c));
        if (hidden.length) return fail("policy", `SELECT * on ${t} would include restricted column(s): ${hidden.join(", ")}`, tables);
      }
      continue;
    }
    for (const t of candidates) {
      if (columnsOf(t).includes(column) && columnDenied(agent.policy, t, column)) {
        return fail("policy", `Column ${t}.${column} is restricted for the ${agent.department} agent`, tables);
      }
    }
  }
  findings.push("No restricted columns");

  const maxRows = agent.policy.maxRows ?? 200;
  findings.push(`Row limit ${maxRows} added`);
  return { ok: true, reason: "SQL passed every check", tables, findings, rewritten: `SELECT * FROM (\n${sql}\n) AS agentwarden_result LIMIT ${maxRows}` };
}
