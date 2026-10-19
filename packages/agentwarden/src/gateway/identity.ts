import { SignJWT, jwtVerify } from "jose";
import { bytesToBase64, bytesToHex, hmacSha256Hex, makeSteps, randomBytes, renderInstructions, sha256Hex, applySteps, type Challenge, type PuzzleStep } from "../shared/challenge";
import { scopesFor, type AgentConfig } from "./policy";

export type AccessClaims = { sub: string; name: string; department: string; jti: string; exp: number; scopes: string[] };

type StoredChallenge = { challenge: Challenge; steps: PuzzleStep[]; expiresAt: number; issuedAt: number };

export class IdentityError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function sha256OfString(s: string) {
  return sha256Hex(new TextEncoder().encode(s));
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Step 1 — identity. Only registered agents get a puzzle. A correct, in-time answer from an
 * agent that also proves it holds its secret earns a short-lived signed access ID (JWT).
 */
export class IdentityService {
  private challenges = new Map<string, StoredChallenge>();
  private secretHashes = new Map<string, string>();
  private recentChallenges = new Map<string, number[]>();
  private key: Uint8Array;

  constructor(
    private agents: Map<string, AgentConfig>,
    opts: { jwtSecret: string; challengeTtlSeconds: number; tokenTtlSeconds: number; challengesPerMinute: number }
  ) {
    this.key = new TextEncoder().encode(opts.jwtSecret);
    this.opts = opts;
  }
  private opts: { challengeTtlSeconds: number; tokenTtlSeconds: number; challengesPerMinute: number };

  async init() {
    for (const a of this.agents.values()) this.secretHashes.set(a.id, await sha256OfString(`${a.id}:${a.secret}`));
  }

  issueChallenge(agentId: string): Challenge {
    const agent = this.agents.get(agentId);
    if (!agent) throw new IdentityError(401, "agent_not_registered", `Agent "${agentId}" is not registered with any department, so it cannot get a puzzle.`);

    const now = Date.now();
    const recent = (this.recentChallenges.get(agentId) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= this.opts.challengesPerMinute) throw new IdentityError(429, "rate_limited", "Too many puzzles requested; try again in a minute.");
    this.recentChallenges.set(agentId, [...recent, now]);
    for (const [id, c] of this.challenges) if (c.expiresAt < now) this.challenges.delete(id);

    const data = randomBytes(256);
    const steps = makeSteps(data);
    const challenge: Challenge = {
      challenge_id: crypto.randomUUID(),
      agent_id: agentId,
      data_b64: bytesToBase64(data),
      nonce: bytesToHex(randomBytes(16)),
      instructions: renderInstructions(steps),
      expires_at: new Date(now + this.opts.challengeTtlSeconds * 1000).toISOString(),
    };
    this.challenges.set(challenge.challenge_id, { challenge, steps, issuedAt: now, expiresAt: now + this.opts.challengeTtlSeconds * 1000 });
    return challenge;
  }

  async verify(input: { challenge_id: string; agent_id: string; agent_secret: string; answer: string; hmac: string }) {
    const stored = this.challenges.get(input.challenge_id);
    if (!stored) throw new IdentityError(404, "challenge_not_found", "Puzzle not found or already used.");
    this.challenges.delete(input.challenge_id); // one attempt per puzzle
    const elapsed = (Date.now() - stored.issuedAt) / 1000;
    if (Date.now() > stored.expiresAt) throw new IdentityError(410, "challenge_expired", `Puzzle expired: answered after ${elapsed.toFixed(1)}s (limit ${this.opts.challengeTtlSeconds}s).`);
    if (stored.challenge.agent_id !== input.agent_id) throw new IdentityError(401, "wrong_agent", "This puzzle was issued to a different agent.");

    const agent = this.agents.get(input.agent_id)!;
    const providedHash = await sha256OfString(`${input.agent_id}:${input.agent_secret ?? ""}`);
    if (!constantTimeEqual(providedHash, this.secretHashes.get(agent.id)!)) throw new IdentityError(401, "bad_secret", "The agent's secret is wrong.");

    const answer = await sha256Hex(applySteps(stored.challenge.data_b64, stored.steps));
    const hmac = await hmacSha256Hex(stored.challenge.nonce, answer);
    if (!constantTimeEqual(String(input.answer).toLowerCase(), answer) || !constantTimeEqual(String(input.hmac).toLowerCase(), hmac)) {
      throw new IdentityError(401, "wrong_answer", "The puzzle answer is wrong.");
    }

    const jti = crypto.randomUUID();
    const scopes = scopesFor(agent.policy);
    const exp = Math.floor(Date.now() / 1000) + this.opts.tokenTtlSeconds;
    const token = await new SignJWT({ name: agent.name, department: agent.department, scopes })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(agent.id)
      .setJti(jti)
      .setIssuer("agentwarden")
      .setAudience("agentwarden-gateway")
      .setIssuedAt()
      .setExpirationTime(exp)
      .sign(this.key);
    return { token, jti, exp, agent, scopes, elapsed };
  }

  async verifyToken(token: string): Promise<{ claims: AccessClaims; agent: AgentConfig }> {
    try {
      const { payload } = await jwtVerify(token, this.key, { issuer: "agentwarden", audience: "agentwarden-gateway" });
      const agent = this.agents.get(String(payload.sub));
      if (!agent) throw new Error("agent no longer registered");
      return { claims: payload as unknown as AccessClaims, agent };
    } catch (e) {
      throw new IdentityError(401, "invalid_access_id", `Access ID rejected: ${(e as Error).message}`);
    }
  }
}
