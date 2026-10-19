import { cache } from "react"
import { cookies } from "next/headers";
import { sql } from "./neon";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

if (!process.env.SESSION_SECRET) {
  throw new Error("❌ [Auth] SESSION_SECRET is not set. Please add it to your .env file.");
}

const JWT_SECRET = new TextEncoder().encode(process.env.SESSION_SECRET);

/**
 * Manual Authentication & Session System
 * Powered by Neon HTTP (Direct SQL) and JWT Cookies.
 */

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);

  const cookieStore = await cookies();
  cookieStore.set("session", session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}

export async function verifySession() {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;

  if (!session) return null;

  try {
    const { payload } = await jwtVerify(session, JWT_SECRET, {
      algorithms: ["HS256"],
    });
    return payload as { userId: string };
  } catch {
    return null;
  }
}

/**
 * Get the currently logged-in user.
 * Wrapped with React.cache() so multiple calls within the same request
 * (root layout, dashboard layout, page) only hit the database once.
 */
export const getSession = cache(async () => {
  const session = await verifySession();
  if (!session) return null;

  try {
    const users = await sql`SELECT id, name, email, image FROM "user" WHERE id = ${session.userId} LIMIT 1`;
    return (users[0] as { id: string; name: string | null; email: string; image: string | null }) ?? null;
  } catch (error) {
    console.error("❌ [Auth] Failed to fetch session user:", error);
    return null;
  }
});

const BCRYPT_SALT_ROUNDS = 12;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function assertValidEmail(email: string) {
  const normalized = normalizeEmail(email)
  if (!EMAIL_RE.test(normalized)) {
    throw new Error("Please enter a valid email address.")
  }
  return normalized
}

function assertValidPassword(password: string) {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.")
  }
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signIn(email: string, password: string) {
  try {
    const normalizedEmail = normalizeEmail(email)

    const users = await sql`
      SELECT u.id, u."emailVerified", a.password 
      FROM "user" u
      JOIN "account" a ON u.id = a."userId"
      WHERE u.email = ${normalizedEmail} AND a."providerId" = 'credential'
      LIMIT 1
    `;

    const user = users[0] as { id: string; emailVerified: boolean; password: string } | undefined;
    if (!user) throw new Error("Invalid email or password");

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      throw new Error("Invalid email or password");
    }

    if (!user.emailVerified) {
      throw new Error("Please verify your email before signing in.")
    }

    await createSession(user.id);
    return { success: true };
  } catch (error) {
    console.error("❌ [Auth] Sign-in failed:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function signUp(name: string, email: string, password: string) {
  try {
    const normalizedEmail = assertValidEmail(email)
    assertValidPassword(password)

    const userId = crypto.randomUUID();
    const now = new Date();

    await sql`
      INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
      VALUES (${userId}, ${name}, ${normalizedEmail}, true, ${now}, ${now})
    `;

    const accountId = crypto.randomUUID();
    await sql`
      INSERT INTO "account" (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
      VALUES (${accountId}, ${userId}, ${userId}, 'credential', ${await hashPassword(password)}, ${now}, ${now})
    `;

    // Local mode: no mail server, so accounts are verified immediately and signed in.
    await createSession(userId);
    return { success: true };
  } catch (error) {
    console.error("❌ [Auth] Sign-up failed:", error);
    // Avoid leaking whether an account exists.
    const message = (error as Error).message ?? ""
    if (message.toLowerCase().includes("unique") || message.toLowerCase().includes("duplicate")) {
      return { success: false, error: "Unable to create account. If this email already exists, verify it first." }
    }
    return { success: false, error: message || "Failed to create account" };
  }
}
