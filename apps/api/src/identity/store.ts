import type { Env } from "../config";
import { createDb } from "../storage/db";

export type AgentRecord = {
  agent_id: string;
  agent_name: string;
  framework?: string;
  model?: string;
  owner_org?: string;
  created_at: string;
  capability_score?: number | null;
  safety_score?: number | null;
  last_verified?: string | null;
  revoked_at?: string | null;
  secret_hash: string;
};

export async function getAgentById(env: Env, agentId: string): Promise<AgentRecord | null> {
  const sql = createDb(env);
  const rows = await sql`
    SELECT id as agent_id, name as agent_name, framework, model, "ownerOrg" as owner_org, 
           "createdAt" as created_at, "capabilityScore" as capability_score, 
           "safetyScore" as safety_score, "lastVerified" as last_verified, 
           "revokedAt" as revoked_at, "secretHash" as secret_hash
    FROM "AgentIdentity"
    WHERE id = ${agentId}
    LIMIT 1
  `;
  
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    ...row,
    created_at: row.created_at.toISOString(),
    last_verified: row.last_verified?.toISOString() || null,
    revoked_at: row.revoked_at?.toISOString() || null
  } as AgentRecord;
}

export async function saveAgent(env: Env, agent: AgentRecord): Promise<void> {
  const sql = createDb(env);
  await sql`
    INSERT INTO "AgentIdentity" (
      id, name, framework, model, "ownerOrg", 
      "capabilityScore", "safetyScore", "lastVerified", "revokedAt", "secretHash"
    )
    VALUES (
      ${agent.agent_id}, ${agent.agent_name}, ${agent.framework}, ${agent.model}, ${agent.owner_org}, 
      ${agent.capability_score}, ${agent.safety_score}, ${agent.last_verified ? new Date(agent.last_verified) : null}, 
      ${agent.revoked_at ? new Date(agent.revoked_at) : null}, ${agent.secret_hash}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      framework = EXCLUDED.framework,
      model = EXCLUDED.model,
      "ownerOrg" = EXCLUDED."ownerOrg",
      "capabilityScore" = EXCLUDED."capabilityScore",
      "safetyScore" = EXCLUDED."safetyScore",
      "lastVerified" = EXCLUDED."lastVerified",
      "revokedAt" = EXCLUDED."revokedAt",
      "secretHash" = EXCLUDED."secretHash"
  `;
}

export async function revokeAgent(env: Env, agentId: string): Promise<AgentRecord | null> {
  const agent = (await getAgentById(env, agentId)) ?? null;
  if (!agent) return null;
  const now = new Date().toISOString();
  const updated: AgentRecord = { ...agent, revoked_at: now };
  await saveAgent(env, updated);
  return updated;
}


