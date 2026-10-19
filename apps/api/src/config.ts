export type Env = {
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  CAPAGENT_JWT_SECRET: string;
  SESSION_SECRET?: string;
  CAPAGENT_CHALLENGE_TTL_SECONDS?: string;
  CAPAGENT_PROOF_TTL_SECONDS?: string;
  CAPAGENT_IDENTITY_TTL_SECONDS?: string;
  CAPAGENT_PUBLIC_BASE_URL?: string;
  CAPAGENT_CORS_ORIGINS?: string;
  CAPAGENT_FORCE_INMEMORY?: string;
  CAPAGENT_ADMIN_API_KEY?: string;
  CAPAGENT_ALLOW_PUBLIC_REGISTRATION?: string;
  CAPAGENT_RATE_LIMIT_CHALLENGE_PER_MINUTE?: string;
  CAPAGENT_RATE_LIMIT_GUESTBOOK_SIGN_PER_MINUTE?: string;
  CAPAGENT_RATE_LIMIT_BENCHMARK_REPORT_PER_MINUTE?: string;
  CAPAGENT_GUESTBOOK_COOLDOWN_SECONDS?: string;
  DATABASE_URL: string;
};

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw ?? "");
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

export function getChallengeTtlSeconds(env: Env) {
  const raw = env.CAPAGENT_CHALLENGE_TTL_SECONDS ?? "30";
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 30;
  return Math.floor(n);
}

export function getProofTtlSeconds(env: Env) {
  const raw = env.CAPAGENT_PROOF_TTL_SECONDS ?? "300";
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 300;
  return Math.floor(n);
}

export function getIdentityTtlSeconds(env: Env) {
  const raw = env.CAPAGENT_IDENTITY_TTL_SECONDS ?? "86400";
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 86400;
  return Math.floor(n);
}

export function getCorsOrigins(env: Env): string[] {
  const raw = (env.CAPAGENT_CORS_ORIGINS ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function forceInMemory(env: Env) {
  return (env.CAPAGENT_FORCE_INMEMORY ?? "").trim() === "1";
}

export function allowPublicRegistration(env: Env) {
  const raw = (env.CAPAGENT_ALLOW_PUBLIC_REGISTRATION ?? "").trim();
  // Default to true for local/dev unless explicitly disabled.
  return raw === "" || raw === "1" || raw.toLowerCase() === "true";
}

export function getAdminApiKey(env: Env): string | null {
  const raw = (env.CAPAGENT_ADMIN_API_KEY ?? "").trim();
  return raw || null;
}

export function getChallengeRateLimitPerMinute(env: Env): number {
  return parsePositiveInt(env.CAPAGENT_RATE_LIMIT_CHALLENGE_PER_MINUTE, 120);
}

export function getGuestbookSignRateLimitPerMinute(env: Env): number {
  return parsePositiveInt(env.CAPAGENT_RATE_LIMIT_GUESTBOOK_SIGN_PER_MINUTE, 30);
}

export function getBenchmarkReportRateLimitPerMinute(env: Env): number {
  return parsePositiveInt(env.CAPAGENT_RATE_LIMIT_BENCHMARK_REPORT_PER_MINUTE, 60);
}

export function getGuestbookCooldownSeconds(env: Env): number {
  return parsePositiveInt(env.CAPAGENT_GUESTBOOK_COOLDOWN_SECONDS, 20);
}


