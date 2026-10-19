// Docker sandbox test: npm run test:docker (starts docker-compose.yml, then bundles and runs this file).
// Same demo questions as e2e.ts, but against PostgreSQL 16 in a container, with every approved
// query run by psql in its own locked-down throw-away container.
import { spawn, spawnSync } from "node:child_process";
import { AgentWardenClient, builtin } from "../src/index";
import { createDemoGateway, DEMO_AGENTS, DEMO_QUESTIONS, DEMO_SQL } from "../src/demo";
import { createGateway, dockerRunFlags, postgresDatabase, SANDBOX_LABEL } from "../src/gateway";

const ADMIN_URL = process.env.AW_DOCKER_DB_URL ?? "postgres://aw_admin:aw_admin_demo_pw@127.0.0.1:55432/company";
const NETWORK = "agentwarden-db";
const IMAGE = "postgres:16-alpine";

let failures = 0;
const expect = (label: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? `  (${extra})` : ""}`);
  if (!cond) failures++;
};

if (spawnSync("docker", ["info"], { stdio: "ignore" }).status !== 0) {
  console.error("Docker is not running. Start Docker Desktop, then: npm run test:docker");
  process.exit(1);
}

// Fresh demo data in the container database (re-runnable).
const database = await postgresDatabase(ADMIN_URL);
await database.exec("DROP SCHEMA IF EXISTS finance, hr, production, rnd, agentwarden CASCADE");
await database.exec(DEMO_SQL);

// Watch sandbox containers being created, to prove one fresh container per query.
const created: string[] = [];
const events = spawn("docker", ["events", "--filter", `label=${SANDBOX_LABEL}=1`, "--filter", "event=create", "--format", "{{.Actor.ID}}"]);
events.stdout.on("data", (d) => created.push(...String(d).split(/\s+/).filter(Boolean)));
await new Promise((r) => setTimeout(r, 1000));

const gw = createGateway({
  database,
  agents: DEMO_AGENTS,
  basePath: "/aw",
  sandbox: { type: "docker", dbHost: "postgres", dbName: "company", network: NETWORK, image: IMAGE },
});
await gw.ready;
expect("Gateway uses the Docker sandbox", gw.sandbox().kind === "docker");
const local = await createDemoGateway({ basePath: "/aw" });

const base = "http://local/aw";
const client = (g: typeof gw, i: number) =>
  new AgentWardenClient({ gatewayUrl: base, agentId: DEMO_AGENTS[i]!.id, agentSecret: DEMO_AGENTS[i]!.secret, model: builtin(), fetch: (r) => g.fetch(r) });
const clients = { "finance-analyst": [client(gw, 0), client(local, 0)], "hr-assistant": [client(gw, 1), client(local, 1)] } as const;
for (const [d, l] of Object.values(clients)) expect("Agent connects", (await d.connect()).ok && (await l.connect()).ok);

// ── Demo questions: same decisions and same answers as the local sandbox ──
let sandboxRuns = 0;
for (const [agentId, qs] of Object.entries(DEMO_QUESTIONS)) {
  const [d, l] = clients[agentId as keyof typeof clients];
  for (const q of qs) {
    const r = await d.ask(q.question);
    const ref = await l.ask(q.question);
    if (r.trace.some((t) => t.layer === "sandbox")) sandboxRuns++;
    const where = r.decision === "allowed" ? `${r.row_count} rows` : `stopped at ${r.stopped_at}: ${r.reason.slice(0, 90)}`;
    expect(`[${agentId}] ${q.label} → ${q.expect}`, r.decision === q.expect, where);
    if (r.decision === "allowed") {
      const sandboxStep = r.trace.find((t) => t.layer === "sandbox");
      const norm = (rows: Record<string, unknown>[] = []) => JSON.stringify(rows.map((row) => Object.values(row).map((v) => (v == null ? null : Number.isFinite(Number(v)) ? Number(v) : String(v)))));
      expect(`   ran in docker sandbox, same rows as local sandbox`, !!sandboxStep?.title.includes("docker") && norm(r.rows) === norm(ref.rows) && r.columns?.join() === ref.columns?.join(), sandboxStep?.title);
    }
  }
}

// ── The database is a second lock, also from inside the container ──
const sb = gw.sandbox();
const fails = async (sql: string, role: string) => sb.run(sql, role).then(() => "no error", (e: Error) => e.message);
let m = await fails("SELECT pan FROM hr.employees", "aw_agent_finance_analyst"); sandboxRuns++;
expect("Database refuses finance role reading hr", /permission denied/.test(m), m);
m = await fails("SELECT pan FROM hr.employees", "aw_agent_hr_assistant"); sandboxRuns++;
expect("Database refuses HR role reading PAN column", /permission denied/.test(m), m);
m = await fails("DELETE FROM finance.revenue", "aw_agent_finance_analyst"); sandboxRuns++;
expect("Writes fail: read-only transaction", /read-only transaction/.test(m), m);
m = await fails("SELECT pg_sleep(10)", "aw_agent_finance_analyst"); sandboxRuns++;
expect("Slow query is cancelled by the time limit", /statement timeout/.test(m), m);

// ── psql CSV output is parsed correctly ──
const csv = await sb.run(`SELECT NULL AS n, '' AS e, 'a,"b"' || chr(10) || 'c' AS q, 42 AS "odd, name"`, "aw_agent_finance_analyst"); sandboxRuns++;
const row = csv.rows[0] ?? {};
expect("CSV: NULL, empty string, quotes/commas/newline, odd column name", csv.rows.length === 1 && row.n === null && row.e === "" && row.q === 'a,"b"\nc' && row["odd, name"] === "42", JSON.stringify(csv));
const empty = await sb.run("SELECT segment FROM finance.revenue WHERE false", "aw_agent_finance_analyst"); sandboxRuns++;
expect("CSV: zero rows keeps the column names", empty.rows.length === 0 && empty.columns.join() === "segment", JSON.stringify(empty));

// ── host.docker.internal mode (database published on the host, no shared network) ──
const port = Number(new URL(ADMIN_URL).port || 5432);
const viaHost = createGateway({ database, agents: DEMO_AGENTS, sandbox: { type: "docker", dbHost: "host.docker.internal", dbPort: port, dbName: "company", image: IMAGE } });
await viaHost.ready;
const hostRes = await viaHost.sandbox().run("SELECT count(*) AS n FROM finance.revenue", "aw_agent_finance_analyst").catch((e: Error) => e); sandboxRuns++;
expect("host.docker.internal mode reaches the database", !(hostRes instanceof Error) && Number(hostRes.rows[0]?.n) > 0, hostRes instanceof Error ? hostRes.message : `${hostRes.rows[0]?.n} rows`);
// (viaHost re-synced role passwords; gw's sandbox would now fail auth, so it is not used below.)

// ── Every query got its own fresh container ──
await new Promise((r) => setTimeout(r, 1500));
events.kill();
const leftovers = spawnSync("docker", ["ps", "-aq", "--filter", `label=${SANDBOX_LABEL}=1`], { encoding: "utf8" }).stdout.trim();
expect(`One fresh container per sandbox query (${sandboxRuns} queries)`, created.length === sandboxRuns && new Set(created).size === created.length, `${created.length} containers created`);
expect("Sandbox containers are removed afterwards", leftovers === "", leftovers);

// ── The container really is locked down (same flags, probe command instead of psql) ──
const probe = spawnSync(
  "docker",
  [...dockerRunFlags({ dbHost: "postgres", network: NETWORK }, `aw-probe-${Date.now()}`), IMAGE, "sh", "-c",
    "touch /probe 2>/dev/null && echo fs=writable || echo fs=readonly; echo tmp=$(touch /tmp/x && echo ok); grep -E '^(CapEff|NoNewPrivs)' /proc/self/status; " +
    "echo mem=$(cat /sys/fs/cgroup/memory.max) cpu=$(cat /sys/fs/cgroup/cpu.max | tr ' ' /) pids=$(cat /sys/fs/cgroup/pids.max); id -un"],
  { encoding: "utf8", input: "" }
);
const p = probe.stdout;
console.log("        ", p.trim().replace(/\s+/g, " "));
expect("Read-only root file system (only a small /tmp)", /fs=readonly/.test(p) && /tmp=ok/.test(p));
expect("All Linux capabilities dropped", /CapEff:\s*0+\s/.test(p));
expect("No privilege escalation", /NoNewPrivs:\s*1/.test(p));
expect("Memory 128 MB, 0.5 CPU, 64 processes", /mem=134217728/.test(p) && /cpu=50000\/100000/.test(p) && /pids=64/.test(p));

await database.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
