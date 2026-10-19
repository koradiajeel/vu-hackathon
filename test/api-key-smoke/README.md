# Capgent API key smoke test

This verifies your **Capgent project API key** works with `capgent-sdk` by running:

- `POST /api/challenge` (authenticated with `x-capgent-api-key`)
- local deterministic solve (no LLM/OpenRouter needed)
- `POST /api/verify/:id` → proof JWT

## Run

From repo root:

```bash
set CAPAGENT_API_BASE_URL=http://127.0.0.1:8787
set CAPAGENT_API_KEY=capg_sk_...
bun test/api-key-smoke/smoke.ts
```

Expected: prints `{ ok: true, ... }`.

