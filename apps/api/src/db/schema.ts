// Drizzle schema is used for migrations only right now.
// Runtime DB access in the API currently uses Neon SQL tagged templates.

import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  password: text("password"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull(),
});

export const project = pgTable("project", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  userId: text("userId"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull(),
});

export const apiKey = pgTable("api_key", {
  id: text("id").primaryKey(),
  projectId: text("projectId").notNull(),
  key: text("key").notNull(),
  name: text("name"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }),
});

export const agentIdentity = pgTable("AgentIdentity", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  framework: text("framework"),
  model: text("model"),
  ownerOrg: text("ownerOrg"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  capabilityScore: integer("capabilityScore"),
  safetyScore: integer("safetyScore"),
  lastVerified: timestamp("lastVerified", { withTimezone: true }),
  revokedAt: timestamp("revokedAt", { withTimezone: true }),
  secretHash: text("secretHash").notNull(),
});

export const emailVerification = pgTable("email_verification", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  tokenHash: text("tokenHash").notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  usedAt: timestamp("usedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

export const benchmarkReport = pgTable("benchmark_report", {
  id: text("id").primaryKey(),
  model_id: text("model_id").notNull().unique(), // Unique by model_id so we can upsert
  framework: text("framework").notNull(),
  agent_name: text("agent_name").notNull(),
  agent_version: text("agent_version").notNull(),
  project_id: text("project_id"),
  runs: integer("runs").notNull().default(0),
  successes: integer("successes").notNull().default(0),
  success_runs: integer("success_runs").notNull().default(0),
  avg_ms: integer("avg_ms").notNull().default(0), // Storing as integers (ms) for robustness
  p95_ms: integer("p95_ms").notNull().default(0),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

