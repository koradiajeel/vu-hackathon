import nodemailer from "nodemailer"
import crypto from "crypto"
import { sql } from "./neon"

const EMAIL_VERIFICATION_TTL_SECONDS = 60 * 30 // 30 minutes

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex")
}

function getEmailVerificationSiteUrl() {
  // Prefer an explicit site URL, but keep a safe fallback for prod.
  return process.env.NEXT_PUBLIC_WEB_BASE_URL ?? "https://capgent.vercel.app"
}

function getMailEnv() {
  const host = process.env.SMTP_HOST
  const portRaw = process.env.SMTP_PORT
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM

  if (!host || !portRaw || !from) {
    return null
  }

  const port = Number(portRaw)
  if (!Number.isFinite(port) || port <= 0) return null

  const normalizedFrom =
    from && from.includes("@") ? from : user

  return { host, port, user, pass, from: normalizedFrom }
}

async function sendVerificationEmail({ to, token, email }: { to: string; token: string; email: string }) {
  const mailEnv = getMailEnv()

  // Dev fallback: if SMTP is not configured, we still return the token so you can wire it manually.
  // (We do not throw to keep local signup/testing unblocked.)
  if (!mailEnv) {
    console.log("[Auth] Email verification not sent (SMTP env missing). Token:", token, "email:", email)
    return
  }

  const { host, port, user, pass, from } = mailEnv

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  })

  const siteUrl = getEmailVerificationSiteUrl()
  const verifyUrl = `${siteUrl}/verify-email?token=${encodeURIComponent(token)}`

  await transporter.sendMail({
    from,
    to,
    subject: "Verify your email for AgentWarden",
    text: `Hi!\n\nPlease confirm your mail by clicking the link below:\n\n${verifyUrl}`,
    html: `<p>Hi!</p><p><a href="${verifyUrl}">Confirm you mail</a></p>`,
  })
}

export async function createEmailVerificationToken({
  userId,
  email,
}: {
  userId: string
  email: string
}): Promise<{ token: string }> {
  const token = crypto.randomBytes(32).toString("base64url")
  const tokenHash = sha256Hex(token)

  const now = new Date()
  const expiresAt = new Date(now.getTime() + EMAIL_VERIFICATION_TTL_SECONDS * 1000)

  const tokenId = crypto.randomUUID()

  await sql`
    INSERT INTO "email_verification"
      ("id", "userId", "tokenHash", "expiresAt", "usedAt", "createdAt")
    VALUES
      (${tokenId}, ${userId}, ${tokenHash}, ${expiresAt}, null, ${now})
  `

  await sendVerificationEmail({ to: email, token, email })

  return { token }
}

export async function verifyEmailVerificationToken(
  token: string
): Promise<{ ok: boolean; userId?: string }> {
  const tokenHash = sha256Hex(token)
  const now = new Date()

  const rows = await sql`
    SELECT ev."id" AS "tokenId", ev."userId" AS "userId"
    FROM "email_verification" ev
    WHERE ev."tokenHash" = ${tokenHash}
      AND ev."expiresAt" > ${now}
      AND ev."usedAt" IS NULL
    LIMIT 1
  `

  const row = rows[0] as { tokenId: string; userId: string } | undefined
  if (!row) return { ok: false }

  await sql`
    UPDATE "user"
    SET "emailVerified" = true,
        "updatedAt" = ${now}
    WHERE "id" = ${row.userId}
  `

  await sql`
    UPDATE "email_verification"
    SET "usedAt" = ${now}
    WHERE "id" = ${row.tokenId}
  `

  return { ok: true, userId: row.userId }
}

