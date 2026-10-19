-- Initial schema for NeonDB used by Capgent.
-- Generated/managed via drizzle-kit, committed to repo for repeatable deploys.

CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "emailVerified" boolean NOT NULL DEFAULT false,
  "image" text,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unique" ON "user" ("email");

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "password" text,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");
CREATE INDEX IF NOT EXISTS "account_provider_idx" ON "account" ("providerId");

CREATE TABLE IF NOT EXISTS "project" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "userId" text REFERENCES "user" ("id") ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS "project_userId_idx" ON "project" ("userId");

CREATE TABLE IF NOT EXISTS "api_key" (
  "id" text PRIMARY KEY,
  "projectId" text NOT NULL REFERENCES "project" ("id") ON DELETE CASCADE,
  "key" text NOT NULL,
  "name" text,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  "expiresAt" timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS "api_key_key_unique" ON "api_key" ("key");
CREATE INDEX IF NOT EXISTS "api_key_projectId_idx" ON "api_key" ("projectId");

-- Note: mixed-case quoted identifier, matches API queries.
CREATE TABLE IF NOT EXISTS "AgentIdentity" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "framework" text,
  "model" text,
  "ownerOrg" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "capabilityScore" integer,
  "safetyScore" integer,
  "lastVerified" timestamptz,
  "revokedAt" timestamptz,
  "secretHash" text NOT NULL
);

CREATE INDEX IF NOT EXISTS "AgentIdentity_revokedAt_idx" ON "AgentIdentity" ("revokedAt");

-- Email verification tokens (used for optional emailVerified gating)
CREATE TABLE IF NOT EXISTS "email_verification" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "tokenHash" text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "usedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "email_verification_userId_idx" ON "email_verification" ("userId");
CREATE INDEX IF NOT EXISTS "email_verification_expiresAt_idx" ON "email_verification" ("expiresAt");

