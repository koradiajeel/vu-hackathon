import { jwtVerify } from "jose";
import type { Env } from "../config";

export type WebSessionClaims = {
  userId: string;
};

function getWebSessionKey(env: Env) {
  const raw = (env.SESSION_SECRET ?? "").trim();
  if (!raw) {
    throw new Error("SESSION_SECRET is required for /api/me/* endpoints");
  }
  return new TextEncoder().encode(raw);
}

function parseCookieHeader(cookieHeader: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") ?? "");
  }
  return out;
}

export async function verifyWebSessionFromCookie(env: Env, cookieHeader: string | undefined | null) {
  const raw = (cookieHeader ?? "").trim();
  if (!raw) return null;
  const cookies = parseCookieHeader(raw);
  const token = (cookies["session"] ?? "").trim();
  if (!token) return null;

  const { payload } = await jwtVerify(token, getWebSessionKey(env), {
    algorithms: ["HS256"],
  });

  const userId = typeof payload.userId === "string" ? payload.userId : "";
  if (!userId) return null;
  return { userId } satisfies WebSessionClaims;
}

