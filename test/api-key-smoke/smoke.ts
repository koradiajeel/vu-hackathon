import { createClient } from "capgent-sdk"
import { parseCanonicalStepsFromInstructions } from "capgent-sdk/parser/heuristic"
import { solveChallengeFromSteps } from "capgent-sdk/solver"

function mustEnv(name: string): string {
  const v = (process.env[name] ?? "").trim()
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

async function main() {
  const baseUrl = (process.env.CAPAGENT_API_BASE_URL ?? "http://127.0.0.1:8787").replace(/\/+$/, "")
  const apiKey = mustEnv("CAPAGENT_API_KEY")

  const client = createClient({
    baseUrl,
    // The runtime client supports apiKey, but some workspace typings may lag.
    apiKey,
    agentName: "api-key-smoke",
    agentVersion: "0.0.0",
  } as any)

  const ch = await client.getChallenge()
  const steps = parseCanonicalStepsFromInstructions(ch.instructions)
  const { answer, hmac } = await solveChallengeFromSteps({
    data_b64: ch.data_b64,
    nonce: ch.nonce,
    steps,
  })

  const proof = await client.verifyChallenge(ch.challenge_id, answer, hmac)

  // Print only non-sensitive proof metadata
  console.log(
    JSON.stringify(
      {
        ok: true,
        challenge_id: ch.challenge_id,
        proof_expires_at: proof.expires_at,
        proof_token_prefix: proof.token.slice(0, 16) + "...",
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error("smoke_failed", err)
  process.exit(1)
})

