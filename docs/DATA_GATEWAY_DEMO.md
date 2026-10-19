# Demo script: Department Data Gateway

Takes about 6 minutes. Open **http://localhost:3000/data-gateway** (start the site with `npm run dev` in `D:\hackathon\capgent`).

## The one-line pitch

> One department's AI agent wants another department's data. AgentWarden checks **who** the agent is, **how risky** the request is, and **what SQL** it may run, and the database enforces the same rules again.

## Before you start

- **Gemini (recommended):** add `GEMINI_API_KEY=...` to `apps/web/.env.local` (free key at https://aistudio.google.com/apikey) and restart the site. The agents then use real Gemini for the puzzle and for writing SQL, so you can ask **any** question.
- **Without a key** the page shows a yellow note and the agents use the built-in demo model, which only understands the example questions. Everything else (puzzle, checks, database, sandbox) is the same real code.
- Press **Reset demo** before you begin.

## The story

The company **NexForge** has four departments, each with its own database schema:

| Schema | Holds | Sensitive? |
|---|---|---|
| `finance` | revenue, expenses, balance sheet | no |
| `production` | production runs, inventory | no |
| `hr` | employees (with **PAN, phone**), payroll (with **bank accounts**) | **yes** |
| `rnd` | research projects and **confidential design notes** | **yes** |

Three AI agents want data:

| Agent | Model | Registered? | May read |
|---|---|---|---|
| Finance Analyst | Gemini | yes, finance dept | finance + production summary/inventory, **never** hr or rnd |
| HR Assistant | Gemini | yes, hr dept | hr, **but never** PAN, phone or bank account columns |
| Research Bot | Ollama (local) | **no** | nothing |

## Click-through (each line = one click on an example, then **Ask**)

| # | Agent | Example | What to say | Result |
|---|---|---|---|---|
| 1 | Finance Analyst | Revenue by segment | "The agent solves a 30-second puzzle with its own model, gets an access ID, writes SQL, and every check passes. It runs read-only as its own database role." Open **Show the puzzle**. | ✅ 3 rows (B2G ₹2.77 Cr, B2B ₹1.33 Cr, B2C ₹25,200) |
| 2 | Research Bot | Revenue by segment | "Same harmless question, but this Ollama bot isn't registered with any department. It doesn't even get a puzzle." | ⛔ Step 1 · Identity |
| 3 | Finance Analyst | Every salary + PAN | "The request itself is scored before any SQL runs: bulk personal data, risk 0.97." Point at the SQL the model wrote: it was willing to do it. | ⛔ Step 2 · Request risk |
| 4 | Finance Analyst | Average salary (other dept) | "This request looks harmless (risk is low), but the SQL touches `hr.employees`, which finance may never read." | ⛔ Step 3 · Permissions |
| 5 | Finance Analyst | Secret R&D projects | "Same: rnd is off-limits to finance." | ⛔ Step 3 · Permissions |
| 6 | Finance Analyst | Delete old revenue | "Agents may only read. A delete is stopped at the request, and even if it weren't, the SQL check and the read-only transaction would stop it." | ⛔ Step 2 · Request risk |
| 7 | HR Assistant | Average salary | "HR may see pay, so this is allowed: department-level averages." | ✅ 6 rows |
| 8 | HR Assistant | PAN numbers | "Even HR's own agent can't pull PAN numbers or bank accounts." | ⛔ Step 2 |
| 9 | HR Assistant | Revenue (other dept) | "HR has no business in finance data: deny by default." | ⛔ Step 3 · Permissions |

Point at the right-hand panel: **What this agent may read** (green read, struck-through denied, "hides pan, phone") and the **Audit log**, which updates after every request.

## If you're asked "what if the gateway has a bug?"

The database is a second lock. Each agent runs as its own PostgreSQL role, which only has `SELECT` on its allowed tables and columns. The test suite runs forbidden SQL **directly** as those roles, and PostgreSQL answers `permission denied for schema hr` and `permission denied for table employees`. (Run `npm test` in `packages/agentwarden`.)

## If you're asked "is this a real product or a mock-up?"

- **Real:** the puzzle, signed access IDs (JWT), request scoring, SQL parsing, permission checks, database roles, read-only sandbox, audit table, and a published-ready npm package (`packages/agentwarden`).
- **Demo-only:** the company data is fake, and without a Gemini key the agents use a built-in model that knows only the example questions.
- **Docker sandbox (tested, not on the website):** each approved query runs in a fresh locked-down container (read-only file system, no Linux capabilities, 128 MB / 0.5 CPU) against PostgreSQL 16. The website page uses the in-process sandbox so it needs no Docker. To show it: start Docker Desktop, then in `packages/agentwarden` run `npm run test:docker` (starts PostgreSQL 16 from `docker-compose.yml` and runs the demo questions, one container per query; 32 checks, all passing).

## Tech stack (one slide)

| Part | Tool |
|---|---|
| npm package | `agentwarden` (TypeScript): agent client + gateway |
| Identity | Byte puzzle with SHA-256 + HMAC; access IDs are signed JWTs (`jose`), 15 min |
| Request risk | Naive Bayes injection model + data-access rules |
| SQL check | `node-sql-parser` (PostgreSQL dialect) |
| Database | PostgreSQL (embedded PGlite for the demo; real PostgreSQL via `pg`) with one role per agent |
| Sandbox | Read-only transaction as the agent's role; optional Docker container per query |
| AI models | Gemini (agents), Ollama (local), OpenRouter; built-in fallback |
| Demo site | Next.js 16 |
