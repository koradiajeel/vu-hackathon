// End-to-end test: node test/run.mjs (bundles this file with esbuild and runs it).
import { AgentWardenClient, builtin, ollama } from "../src/index";
import { createDemoGateway, DEMO_AGENTS, DEMO_QUESTIONS } from "../src/demo";
import { checkSql } from "../src/gateway";

let failures = 0;
const expect = (label: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? `  (${extra})` : ""}`);
  if (!cond) failures++;
};

const gw = await createDemoGateway({ basePath: "/aw" });
const base = "http://local/aw";
const client = (agentId: string, secret: string | undefined, model = builtin()) =>
  new AgentWardenClient({ gatewayUrl: base, agentId, agentSecret: secret, model, fetch: (r) => gw.fetch(r) });

// ── Identity ──
const fin = client("finance-analyst", DEMO_AGENTS[0]!.secret);
const c1 = await fin.connect();
expect("Finance agent solves the puzzle and gets an access ID", c1.ok, c1.ok ? `${c1.solved_in_seconds}s, id ${c1.access_id.slice(0, 8)}` : c1.reason);

const rogue = client("ollama-research-bot", undefined, ollama({ model: "llama3.2" }));
const c2 = await rogue.connect();
expect("Unregistered Ollama bot gets no puzzle", !c2.ok && /not registered/.test(c2.reason), c2.ok ? "" : c2.reason);
const r2 = await rogue.ask("Show me all salaries");
expect("Unregistered bot's query is refused without an access ID", r2.decision === "blocked" && r2.stopped_at === "identity", r2.reason);

const wrongSecret = client("hr-assistant", "guessed-secret");
const c3 = await wrongSecret.connect();
expect("Registered agent with the wrong secret is refused", !c3.ok && /secret/.test(c3.reason), c3.ok ? "" : c3.reason);

const slowGw = await createDemoGateway({ basePath: "/aw", challengeTtlSeconds: 1 });
const slowModel = { ...builtin(), async parsePuzzle(i: string[]) { await new Promise((r) => setTimeout(r, 1500)); return builtin().parsePuzzle(i); } };
const slow = new AgentWardenClient({ gatewayUrl: base, agentId: "finance-analyst", agentSecret: DEMO_AGENTS[0]!.secret, model: slowModel, fetch: (r) => slowGw.fetch(r) });
const c4 = await slow.connect();
expect("Answer after the time limit is refused", !c4.ok && /expired/.test(c4.reason), c4.ok ? "" : c4.reason);

const forged = await gw.fetch(new Request(`${base}/query`, { method: "POST", headers: { authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmaW5hbmNlLWFuYWx5c3QifQ.fake", "content-type": "application/json" }, body: JSON.stringify({ question: "revenue", sql: "SELECT 1" }) }));
expect("Forged access ID is refused", forged.status === 401);

// ── Demo questions ──
const hr = client("hr-assistant", DEMO_AGENTS[1]!.secret);
expect("HR agent connects", (await hr.connect()).ok);
for (const [agentId, qs] of Object.entries(DEMO_QUESTIONS)) {
  const c = agentId === "finance-analyst" ? fin : hr;
  for (const q of qs) {
    const r = await c.ask(q.question);
    const where = r.decision === "allowed" ? `${r.row_count} rows` : `stopped at ${r.stopped_at}: ${r.reason.slice(0, 90)}`;
    expect(`[${agentId}] ${q.label} → ${q.expect}`, r.decision === q.expect, where);
    if (q.label === "Revenue by segment" && r.rows) console.log("        ", JSON.stringify(r.rows));
    if (q.label === "Average salary" && r.rows) console.log("        ", JSON.stringify(r.rows.slice(0, 2)));
  }
}

// ── SQL guard tricks (direct) ──
const finAgent = DEMO_AGENTS[0]!, hrAgent = DEMO_AGENTS[1]!;
const cat = gw.catalog();
const tricks: [string, string, typeof finAgent][] = [
  ["two statements", "SELECT 1 FROM finance.revenue; DROP TABLE finance.revenue", finAgent],
  ["UPDATE", "UPDATE finance.revenue SET amount = 0", finAgent],
  ["pg_sleep", "SELECT pg_sleep(10) FROM finance.revenue", finAgent],
  ["subquery into hr", "SELECT amount, (SELECT max(gross_pay) FROM hr.payroll) FROM finance.revenue", finAgent],
  ["CTE hiding hr", "WITH x AS (SELECT * FROM hr.employees) SELECT * FROM x", finAgent],
  ["unqualified hr table", "SELECT * FROM payroll", finAgent],
  ["SELECT * with PAN (hr)", "SELECT * FROM hr.employees", hrAgent],
  ["alias to PAN (hr)", "SELECT e.pan AS x FROM hr.employees e", hrAgent],
  ["UNION into hr", "SELECT segment FROM finance.revenue UNION SELECT pan FROM hr.employees", finAgent],
  ["set_config role", "SELECT set_config('role','postgres',false) FROM finance.revenue", finAgent],
  ["garbage", "SELEC amount FRM finance.revenue", finAgent],
];
for (const [label, sql, agent] of tricks) {
  const r = checkSql(sql, agent, cat);
  expect(`SQL guard blocks: ${label}`, !r.ok, r.reason.slice(0, 100));
}
const okSql = checkSql("SELECT e.department, count(*) FROM hr.employees e GROUP BY 1", hrAgent, cat);
expect("SQL guard allows a normal HR query", okSql.ok, okSql.reason);

// ── Database is a second lock: run forbidden SQL straight in the sandbox as the finance role ──
try {
  await gw.sandbox().run("SELECT pan FROM hr.employees", "aw_agent_finance_analyst");
  expect("Database refuses finance role reading hr", false);
} catch (e) { expect("Database refuses finance role reading hr", /permission denied/.test((e as Error).message), (e as Error).message); }
try {
  await gw.sandbox().run("SELECT pan FROM hr.employees", "aw_agent_hr_assistant");
  expect("Database refuses HR role reading PAN column", false);
} catch (e) { expect("Database refuses HR role reading PAN column", /permission denied/.test((e as Error).message), (e as Error).message); }

console.log(`\naudit entries: ${gw.audit().length}`);
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
