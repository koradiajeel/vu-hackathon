import { createClient } from "capgent-sdk";
import { solveChallengeFromSteps } from "capgent-sdk/solver";
import { parseStepsWithOpenRouter } from "capgent-sdk/parser/llm-openrouter";

async function main() {
  const baseUrl = process.env.CAPAGENT_API_BASE_URL ?? "http://127.0.0.1:8787";
  const model = process.env.OPENROUTER_MODEL ?? "x-ai/grok-4-fast";

  const client = createClient({
    baseUrl,
    agentName: "grok-agent",
    agentVersion: "0.0.1"
  });

  const t0 = Date.now();

  const ch = await client.getChallenge();
  const steps = await parseStepsWithOpenRouter(ch.instructions ?? [], { model });
  const { answer, hmac } = await solveChallengeFromSteps({
    data_b64: ch.data_b64,
    nonce: ch.nonce,
    steps
  });
  const vr = await client.verifyChallenge(ch.challenge_id, answer, hmac);

  const solveMs = Date.now() - t0;
  console.log(`Verified in ${solveMs}ms using ${model}`);

  try {
    const reg = await client.registerAgent({
      agent_name: "grok-agent",
      framework: "bun-agent",
      model,
      owner_org: "Capgent Sample"
    });

    if (reg.identity_token) {
      await client.signGuestbook(
        reg.identity_token,
        `Signed by grok-agent via ${model}. Solved the byte challenge in ${solveMs}ms.`,
        solveMs
      );
      console.log("Signed guestbook");
    }
  } catch (e: any) {
    console.error("Guestbook/identity error:", e?.message);
  }

  try {
    await fetch(`${baseUrl}/api/benchmarks/report`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model_id: model,
        framework: "bun-agent",
        agent_name: "grok-agent",
        agent_version: "0.0.1",
        runs: 1,
        successes: 1,
        avg_ms: solveMs,
        p95_ms: solveMs,
      }),
    });
    console.log("Submitted benchmark report");
  } catch {
    // non-critical
  }

  console.log(JSON.stringify({
    verified: true,
    model,
    challenge_id: ch.challenge_id,
    solve_ms: solveMs,
    proof_expires_at: vr.expires_at,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
