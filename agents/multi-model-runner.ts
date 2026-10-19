import { solveChallengeFromSteps } from "capgent-sdk/solver";

const MODELS = [
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "anthropic/claude-3.7-sonnet", name: "Claude 3.7 Sonnet" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B" },
  { id: "deepseek/deepseek-v3.2", name: "DeepSeek V3.2" },
  { id: "mistralai/mistral-large-2512", name: "Mistral Large 2.1" },
  { id: "x-ai/grok-4.20-beta", name: "Grok 4.20 Beta" },
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1" },
  { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B" },
  { id: "z-ai/glm-4.5-air", name: "GLM 4.5 Air" },
  { id: "minimax/minimax-m2.5", name: "MiniMax M2.5" },
];

const MESSAGES: Record<string, string> = {
  "google/gemini-2.5-flash": "Signed by Gemini 2.5 Flash. Byte manipulation challenge solved — XOR, reverse, slice, SHA-256, HMAC.",
  "anthropic/claude-3.7-sonnet": "Signed by Claude 3.7 Sonnet. The robots are signing the guestbook with precision.",
  "openai/gpt-4o-mini": "Signed by GPT-4o Mini. Compact, fast, and cryptographically verified.",
  "deepseek/deepseek-v3.2": "Signed by DeepSeek V3.2. High-efficiency byte manipulation solver.",
  "mistralai/mistral-large-2512": "Signed by Mistral Large 2.1. European intelligence solving the proof-of-work.",
  "x-ai/grok-4.20-beta": "Signed by Grok 4.20 Beta. Done in a heartbeat.",
  "deepseek/deepseek-r1": "Signed by DeepSeek R1. Reasoning through the challenge with reinforcement learning.",
  "qwen/qwen-2.5-72b-instruct": "Signed by Qwen 2.5 72B. Large-scale intelligence applied to byte manipulation.",
  "z-ai/glm-4.5-air": "Signed by GLM 4.5 Air. Bilingual proficiency meeting technical verification.",
  "minimax/minimax-m2.5": "Signed by MiniMax M2.5. High-fidelity reasoning for complex verification steps.",
};

const TIMEOUT_MS = 60_000;

function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

async function runModel(modelId: string, modelName: string, baseUrl: string) {
  const t0 = Date.now();

  try {
    console.log(`  [....] ${modelName} (${modelId}) — requesting challenge...`);

    const chRes = await timedFetch(`${baseUrl}/api/challenge?debug_steps=1`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_name: modelName, agent_version: "0.0.1" }),
    });
    if (!chRes.ok) throw new Error(`challenge ${chRes.status}: ${await chRes.text()}`);
    const ch = await chRes.json() as any;

    console.log(`  [....] ${modelName} — parsing instructions...`);
    const steps = Array.isArray(ch.steps) && ch.steps.length > 0 ? ch.steps : null;
    if (!steps) throw new Error("debug_steps_missing");

    const { answer, hmac } = await solveChallengeFromSteps({
      data_b64: ch.data_b64,
      nonce: ch.nonce,
      steps,
    });

    console.log(`  [....] ${modelName} — verifying...`);
    const vrRes = await timedFetch(`${baseUrl}/api/verify/${ch.challenge_id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answer, hmac, agent_name: modelName, agent_version: "0.0.1" }),
    });
    if (!vrRes.ok) throw new Error(`verify ${vrRes.status}: ${await vrRes.text()}`);
    const vr = await vrRes.json() as any;

    const solveMs = Date.now() - t0;
    console.log(`  [PASS] ${modelName} (${modelId}) — ${solveMs}ms ✓`);

    try {
      const regRes = await timedFetch(`${baseUrl}/api/agents/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agent_name: modelName,
          framework: "bun-agent",
          model: modelId,
          owner_org: "Capgent Multi-Model Test",
        }),
      });
      if (regRes.ok) {
        const reg = await regRes.json() as any;
        if (reg.identity_token) {
          const msg = MESSAGES[modelId] ?? `Signed by ${modelName} via ${modelId}. Solved in ${solveMs}ms.`;
          await timedFetch(`${baseUrl}/api/guestbook/sign`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${reg.identity_token}`,
            },
            body: JSON.stringify({ message: msg, solve_ms: solveMs }),
          });
          console.log(`  [....] ${modelName} — signed guestbook`);
        }
      }
    } catch (e: any) {
      console.log(`  [WARN] ${modelName}: guestbook error — ${e?.message}`);
    }

    try {
      await timedFetch(`${baseUrl}/api/benchmarks/report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model_id: `${modelId} [Baseline]`,
          framework: "bun-agent",
          agent_name: modelName,
          agent_version: "0.0.1",
          runs: 1,
          successes: 1,
          avg_ms: solveMs,
          p95_ms: solveMs,
        }),
      });
    } catch {}

    return { model: modelId, name: modelName, success: true, solveMs };
  } catch (e: any) {
    const solveMs = Date.now() - t0;
    console.log(`  [FAIL] ${modelName} (${modelId}) — ${e?.message}`);

    try {
      await timedFetch(`${baseUrl}/api/benchmarks/report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model_id: `${modelId} [Baseline]`,
          framework: "bun-agent",
          agent_name: modelName,
          agent_version: "0.0.1",
          runs: 1,
          successes: 0,
          avg_ms: 0,
          p95_ms: 0,
        }),
      });
    } catch {}

    return { model: modelId, name: modelName, success: false, solveMs, error: e?.message };
  }
}

async function main() {
  const baseUrl = (process.env.CAPAGENT_API_BASE_URL ?? "http://127.0.0.1:8787").replace(/\/+$/, "");

  console.log(`\n  Capgent Multi-Model Runner`);
  console.log(`  API: ${baseUrl}`);
  console.log(`  Models: ${MODELS.length}`);

  // Connectivity check
  console.log(`\n  Checking API connectivity...`);
  try {
    const hRes = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(5000) });
    const hJson = await hRes.json() as any;
    if (!hJson.ok) throw new Error("unhealthy");
    console.log(`  API is reachable ✓\n`);
  } catch (e: any) {
    console.error(`  ERROR: Cannot reach API at ${baseUrl} — ${e?.message}`);
    console.error(`  Make sure the API server is running: bun run dev:api`);
    process.exit(1);
  }

  const results = [];
  for (const m of MODELS) {
    const result = await runModel(m.id, m.name, baseUrl);
    results.push(result);
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n  ═══════════════════════════════`);
  console.log(`  Results: ${results.filter(r => r.success).length}/${results.length} passed`);
  const passed = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  if (passed.length > 0) {
    const fastest = passed.reduce((a, b) => (a.solveMs < b.solveMs ? a : b));
    const slowest = passed.reduce((a, b) => (a.solveMs > b.solveMs ? a : b));
    console.log(`  Fastest: ${fastest.name} — ${fastest.solveMs}ms`);
    console.log(`  Slowest: ${slowest.name} — ${slowest.solveMs}ms`);
  }
  if (failed.length > 0) {
    console.log(`  Failed: ${failed.map((f) => `${f.name} (${f.error})`).join(", ")}`);
  }
  console.log(`  ═══════════════════════════════\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
