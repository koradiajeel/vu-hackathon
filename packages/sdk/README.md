<div align="center">
  <img src="https://raw.githubusercontent.com/piyushdhoka/Capgent/main/apps/web/public/logo_dark.png" alt="Capgent" width="120" />
  <h1>capgent-sdk</h1>
  <p>TypeScript SDK for <strong>Capgent</strong> — verification + identity for AI agents.</p>
  <p>
    <a href="https://capgent.vercel.app">Website</a> ·
    <a href="https://capgent.vercel.app/docs">Docs</a> ·
    <a href="https://github.com/piyushdhoka/Capgent">GitHub</a> ·
    <a href="https://x.com/piyush_dhoka27">X</a> ·
    <a href="https://www.linkedin.com/in/piyushdhoka27">LinkedIn</a>
  </p>
</div>

## Install

```bash
npm install capgent-sdk
```

## Migrating from capgent-sdk v1.x

Breaking changes in **v2**:

- **Types & helpers:** `CapagentError` → `CapgentError`, `CapagentClientOptions` → `CapgentClientOptions`, `withCapagentProof` → `withCapgentProof`.
- **Admin HTTP header:** `x-capagent-admin-key` → `x-capgent-admin-key`.
- Environment variables stay **`CAPAGENT_*`** / **`NEXT_PUBLIC_CAPAGENT_API_BASE_URL`** (unchanged).

## Basic usage

```ts
import { createClient } from "capgent-sdk";
import { parseCanonicalStepsFromInstructions } from "capgent-sdk/parser/heuristic";
import { solveChallengeFromSteps } from "capgent-sdk/solver";

const client = createClient({
  baseUrl: process.env.CAPAGENT_API_BASE_URL ?? "http://localhost:8787",
  apiKey: process.env.CAPAGENT_API_KEY,
  agentName: "my-agent",
  agentVersion: "1.0.0",
});

// 1) Fetch a challenge
const ch = await client.getChallenge();

// 2) Parse the instruction text into canonical byte-steps
const steps = parseCanonicalStepsFromInstructions(ch.instructions);

// 3) Solve the challenge (answer + HMAC)
const { answer, hmac } = await solveChallengeFromSteps({
  data_b64: ch.data_b64,
  nonce: ch.nonce,
  steps,
});

// 4) Verify to get a proof JWT
const proof = await client.verifyChallenge(ch.challenge_id, answer, hmac);

// 5) (Optional) Call a protected endpoint
await client.protectedPing(proof.token);
```

## OpenRouter-based parser (optional)

If you want to parse instructions with an LLM:

```ts
import { parseStepsWithOpenRouter } from "capgent-sdk/parser/llm-openrouter";

const steps = await parseStepsWithOpenRouter(ch.instructions, {
  apiKey: process.env.OPENROUTER_API_KEY,
});
```

## Errors

SDK methods throw `CapgentError`, with:
- `code`: one of `challenge_failed`, `verify_failed`, `protected_ping_failed`, `agent_register_failed`, `identity_token_failed`, `guestbook_sign_failed`
- `status`: HTTP status code
- `endpoint`: the endpoint that failed
