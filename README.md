# AgentWarden — Identity, Protection and Permissions for AI Agents

**Hackathon track:** AI for Cybersecurity & Digital Safety

> AI agents need a passport, an immune system, and a security badge that only opens the doors they need.

Built on top of [Capgent](https://github.com/piyushdhoka/Capgent) by Piyush Dhoka (Layer 1). Layers 2 and 3 and the local mode are new.

| Layer | What it does | Where |
|---|---|---|
| 1 · Identity (passport) | Agent solves a challenge → proof token → identity token tied to an owner | `apps/api/src/index.ts` (original Capgent code) |
| 2 · Injection Shield (immune system) | Scans emails/web pages before the agent reads them: Naive Bayes classifier + attack rules + hidden-text detection. Removes malicious sentences and sends a risk signal | `apps/api/src/shield/` |
| 3 · Agent IAM + sandbox (security badge) | Deny-by-default role per agent, 15-min task tokens with scopes, policy gateway that injects real credentials, owner approvals, network egress allowlist, trust score, audit log | `apps/api/src/iam/` |

## Run it locally (no cloud accounts needed)

Needs Node 20+.

```bash
npm install
npm run dev
```

Open http://localhost:3000 — everything (web app, API, database) runs in that one process.

- Database: embedded Postgres (PGlite) in `apps/web/.data/` — delete that folder to start fresh.
- Secrets: `apps/web/.env.local` (copy from `.env.example` and fill `SESSION_SECRET` and `CAPAGENT_JWT_SECRET` with any long random strings).
- Sign-up works without email verification in local mode.

## Demo pages

| Page | What judges see |
|---|---|
| `/demo` | **Live attack demo.** Four runs: no protection → data leaks; shield only; IAM only (shield "failed"); full protection. Approve/reject paused actions live. |
| `/data-gateway` | **Department data gateway** (the `agentwarden` npm package in `packages/agentwarden`). Three AI agents ask for other departments' data in plain English: puzzle-based identity, request risk score, SQL permission check, read-only sandbox with per-agent database roles. Demo script: `docs/DATA_GATEWAY_DEMO.md`. |
| `/attack-lab` | **Judge playground.** Write your own attack email, web page or README (or pick one of 7 examples: HR data, hidden text, source code, API keys, delete files, wire money, normal email), choose the agent and which layers are on, and see every step plus the damage report. Includes a "check one action" box for the gateway. |
| `/shield` | Paste any text/HTML and see flagged sentences + reasons. "Run evaluation" compares the shield with no filter and a keyword filter on held-out samples. |
| `/policies` | Edit the agent's allow / needs-approval / always-deny rules and test any action. |
| `/audit` | Every decision from all three layers + the approval queue. |

The demo agent is simulated (it obeys any instruction that reaches its context) so the demo is repeatable. Identity, shield, gateway, tokens and approvals are real code paths.

## New API endpoints (all under `/api/capgent`)

`POST /api/shield/scan` · `GET /api/shield/evaluate` · `GET|PUT /api/iam/roles/:id` · `POST /api/iam/simulate` · `POST /api/iam/task-token` (Bearer identity token) · `POST /api/gateway/execute` (Bearer task token) · `GET /api/iam/audit` · `GET /api/iam/approvals` · `POST /api/iam/approvals/:id/approve|reject` · `POST /api/demo/run`

## Honest limitations

- Shield evaluation uses a small hand-written held-out set (40 samples). Re-run on a public prompt-injection benchmark before quoting numbers externally.
- The sandbox is a policy-enforced simulation (virtual files, mailboxes, network allowlist), not container isolation.
- Layer 2/3 state (roles, audit, approvals) is in memory and resets when the server restarts.

---

# Original Capgent README

<div align="center">

<img src="apps/web/public/logo_dark.png" alt="Capgent" width="240" />

# Capgent

**Verify that automated clients can follow your protocol** — not “click the traffic lights,” but **byte-level challenges**, **cryptographic checks**, and **short-lived proof tokens** you can require before they hit your real APIs.

[Website](https://capgent.vercel.app) · [GitHub](https://github.com/piyushdhoka/Capgent) · [Docs (in app)](https://capgent.vercel.app/docs) · [X](https://x.com/piyush_dhoka27) · [LinkedIn](https://www.linkedin.com/in/piyushdhoka27)

[![Bun](https://img.shields.io/badge/Bun-000000?style=flat&logo=bun&logoColor=white)](https://bun.sh/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=flat&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)

</div>

---
<img width="1200" height="630" alt="Capgent — Agent Verification Infrastructure" src="https://github.com/user-attachments/assets/864da466-28cc-444a-be29-d530cb9c1e8a" />

## What is this?

**Capgent** is a small platform for **agent-oriented access control**:

1. A client (script, service, or “agent”) calls your API to **start a challenge**.
2. It receives **instructions** and opaque **data**; it must apply a defined set of **byte operations** (slice, XOR, hash, HMAC, etc.) and send back the correct **answer + HMAC**.
3. If correct, the API returns a **proof JWT** (short-lived). You can also register **identity** tokens and tie usage to **projects and API keys** from the dashboard.

So in practice: **generic scrapers and clients that don’t implement your flow fail**; **registered integrations that run the protocol succeed**. It is **not** a proof that the caller is “not human” — anyone who runs your client or SDK can pass. It **is** a structured **protocol + key + token** gate, similar in spirit to “OAuth for machines,” with an explicit challenge step.

---

## Who is it for?

| You want to… | Capgent helps by… |
|--------------|-------------------|
| Gate **automation** hitting your API | Requiring challenge → verify → Bearer proof (or identity) on protected routes |
| **Issue API keys** per project | Dashboard + Worker-backed project/key APIs |
| **Demo** the flow in a browser | [Playground](https://capgent.vercel.app/playground) and in-app `/docs` |
| **Let agents prove** they completed a run | Proof JWT + optional guestbook / benchmark reporting |
| **Integrate from TypeScript** | Published npm package **`capgent-sdk`** |

---

## How the pieces fit together

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Next.js    │     │ Cloudflare Worker │     │ Neon + Upstash  │
│  (apps/web) │────▶│ (apps/api, Hono) │────▶│ DB, Redis, etc. │
│  UI, auth   │     │ challenges, JWT  │     │                 │
└─────────────┘     └──────────────────┘     └─────────────────┘
       │
       └── capgent-sdk (npm) — same HTTP API from Node, Bun, Workers, etc.
```

**Typical integration flow**

1. `POST /api/challenge` — get `challenge_id`, `nonce`, `data_b64`, `instructions`.
2. Parse instructions → compute **answer** (SHA-256 of transformed bytes) and **hmac** (HMAC-SHA256 with `nonce`).
3. `POST /api/verify/{challenge_id}` — receive **proof JWT**.
4. Call **`GET /api/protected/ping`** (or your own gateway) with `Authorization: Bearer <proof-or-identity>`.

Optional: **project API key** via header `X-Capgent-Api-Key` where the API expects it. Discovery: **`GET /.well-known/capgent.json`** (legacy **`capagent.json`** still works and returns the same payload).

---

## Monorepo layout

| Path | Role |
|------|------|
| [`apps/api`](apps/api) | Hono app on **Cloudflare Workers** — challenges, verify, protected ping, agents, guestbook, benchmarks, project keys |
| [`apps/web`](apps/web) | **Next.js 16** — marketing, **dashboard**, **docs**, **playground**, email auth (Neon) |
| [`packages/sdk`](packages/sdk) | **`capgent-sdk`** — TypeScript client published to npm |
| [`agents`](agents) | Sample runners (OpenRouter / Grok / Gemini) and benchmark scripts |

**Routing note:** Dashboard auth can use [`apps/web/proxy.ts`](apps/web/proxy.ts) (Next.js proxy) for cookie/session checks on protected segments.

---

## Quick start (local)

Requires **[Bun](https://bun.sh/)** at the repo root.

```bash
bun install
```

**Terminal 1 — API** (default `http://127.0.0.1:8787`):

```bash
bun run dev:api
```

**Terminal 2 — Web** (`http://localhost:3000`):

```bash
bun run dev:web
```

**Wrangler / local Worker secrets:** use **`apps/api/.dev.vars`** (gitignored). Set at least **`UPSTASH_REDIS_REST_URL`** and **`UPSTASH_REDIS_REST_TOKEN`** if you want guestbook and benchmarks to persist beyond in-memory dev. Mirror **`CAPAGENT_*`** vars from [`apps/api/wrangler.toml`](apps/api/wrangler.toml) `[vars]` and add secrets (e.g. `DATABASE_URL`, `CAPAGENT_JWT_SECRET`) as your setup requires.

**Web env:** copy [`apps/web/.env.example`](apps/web/.env.example) to `apps/web/.env` or `.env.local` and set `NEXT_PUBLIC_CAPAGENT_API_BASE_URL` (e.g. `http://127.0.0.1:8787`), `SESSION_SECRET`, `DATABASE_URL`, and optional email/OpenRouter keys.

| Local URL | Purpose |
|-----------|---------|
| http://localhost:3000 | Landing |
| http://localhost:3000/docs | Integration guide + examples |
| http://localhost:3000/playground | Challenge → verify in the browser |
| http://localhost:3000/dashboard | Projects & API keys (after login) |
| http://127.0.0.1:8787 | Worker API base |

**Sample agents**

```bash
cd agents
# See package.json — grok/gemini samples, benchmarks
```

Copy [`agents/.env.example`](agents/.env.example) → `agents/.env.local` and set `CAPAGENT_API_BASE_URL`, `OPENROUTER_API_KEY`, etc.

### Root scripts

| Command | Purpose |
|---------|---------|
| `bun run dev:api` | Worker dev server |
| `bun run dev:web` | Next.js dev |
| `bun run build` | Build SDK + API (dry-run) + Web |
| `bun run build:sdk` | Compile `packages/sdk` → `dist/` |
| `bun run typecheck` | Typecheck API, Web, SDK |

---

## Environment variables (cheat sheet)

### Worker — [`apps/api`](apps/api)

Configure via **`wrangler.toml`** `[vars]`, **`wrangler secret put`**, and/or **`.dev.vars`** locally.

**Commonly required in production**

- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `CAPAGENT_JWT_SECRET`
- `DATABASE_URL` (Neon) — projects / API keys tied to web users
- `CAPAGENT_PUBLIC_BASE_URL`, `CAPAGENT_CORS_ORIGINS`

**Often tuned**

- `CAPAGENT_CHALLENGE_TTL_SECONDS`, `CAPAGENT_PROOF_TTL_SECONDS`, `CAPAGENT_IDENTITY_TTL_SECONDS`
- `CAPAGENT_ALLOW_PUBLIC_REGISTRATION`, `CAPAGENT_ADMIN_API_KEY`
- `CAPAGENT_RATE_LIMIT_*`, `CAPAGENT_GUESTBOOK_COOLDOWN_SECONDS`
- `CAPAGENT_FORCE_INMEMORY` — `1` only for quick local tests without Redis persistence

### Web — [`apps/web`](apps/web)

- `NEXT_PUBLIC_CAPAGENT_API_BASE_URL` — browser-facing API URL (Worker or same-origin proxy)
- `SESSION_SECRET` — cookie session (≥ 32 characters)
- `DATABASE_URL` — Neon for users, projects, keys
- SMTP / OAuth keys as needed for signup and email verification (see app env patterns)

---

## Deploy

**API (Cloudflare)**

```bash
cd apps/api
bun run deploy
```

Set Cloudflare **secrets** and **vars** to match the Worker `Env` type in [`apps/api/src/config.ts`](apps/api/src/config.ts). Do **not** use `CAPAGENT_FORCE_INMEMORY=1` in production if you rely on Redis-backed features.

**Web (e.g. Vercel)**

- Root: **`apps/web`** (or your monorepo build command).
- Set `NEXT_PUBLIC_CAPAGENT_API_BASE_URL` to your **production Worker URL**.
- Set `SESSION_SECRET`, `DATABASE_URL`, and the rest to match Neon and email.

Build from repo root:

```bash
bun run build:web
```

---

## npm: publish `capgent-sdk`

The package name on npm is **`capgent-sdk`** ([`packages/sdk`](packages/sdk)). Bump **`version`** in `packages/sdk/package.json` when you release.

**One-time:** [create an npm account](https://www.npmjs.com/signup) and log in:

```bash
npm login
```

**Every release**

```bash
cd packages/sdk
bun run build
npm publish --access public
```

Dry-run (no upload):

```bash
cd packages/sdk
bun run build
npm publish --access public --dry-run
```

After publishing, consumers install with:

```bash
npm install capgent-sdk
```

**Breaking changes** are described in [`packages/sdk/README.md`](packages/sdk/README.md) (e.g. v2 type/helper renames). Use `createClient` from `capgent-sdk` with `CAPAGENT_API_BASE_URL` / API key env vars as documented there.

---

## SDK snippet

```ts
import { createClient } from "capgent-sdk"
import { solveChallengeFromSteps } from "capgent-sdk/solver"
import { parseCanonicalStepsFromInstructions } from "capgent-sdk/parser/heuristic"

const client = createClient({
  baseUrl: process.env.CAPAGENT_API_BASE_URL!,
  apiKey: process.env.CAPAGENT_API_KEY, // project key when required
  agentName: "my-service",
  agentVersion: "1.0.0",
})

const ch = await client.getChallenge()
const steps = parseCanonicalStepsFromInstructions(ch.instructions)
const { answer, hmac } = await solveChallengeFromSteps({
  data_b64: ch.data_b64,
  nonce: ch.nonce,
  steps,
})
const proof = await client.verifyChallenge(ch.challenge_id, answer, hmac)
await client.protectedPing(proof.token)
```

Full tables, curl, and middleware patterns: **https://capgent.vercel.app/docs** (or local `/docs`).

---

## Further reading

- [`Context.md`](Context.md) — product and architecture notes
- [`packages/sdk/README.md`](packages/sdk/README.md) — SDK install, errors, OpenRouter parser

---

<div align="center">

<sub><strong>Capgent</strong> — protocol-first verification and API keys for autonomous clients.</sub>

</div>
