import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./config";
import {
  allowPublicRegistration,
  forceInMemory,
  getAdminApiKey,
  getBenchmarkReportRateLimitPerMinute,
  getChallengeRateLimitPerMinute,
  getChallengeTtlSeconds,
  getCorsOrigins,
  getGuestbookCooldownSeconds,
  getGuestbookSignRateLimitPerMinute,
  getIdentityTtlSeconds,
  getProofTtlSeconds
} from "./config";
import { generateChallenge } from "./challenge/generate";
import type { StoredChallenge } from "./challenge/types";
import { applySteps, hmacSha256Hex, sha256Hex } from "./challenge/eval";
import { canUseRedis, createRedis } from "./storage/redis";
import { createInMemoryStore, createRedisStore, type Store } from "./storage/store";
import { AgentIdentityClaims, signIdentityJwt, signProofJwt, verifyIdentityJwt, verifyProofJwt } from "./auth/jwt";
import { verifyWebSessionFromCookie } from "./auth/web-session";
import type { AgentRecord } from "./identity/store";
import { getAgentById, revokeAgent, saveAgent } from "./identity/store";
import type { ApiKeyRecord, Project } from "./projects/store";
import { deleteApiKey, deleteProject, getApiKeyById, getProjectById, getProjectForApiKeyHash, listApiKeysForProject, listProjectsForOwner, saveApiKey, saveProject } from "./projects/store";
import type { GuestbookEntry } from "./guestbook/store";
import { addGuestbookEntry, getGuestbookEntries, clearGuestbook } from "./guestbook/store";
import { getBenchmarkReports, saveBenchmarkReport, type BenchmarkReport } from "./benchmarks/store";
import { registerShieldIamRoutes } from "./shield-iam-routes";

const app = new Hono<{ Bindings: Env }>();

// BenchmarkReport moved to ./benchmarks/store.ts

type AgentRegisterRequest = {
  agent_name?: string;
  framework?: string;
  model?: string;
  owner_org?: string;
};

type AgentTokenRequest = {
  agent_id?: string;
  agent_secret?: string;
  proof_token?: string;
};

type ProjectCreateRequest = {
  name?: string;
  owner_id?: string;
  label?: string;
};

type ProjectKeyCreateRequest = {
  project_id?: string;
  label?: string;
  expires_at?: string;
};

async function sha256HexOfString(input: string) {
  const bytes = new TextEncoder().encode(input);
  return sha256Hex(bytes);
}

function getStore(env: Env): Store {
  return !forceInMemory(env) && canUseRedis(env) ? createRedisStore(createRedis(env)) : createInMemoryStore();
}

function getClientKey(c: { req: { header(name: string): string | undefined } }): string {
  const cf = (c.req.header("cf-connecting-ip") ?? "").trim();
  if (cf) return cf;
  const xff = (c.req.header("x-forwarded-for") ?? "").split(",")[0]?.trim();
  if (xff) return xff;
  return "unknown-client";
}

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

async function checkRateLimit(
  env: Env,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const store = getStore(env);
  const now = Date.now();
  const current = (await store.getJson<{ count: number; reset_at_ms: number }>(key)) ?? null;

  if (!current || now >= current.reset_at_ms) {
    const resetAt = now + windowSeconds * 1000;
    await store.setJson(key, { count: 1, reset_at_ms: resetAt }, windowSeconds);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.reset_at_ms - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  const nextCount = current.count + 1;
  const ttl = Math.max(1, Math.ceil((current.reset_at_ms - now) / 1000));
  await store.setJson(key, { count: nextCount, reset_at_ms: current.reset_at_ms }, ttl);
  return { allowed: true, retryAfterSeconds: 0 };
}

function normalizeMessage(msg: string): string {
  return msg.toLowerCase().replace(/\s+/g, " ").trim();
}

function getSpamMessageError(message: string): string | null {
  if (message.length > 500) return "message_too_long";
  const words = message.trim().split(/\s+/).filter(Boolean);
  if (words.length > 80) return "message_too_many_words";

  const normalized = normalizeMessage(message);
  const bannedPatterns = [
    "http://",
    "https://",
    "buy now",
    "free money",
    "telegram",
    "discord.gg",
    "casino",
    "airdrop",
    "viagra"
  ];
  if (bannedPatterns.some((x) => normalized.includes(x))) return "message_blocked_content";
  if (/([a-z0-9])\1{8,}/i.test(message)) return "message_repetitive_content";

  return null;
}

async function hashApiKeySecret(secret: string): Promise<string> {
  return sha256HexOfString(secret);
}

type ApiKeyContext = {
  project: Project;
  apiKey: ApiKeyRecord;
};

async function getApiKeyContext(
  c: { env: Env; req: { header(name: string): string | undefined } }
): Promise<ApiKeyContext | null> {
  const header =
    c.req.header("x-capgent-api-key") ??
    c.req.header("X-Capgent-Api-Key") ??
    "";
  const apiKeyPlain = header.trim();
  if (!apiKeyPlain) {
    return null;
  }
  const keyHash = await hashApiKeySecret(apiKeyPlain);
  const ctx = await getProjectForApiKeyHash(c.env, keyHash);
  if (!ctx) {
    return null;
  }
  return ctx;
}

app.onError((err, c) => {
  console.error("capgent_error", err);
  return c.json({ error: "internal_error", message: err?.message ?? String(err) }, 500);
});

app.use("*", async (c, next) => {
  const allowList = getCorsOrigins(c.env);
  const origin = c.req.header("origin") ?? "";

  const corsMiddleware = cors({
    origin: (incoming) => {
      if (allowList.length === 0) return incoming; // permissive if not configured
      if (!incoming) return "";
      return allowList.includes(incoming) ? incoming : "";
    },
    allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true
  });

  return corsMiddleware(c, next);
});

app.get("/health", (c) => c.json({ ok: true }));

// Layer 2 (Injection Shield) and Layer 3 (Agent IAM + sandbox gateway)
registerShieldIamRoutes(app);

async function requireWebUser(c: { env: Env; req: { header(name: string): string | undefined } }) {
  const cookieHeader = c.req.header("cookie") ?? c.req.header("Cookie") ?? "";
  const session = await verifyWebSessionFromCookie(c.env, cookieHeader).catch(() => null);
  if (!session) return null;
  return session;
}

app.get("/api/me/projects", async (c) => {
  const user = await requireWebUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const projects = await listProjectsForOwner(c.env, user.userId);
  return c.json({ projects });
});

app.post("/api/me/projects", async (c) => {
  const user = await requireWebUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = (await c.req.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim();
  if (!name) return c.json({ error: "missing_project_name" }, 400);

  const now = new Date().toISOString();
  const projectId = crypto.randomUUID();
  const project: Project = {
    project_id: projectId,
    name,
    created_at: now,
    owner_id: user.userId,
  };

  await saveProject(c.env, project);
  return c.json({ project: { project_id: project.project_id, name: project.name, created_at: project.created_at } });
});

app.delete("/api/me/projects/:projectId", async (c) => {
  const user = await requireWebUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const projectId = c.req.param("projectId");
  const project = await getProjectById(c.env, projectId);
  if (!project) return c.json({ error: "project_not_found" }, 404);
  if (project.owner_id !== user.userId) return c.json({ error: "forbidden" }, 403);

  await deleteProject(c.env, projectId);
  return c.json({ ok: true });
});

app.get("/api/me/projects/:projectId/keys", async (c) => {
  const user = await requireWebUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const projectId = c.req.param("projectId");
  const project = await getProjectById(c.env, projectId);
  if (!project) return c.json({ error: "project_not_found" }, 404);
  if (project.owner_id !== user.userId) return c.json({ error: "forbidden" }, 403);

  const keys = await listApiKeysForProject(c.env, projectId);
  return c.json({
    project: { project_id: project.project_id, name: project.name, created_at: project.created_at },
    api_keys: keys.map((k) => ({
      key_id: k.key_id,
      label: k.label,
      created_at: k.created_at,
      expires_at: k.expires_at ?? null,
    })),
  });
});

app.post("/api/me/projects/:projectId/keys", async (c) => {
  const user = await requireWebUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const projectId = c.req.param("projectId");
  const project = await getProjectById(c.env, projectId);
  if (!project) return c.json({ error: "project_not_found" }, 404);
  if (project.owner_id !== user.userId) return c.json({ error: "forbidden" }, 403);

  const body = (await c.req.json().catch(() => null)) as { label?: string; expires_at?: string | null } | null;
  const label = body?.label?.trim() || null;
  const expiresAt = body?.expires_at?.trim() || null;

  const now = new Date().toISOString();
  const keyId = crypto.randomUUID();
  const rawKey = `capg_sk_${crypto.randomUUID().replace(/-/g, "")}`;
  const keyHash = await hashApiKeySecret(rawKey);
  const apiKey: ApiKeyRecord = {
    key_id: keyId,
    project_id: projectId,
    key_hash: keyHash,
    label,
    created_at: now,
    expires_at: expiresAt || null,
  };

  await saveApiKey(c.env, apiKey);
  return c.json({ project_id: projectId, api_key: rawKey });
});

app.delete("/api/me/projects/:projectId/keys/:keyId", async (c) => {
  const user = await requireWebUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const projectId = c.req.param("projectId");
  const keyId = c.req.param("keyId");

  const project = await getProjectById(c.env, projectId);
  if (!project) return c.json({ error: "project_not_found" }, 404);
  if (project.owner_id !== user.userId) return c.json({ error: "forbidden" }, 403);

  const key = await getApiKeyById(c.env, keyId);
  if (!key) return c.json({ error: "key_not_found" }, 404);
  if (key.project_id !== projectId) return c.json({ error: "key_project_mismatch" }, 400);

  await deleteApiKey(c.env, keyId);
  return c.json({ ok: true });
});

app.post("/api/projects", async (c) => {
  const adminKey = getAdminApiKey(c.env);
  const header = c.req.header("x-capgent-admin-key") ?? "";
  if (!adminKey || header !== adminKey) {
    return c.json({ error: "admin_key_required" }, 401);
  }

  const body = (await c.req.json().catch(() => null)) as ProjectCreateRequest | null;
  const name = body?.name?.trim();
  if (!name) return c.json({ error: "missing_project_name" }, 400);

  const now = new Date().toISOString();
  const projectId = crypto.randomUUID();
  const project: Project = {
    project_id: projectId,
    name,
    created_at: now,
    owner_id: body?.owner_id?.trim() || null
  };

  const keyId = crypto.randomUUID();
  await saveProject(c.env, project);

  return c.json({
    project: {
      project_id: project.project_id,
      name: project.name,
      created_at: project.created_at,
      owner_id: project.owner_id
    }
  });
});

app.post("/api/projects/keys", async (c) => {
  const adminKey = getAdminApiKey(c.env);
  const header = c.req.header("x-capgent-admin-key") ?? "";
  if (!adminKey || header !== adminKey) {
    return c.json({ error: "admin_key_required" }, 401);
  }

  const body = (await c.req.json().catch(() => null)) as ProjectKeyCreateRequest | null;
  const projectId = body?.project_id?.trim();
  if (!projectId) return c.json({ error: "missing_project_id" }, 400);

  const project = await getProjectById(c.env, projectId);
  if (!project) return c.json({ error: "project_not_found" }, 404);

  const now = new Date().toISOString();
  const keyId = crypto.randomUUID();
  const rawKey = `capg_sk_${crypto.randomUUID().replace(/-/g, "")}`;
  const keyHash = await hashApiKeySecret(rawKey);
  const apiKey: ApiKeyRecord = {
    key_id: keyId,
    project_id: projectId,
    key_hash: keyHash,
    label: body?.label?.trim() || null,
    created_at: now,
    expires_at: body?.expires_at || null
  };

  await saveApiKey(c.env, apiKey);

  return c.json({
    project_id: projectId,
    api_key: rawKey
  });
});

app.get("/api/projects/:projectId", async (c) => {
  const adminKey = getAdminApiKey(c.env);
  const header = c.req.header("x-capgent-admin-key") ?? "";
  if (!adminKey || header !== adminKey) {
    return c.json({ error: "admin_key_required" }, 401);
  }

  const projectId = c.req.param("projectId");
  const project = await getProjectById(c.env, projectId);
  if (!project) return c.json({ error: "project_not_found" }, 404);

  const keys = await listApiKeysForProject(c.env, projectId);

  return c.json({
    project,
    api_keys: keys.map((k) => ({
      key_id: k.key_id,
      label: k.label,
      created_at: k.created_at,
      expires_at: k.expires_at
    }))
  });
});

app.delete("/api/projects/keys/:keyId", async (c) => {
  const adminKey = getAdminApiKey(c.env);
  const header = c.req.header("x-capgent-admin-key") ?? "";
  if (!adminKey || header !== adminKey) {
    return c.json({ error: "admin_key_required" }, 401);
  }

  const keyId = c.req.param("keyId");
  await deleteApiKey(c.env, keyId);

  return c.json({ ok: true });
});

app.post("/api/agents/register", async (c) => {
  if (!allowPublicRegistration(c.env)) {
    const adminKey = getAdminApiKey(c.env);
    const header = c.req.header("x-capgent-admin-key") ?? "";
    if (!adminKey || header !== adminKey) {
      return c.json({ error: "admin_key_required" }, 401);
    }
  }

  const body = (await c.req.json().catch(() => null)) as AgentRegisterRequest | null;
  const name = body?.agent_name?.trim();
  if (!name) return c.json({ error: "missing_agent_name" }, 400);

  const now = new Date().toISOString();
  const agentId = crypto.randomUUID();
  const secretRaw = crypto.randomUUID().replace(/-/g, "");
  const secretHash = await sha256HexOfString(`${agentId}:${secretRaw}`);

  const agent: AgentRecord = {
    agent_id: agentId,
    agent_name: name,
    framework: body?.framework?.trim() || undefined,
    model: body?.model?.trim() || undefined,
    owner_org: body?.owner_org?.trim() || undefined,
    created_at: now,
    capability_score: null,
    safety_score: null,
    last_verified: null,
    revoked_at: null,
    secret_hash: secretHash
  };

  await saveAgent(c.env, agent);

  const identityTtl = getIdentityTtlSeconds(c.env);
  const claims: AgentIdentityClaims = {
    typ: "capgent_identity",
    agent_id: agent.agent_id,
    agent_name: agent.agent_name,
    framework: agent.framework,
    model: agent.model,
    owner_org: agent.owner_org,
    capability_score: agent.capability_score ?? undefined,
    safety_score: agent.safety_score ?? undefined,
    last_verified: agent.last_verified ?? null
  };
  const { jwt, exp } = await signIdentityJwt(c.env, claims, identityTtl);

  return c.json({
    agent_id: agentId,
    agent_secret: secretRaw,
    identity_token: jwt,
    identity_expires_at: new Date(exp * 1000).toISOString()
  });
});

app.post("/api/agents/token", async (c) => {
  const body = (await c.req.json().catch(() => null)) as AgentTokenRequest | null;
  if (!body?.agent_id || !body?.agent_secret) {
    return c.json({ error: "missing_agent_credentials" }, 400);
  }

  const agent = (await getAgentById(c.env, body.agent_id)) ?? null;
  if (!agent) return c.json({ error: "agent_not_found" }, 404);
  if (agent.revoked_at) return c.json({ error: "agent_revoked" }, 403);

  const expectedHash = agent.secret_hash;
  const providedHash = await sha256HexOfString(`${agent.agent_id}:${body.agent_secret}`);
  if (!constantTimeEqualHex(expectedHash, providedHash)) {
    return c.json({ error: "invalid_agent_secret" }, 401);
  }

  let lastVerified = agent.last_verified ?? null;

  if (body.proof_token) {
    try {
      const proof = await verifyProofJwt(c.env, body.proof_token);
      if (typeof proof.challenge_id !== "string") {
        throw new Error("invalid_proof_payload");
      }
      lastVerified = new Date().toISOString();
      agent.last_verified = lastVerified;
      await saveAgent(c.env, agent);
    } catch {
      return c.json({ error: "invalid_proof_token" }, 401);
    }
  }

  const identityTtl = getIdentityTtlSeconds(c.env);
  const claims: AgentIdentityClaims = {
    typ: "capgent_identity",
    agent_id: agent.agent_id,
    agent_name: agent.agent_name,
    framework: agent.framework,
    model: agent.model,
    owner_org: agent.owner_org,
    capability_score: agent.capability_score ?? undefined,
    safety_score: agent.safety_score ?? undefined,
    last_verified: lastVerified
  };
  const { jwt, exp } = await signIdentityJwt(c.env, claims, identityTtl);

  return c.json({ token: jwt, expires_at: new Date(exp * 1000).toISOString() });
});

app.post("/api/agents/refresh", async (c) => {
  const auth = c.req.header("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!token) return c.json({ error: "missing_bearer_token" }, 401);

  let claims: AgentIdentityClaims;
  try {
    claims = (await verifyIdentityJwt(c.env, token)) as AgentIdentityClaims;
  } catch {
    return c.json({ error: "invalid_identity_token" }, 401);
  }

  const agent = (await getAgentById(c.env, claims.agent_id)) ?? null;
  if (!agent) return c.json({ error: "agent_not_found" }, 404);
  if (agent.revoked_at) return c.json({ error: "agent_revoked" }, 403);

  const identityTtl = getIdentityTtlSeconds(c.env);
  const nextClaims: AgentIdentityClaims = {
    typ: "capgent_identity",
    agent_id: agent.agent_id,
    agent_name: agent.agent_name,
    framework: agent.framework,
    model: agent.model,
    owner_org: agent.owner_org,
    capability_score: agent.capability_score ?? claims.capability_score,
    safety_score: agent.safety_score ?? claims.safety_score,
    last_verified: agent.last_verified ?? claims.last_verified ?? null
  };
  const { jwt, exp } = await signIdentityJwt(c.env, nextClaims, identityTtl);

  return c.json({ token: jwt, expires_at: new Date(exp * 1000).toISOString() });
});

app.post("/api/agents/revoke", async (c) => {
  const body = (await c.req.json().catch(() => null)) as { agent_id?: string } | null;
  if (!body?.agent_id) return c.json({ error: "missing_agent_id" }, 400);

  const updated = await revokeAgent(c.env, body.agent_id);
  if (!updated) return c.json({ error: "agent_not_found" }, 404);

  return c.json({ ok: true, revoked_at: updated.revoked_at });
});

app.post("/api/challenge", async (c) => {
  const challengeLimit = getChallengeRateLimitPerMinute(c.env);
  const clientKey = getClientKey(c);
  const rate = await checkRateLimit(c.env, `ratelimit:challenge:${clientKey}`, challengeLimit, 60);
  if (!rate.allowed) {
    return c.json(
      { error: "rate_limited", endpoint: "/api/challenge", retry_after_seconds: rate.retryAfterSeconds },
      429,
      { "Retry-After": String(rate.retryAfterSeconds) }
    );
  }

  const apiCtx = await getApiKeyContext(c);
  const projectId = apiCtx?.project.project_id;

  const body = (await c.req.json().catch(() => null)) as null | { agent_name?: string; agent_version?: string };
  const agentName = body?.agent_name?.trim() || "unknown-agent";
  const agentVersion = body?.agent_version?.trim() || "0";

  const challengeId = crypto.randomUUID();
  const gen = generateChallenge(challengeId);
  const ttl = getChallengeTtlSeconds(c.env);
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  const stored: StoredChallenge = {
    challenge_id: challengeId,
    issued_at: issuedAt,
    expires_at: expiresAt,
    nonce: gen.nonce,
    data_b64: gen.data_b64,
    steps: gen.steps,
    instructions: gen.instructions,
    agent_name: agentName,
    agent_version: agentVersion,
    project_id: projectId
  };

  const store = getStore(c.env);
  await store.setJson(`challenge:${challengeId}`, stored, ttl);

  const includeSteps = c.req.query("debug_steps") === "1";
  return c.json({
    challenge_id: gen.challenge_id,
    nonce: gen.nonce,
    data_b64: gen.data_b64,
    instructions: gen.instructions,
    ...(includeSteps ? { steps: gen.steps } : {}),
    expires_at: expiresAt
  });
});

function constantTimeEqualHex(a: string, b: string) {
  const aa = a.trim().toLowerCase();
  const bb = b.trim().toLowerCase();
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
  return diff === 0;
}

app.post("/api/verify/:challengeId", async (c) => {
  const challengeId = c.req.param("challengeId");
  const store = getStore(c.env);
  const stored = (await store.getJson<StoredChallenge>(`challenge:${challengeId}`)) ?? null;
  if (!stored) return c.json({ error: "challenge_not_found_or_expired" }, 404);
  if (stored.expires_at) {
    const nowMs = Date.now();
    const expMs = Number.isFinite(Date.parse(stored.expires_at)) ? Date.parse(stored.expires_at) : 0;
    if (!expMs || nowMs > expMs) {
      await store.del(`challenge:${challengeId}`).catch(() => {});
      return c.json({ error: "challenge_expired" }, 410);
    }
  }
  if (!stored.nonce || stored.nonce.length < 2) return c.json({ error: "stored_nonce_missing" }, 500);

  const body = (await c.req.json().catch(() => null)) as null | {
    answer?: string;
    hmac?: string;
    agent_name?: string;
    agent_version?: string;
  };
  if (!body?.answer || !body?.hmac) return c.json({ error: "missing_answer_or_hmac" }, 400);

  const concat = applySteps(stored.data_b64, stored.steps);
  const expectedAnswer = await sha256Hex(concat);
  const expectedHmac = await hmacSha256Hex(stored.nonce, expectedAnswer);

  const okAnswer = constantTimeEqualHex(body.answer, expectedAnswer);
  const okHmac = constantTimeEqualHex(body.hmac, expectedHmac);
  if (!okAnswer || !okHmac) return c.json({ error: "invalid_solution" }, 401);

  await store.del(`challenge:${challengeId}`);

  const proofTtl = getProofTtlSeconds(c.env);
  const { jwt, exp } = await signProofJwt(
    c.env,
    {
      typ: "capgent_proof",
      challenge_id: challengeId,
      agent_name: body.agent_name?.trim() || stored.agent_name,
      agent_version: body.agent_version?.trim() || stored.agent_version
    },
    proofTtl
  );

  return c.json({ token: jwt, expires_at: new Date(exp * 1000).toISOString() });
});

app.get("/api/protected/ping", async (c) => {
  const base = (c.env.CAPAGENT_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "") || "http://localhost:8787";
  const auth = c.req.header("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";

  function unauthorized(detail: string) {
    return c.json(
      {
        error: detail,
        capgent: {
          challenge_endpoint: `${base}/api/challenge`,
          verify_endpoint: `${base}/api/verify/{challenge_id}`,
          well_known: `${base}/.well-known/capgent.json`
        }
      },
      401,
      {
        "WWW-Authenticate": `Bearer realm="capgent", challenge_endpoint="${base}/api/challenge"`
      }
    );
  }

  if (!token) return unauthorized("missing_bearer_token");

  try {
    const proof = await verifyProofJwt(c.env, token);
    return c.json({ ok: true, type: "proof", claims: proof });
  } catch {
    try {
      const identity = await verifyIdentityJwt(c.env, token);
      return c.json({ ok: true, type: "identity", claims: identity });
    } catch {
      return unauthorized("invalid_token");
    }
  }
});

app.post("/api/benchmarks/report", async (c) => {
  const benchmarkLimit = getBenchmarkReportRateLimitPerMinute(c.env);
  const clientKey = getClientKey(c);
  const rate = await checkRateLimit(c.env, `ratelimit:benchmark:${clientKey}`, benchmarkLimit, 60);
  if (!rate.allowed) {
    return c.json(
      { error: "rate_limited", endpoint: "/api/benchmarks/report", retry_after_seconds: rate.retryAfterSeconds },
      429,
      { "Retry-After": String(rate.retryAfterSeconds) }
    );
  }

  const apiCtx = await getApiKeyContext(c);
  const projectId = apiCtx?.project.project_id;
  const body = (await c.req.json().catch(() => null)) as null | {
    model_id?: string;
    framework?: string;
    agent_name?: string;
    agent_version?: string;
    runs?: number;
    successes?: number;
    avg_ms?: number;
    p95_ms?: number;
  };

  if (!body?.model_id || !body?.framework || !body?.runs || body.runs <= 0) {
    return c.json({ error: "invalid_benchmark_payload" }, 400);
  }

  const now = new Date().toISOString();
  const incomingRuns = Number(body.runs);
  const incomingSuccesses = Number(body.successes ?? 0);
  const incomingAvgRaw = Number(body.avg_ms ?? 0);
  const incomingP95Raw = Number(body.p95_ms ?? 0);
  const incomingAvg = Number.isFinite(incomingAvgRaw) ? Math.max(0, Math.min(incomingAvgRaw, 60_000)) : 0;
  const incomingP95 = Number.isFinite(incomingP95Raw) ? Math.max(0, Math.min(incomingP95Raw, 60_000)) : 0;

  const existing = await getBenchmarkReports(c.env);

  const modelKey = String(body.model_id).toLowerCase().trim();
  const existingIdx = existing.findIndex((r) => r.model_id.toLowerCase().trim() === modelKey);

  let report: BenchmarkReport;

  if (existingIdx >= 0) {
    const prev = existing[existingIdx]!;
    const totalRuns = prev.runs + incomingRuns;
    const totalSuccesses = prev.successes + incomingSuccesses;
    const prevSuccessRuns = Math.max(0, Number((prev as any).success_runs ?? prev.successes ?? 0));
    const nextSuccessRuns = prevSuccessRuns + incomingSuccesses;
    const weightedAvg =
      nextSuccessRuns > 0
        ? (prev.avg_ms * prevSuccessRuns + incomingAvg * incomingSuccesses) / nextSuccessRuns
        : 0;
    const weightedP95 = incomingSuccesses > 0 ? Math.max(prev.p95_ms, incomingP95) : prev.p95_ms;
    report = {
      ...prev,
      framework: body.framework ? String(body.framework) : prev.framework,
      agent_name: (body.agent_name ?? prev.agent_name).trim() || prev.agent_name,
      agent_version: (body.agent_version ?? prev.agent_version).trim() || prev.agent_version,
      runs: totalRuns,
      successes: totalSuccesses,
      success_runs: nextSuccessRuns,
      avg_ms: Math.round(weightedAvg), // Database expects integers
      p95_ms: Math.round(weightedP95),
      created_at: now
    };
  } else {
    report = {
      id: crypto.randomUUID(),
      model_id: String(body.model_id),
      framework: String(body.framework),
      agent_name: (body.agent_name ?? "unknown-agent").trim() || "unknown-agent",
      agent_version: (body.agent_version ?? "0.0.0").trim() || "0.0.0",
      ...(projectId ? { project_id: projectId } : {}),
      runs: incomingRuns,
      successes: incomingSuccesses,
      success_runs: incomingSuccesses,
      avg_ms: Math.round(incomingAvg),
      p95_ms: Math.round(incomingP95),
      created_at: now
    };
  }

  await saveBenchmarkReport(c.env, report);

  return c.json({ ok: true, report });
});

app.get("/api/benchmarks", async (c) => {
  const reports = await getBenchmarkReports(c.env);
  return c.json({ reports });
});

app.delete("/api/benchmarks", async (c) => {
  const adminKey = getAdminApiKey(c.env);
  const header = c.req.header("x-capgent-admin-key") ?? "";
  if (adminKey && header !== adminKey) {
    return c.json({ error: "admin_key_required" }, 401);
  }
  const { clearBenchmarks } = await import("./benchmarks/store");
  await clearBenchmarks(c.env);
  return c.json({ ok: true, cleared: true });
});

app.post("/api/guestbook/sign", async (c) => {
  const guestbookLimit = getGuestbookSignRateLimitPerMinute(c.env);
  const clientKey = getClientKey(c);
  const ipRate = await checkRateLimit(c.env, `ratelimit:guestbook:ip:${clientKey}`, guestbookLimit, 60);
  if (!ipRate.allowed) {
    return c.json(
      { error: "rate_limited", endpoint: "/api/guestbook/sign", retry_after_seconds: ipRate.retryAfterSeconds },
      429,
      { "Retry-After": String(ipRate.retryAfterSeconds) }
    );
  }

  const auth = c.req.header("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!token) return c.json({ error: "missing_bearer_token" }, 401);

  let claims: AgentIdentityClaims;
  try {
    claims = (await verifyIdentityJwt(c.env, token)) as AgentIdentityClaims;
  } catch {
    return c.json({ error: "invalid_identity_token" }, 401);
  }

  const agentRate = await checkRateLimit(c.env, `ratelimit:guestbook:agent:${claims.agent_id}`, 10, 60);
  if (!agentRate.allowed) {
    return c.json(
      { error: "rate_limited", endpoint: "/api/guestbook/sign", retry_after_seconds: agentRate.retryAfterSeconds },
      429,
      { "Retry-After": String(agentRate.retryAfterSeconds) }
    );
  }

  const body = (await c.req.json().catch(() => null)) as { message?: string; solve_ms?: number } | null;
  const message = body?.message?.trim();
  if (!message) return c.json({ error: "missing_message" }, 400);
  const spamError = getSpamMessageError(message);
  if (spamError) return c.json({ error: spamError }, 400);

  const cooldownSeconds = getGuestbookCooldownSeconds(c.env);
  let cooldownKey = "";
  if (cooldownSeconds > 0) {
    const store = getStore(c.env);
    cooldownKey = `guestbook:cooldown:${claims.agent_id}`;
    const cooldown = (await store.getJson<{ last_signed_at_ms: number }>(cooldownKey)) ?? null;
    const nowMs = Date.now();
    if (cooldown && nowMs - cooldown.last_signed_at_ms < cooldownSeconds * 1000) {
      const retryAfterSeconds = Math.max(1, Math.ceil((cooldownSeconds * 1000 - (nowMs - cooldown.last_signed_at_ms)) / 1000));
      return c.json(
        { error: "guestbook_cooldown_active", retry_after_seconds: retryAfterSeconds },
        429,
        { "Retry-After": String(retryAfterSeconds) }
      );
    }
  }

  const now = new Date().toISOString();
  const entry: GuestbookEntry = {
    id: crypto.randomUUID(),
    agent_id: claims.agent_id,
    agent_name: claims.agent_name,
    framework: claims.framework,
    model: claims.model,
    owner_org: claims.owner_org,
    message,
    solve_ms: typeof body?.solve_ms === "number" && body.solve_ms >= 0 ? Math.round(body.solve_ms) : 0,
    created_at: now,
  };

  const saved = await addGuestbookEntry(c.env, entry);
  if (cooldownSeconds > 0 && cooldownKey) {
    await getStore(c.env).setJson(cooldownKey, { last_signed_at_ms: Date.now() }, cooldownSeconds);
  }
  return c.json({ ok: true, entry: saved });
});

app.get("/api/guestbook", async (c) => {
  const entries = await getGuestbookEntries(c.env);
  return c.json({ entries });
});

app.delete("/api/guestbook", async (c) => {
  const adminKey = getAdminApiKey(c.env);
  const header = c.req.header("x-capgent-admin-key") ?? "";
  if (adminKey && header !== adminKey) {
    return c.json({ error: "admin_key_required" }, 401);
  }
  await clearGuestbook(c.env);
  return c.json({ ok: true, cleared: true });
});

async function wellKnownCapgentJson(c: Context<{ Bindings: Env }>) {
  const base = (c.env.CAPAGENT_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "") || "http://localhost:8787";
  return c.json({
    issuer: base,
    challenge_endpoint: `${base}/api/challenge`,
    verify_endpoint: `${base}/api/verify/{challenge_id}`,
    protected_ping_endpoint: `${base}/api/protected/ping`,
    agents_register_endpoint: `${base}/api/agents/register`,
    guestbook_endpoint: `${base}/api/guestbook`,
    guestbook_sign_endpoint: `${base}/api/guestbook/sign`,
    benchmarks_endpoint: `${base}/api/benchmarks`,
    docs_url: `${base}/docs`,
    protocol_version: "0.1.0"
  });
}

app.get("/.well-known/capgent.json", (c) => wellKnownCapgentJson(c));

/** @deprecated Prefer `/.well-known/capgent.json`; kept for older integrations. */
app.get("/.well-known/capagent.json", (c) => wellKnownCapgentJson(c));

export default app;

