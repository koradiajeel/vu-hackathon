# agentwarden

Let an AI agent from one department query another department's database **without handing it the keys**.

```
 Department's AI agent                         AgentWarden gateway                          Company database
 ─────────────────────                         ───────────────────                          ────────────────
 1. asks for a puzzle  ───────────────────────▶ only registered agents get one
    solves it with its own model (≤ 30 s) ────▶ checks answer + agent secret ──▶ access ID (15 min)
 2. "Revenue by segment in Q1?"
    its model writes SQL  ────────────────────▶ scores the request's risk
                                                parses the SQL, checks tables/columns
                                                against the department's policy
                                                runs it in a sandbox as the agent's ─────▶ read-only, own role,
                                                own database role                          column-level grants
                         ◀──────────────────── rows + a step-by-step trace + audit entry
```

## Install

```bash
npm install agentwarden
```

Optional: `npm install pg` to use a real PostgreSQL server instead of the embedded one.

## Gateway (the database side)

```ts
import { createGateway, pgliteDatabase, postgresDatabase } from "agentwarden/gateway";

const gateway = createGateway({
  database: await postgresDatabase(process.env.DATABASE_URL!), // or: await pgliteDatabase()
  jwtSecret: process.env.AGENTWARDEN_SECRET,
  agents: [
    {
      id: "finance-analyst",
      name: "Finance Analyst",
      department: "finance",
      secret: process.env.FINANCE_AGENT_SECRET!,
      policy: {
        allow: ["finance.*", "production.summary"],
        deny: ["hr.*", "rnd.*"],
        maxRows: 200,
      },
    },
    {
      id: "hr-assistant",
      name: "HR Assistant",
      department: "hr",
      secret: process.env.HR_AGENT_SECRET!,
      policy: { allow: ["hr.*"], denyColumns: ["hr.employees.pan", "hr.payroll.bank_account"] },
    },
  ],
});

// Works with anything that speaks the Fetch API (Next.js, Hono, Bun, Deno, Node adapters):
export const POST = (req: Request) => gateway.fetch(req);
```

On start-up the gateway reads the schema and creates one PostgreSQL role per agent, with `SELECT` only on the tables and columns its policy allows. **The database enforces the policy too**, not just the gateway.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/challenge` | `{ agent_id }` → a puzzle (refused for unregistered agents) |
| `POST` | `/verify` | `{ challenge_id, agent_id, agent_secret, answer, hmac }` → access ID |
| `GET` | `/catalog` | Tables and columns this agent may see |
| `POST` | `/query` | `{ question, sql }` with `Authorization: Bearer <access ID>` |
| `GET` | `/health` | Status |

## Agent (the department's side)

```ts
import { AgentWardenClient, gemini } from "agentwarden";

const agent = new AgentWardenClient({
  gatewayUrl: "https://data.company.in/api/agentwarden",
  agentId: "finance-analyst",
  agentSecret: process.env.FINANCE_AGENT_SECRET,
  model: gemini({ apiKey: process.env.GEMINI_API_KEY! }),
});

await agent.connect(); // solves the 30-second puzzle with Gemini → access ID
const r = await agent.ask("What was our revenue by segment in Q1 2026?");
console.log(r.decision, r.rows, r.trace);
```

Models: `gemini()`, `ollama()`, `openrouter()`, and `builtin()` (offline, demo questions only).

## The three checks

| Step | What is checked | Stops |
|---|---|---|
| **1. Identity** | Registered agent? Puzzle answered correctly in time? Right secret? Valid, unexpired access ID? | Unknown agents, scripts that can't follow the protocol, stolen or expired IDs |
| **2. Request risk** | The plain-English request: injection-shield model + rules for bulk personal data, deleting data, secrets, rule-bending. Score 0–1: safe < 0.45 ≤ suspicious < 0.75 ≤ blocked | "List every salary with PAN", "delete last quarter", "ignore your rules" |
| **3a. SQL check** | Exactly one `SELECT`; no dangerous functions (`pg_sleep`, `set_config`, `dblink`…); every table must exist; unparseable SQL is rejected | `DROP`, `UPDATE`, stacked queries, sleeps, file reads |
| **3b. Permissions** | Every table (including inside sub-queries, `WITH` and `UNION`) and column against the agent's policy; `SELECT *` over restricted columns | Finance reading HR, HR reading PAN numbers |
| **3c. Sandbox** | Runs as the agent's own database role in a read-only transaction with a time limit and a row cap. Docker mode: a fresh container per query with a read-only file system, no Linux capabilities and CPU/memory limits | Anything the checks above missed: the database itself says "permission denied" |

Every decision is written to `agentwarden.audit` in the database.

## Demo

```ts
import { createDemoGateway, DEMO_AGENTS, DEMO_QUESTIONS } from "agentwarden/demo";
```

This creates an in-memory "NexForge" company database (finance, hr, production and rnd schemas, fake data) and two registered agents.

## Docker sandbox mode

Each approved query runs as `psql` in a fresh `postgres:16-alpine` container (read-only file system, all capabilities dropped, no privilege escalation, 128 MB / 0.5 CPU / 64 processes, removed afterwards). It needs a real PostgreSQL server and a running Docker engine.

```bash
docker compose up -d --wait   # PostgreSQL 16 on 127.0.0.1:55432, network "agentwarden-db"
```

```ts
import { createGateway, postgresDatabase } from "agentwarden/gateway";

const gateway = createGateway({
  database: await postgresDatabase("postgres://aw_admin:aw_admin_demo_pw@127.0.0.1:55432/company"),
  agents,
  // Sandbox containers join the database's network and reach it by container name.
  sandbox: { type: "docker", dbHost: "postgres", dbName: "company", network: "agentwarden-db" },
  // Or, for a server on the host: { type: "docker", dbHost: "host.docker.internal", dbPort: 55432, dbName: "company" }
});
```

The gateway gives each agent role a random login password at start-up. `npm run test:docker` starts the compose file and runs 32 checks: the demo questions (same decisions and rows as the local sandbox), database-level denials, read-only writes, the time limit, `host.docker.internal` mode, one fresh container per query, and a probe that confirms the read-only file system, zero capabilities and the memory/CPU/process limits inside the container.

## Development

```bash
npm run build   # dist/ (esbuild bundles + .d.ts)
npm test        # 32 end-to-end checks
npm run test:docker   # Docker sandbox checks (needs Docker running)
```

## Limits (honest list)

- The request-risk model is small and English-only. It is one layer, not the only one.
- The SQL check is PostgreSQL-specific.
- The Docker sandbox needs a real PostgreSQL server and a running Docker engine; each query pays the cost of starting a container.
- Agent secrets and the signing secret must come from a secret manager in production.
