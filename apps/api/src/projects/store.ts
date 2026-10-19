import type { Env } from "../config";
import { createDb } from "../storage/db";

export type Project = {
  project_id: string;
  name: string;
  created_at: string;
  owner_id?: string | null;
};

export type ApiKeyRecord = {
  key_id: string;
  project_id: string;
  key_hash: string;
  label?: string | null;
  created_at: string;
  expires_at?: string | null;
};

export async function saveProject(env: Env, project: Project): Promise<void> {
  const sql = createDb(env);
  await sql`
    INSERT INTO project (id, name, "userId", "createdAt", "updatedAt")
    VALUES (${project.project_id}, ${project.name}, ${project.owner_id}, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      "updatedAt" = EXCLUDED."updatedAt"
  `;
}

export async function getProjectById(env: Env, projectId: string): Promise<Project | null> {
  const sql = createDb(env);
  const rows = await sql`
    SELECT id as project_id, name, "userId" as owner_id, "createdAt" as created_at
    FROM project
    WHERE id = ${projectId}
    LIMIT 1
  `;
  
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    ...row,
    created_at: row.created_at.toISOString(),
  } as Project;
}

export async function listProjectsForOwner(env: Env, ownerId: string): Promise<Project[]> {
  const sql = createDb(env);
  const rows = await sql`
    SELECT id as project_id, name, "userId" as owner_id, "createdAt" as created_at
    FROM project
    WHERE "userId" = ${ownerId}
    ORDER BY "createdAt" DESC
  `;

  return rows.map((row: any) => ({
    ...row,
    created_at: row.created_at.toISOString(),
  })) as Project[];
}

export async function saveApiKey(env: Env, apiKey: ApiKeyRecord): Promise<void> {
  const sql = createDb(env);
  await sql`
    INSERT INTO api_key (id, "projectId", key, name, "createdAt", "updatedAt", "expiresAt")
    VALUES (${apiKey.key_id}, ${apiKey.project_id}, ${apiKey.key_hash}, ${apiKey.label}, NOW(), NOW(), ${apiKey.expires_at ? new Date(apiKey.expires_at) : null})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      "updatedAt" = EXCLUDED."updatedAt",
      "expiresAt" = EXCLUDED."expiresAt"
  `;
}

export async function deleteProject(env: Env, projectId: string): Promise<void> {
  const sql = createDb(env);
  // Ensure API keys are removed first (no reliance on FK cascade).
  await sql`
    DELETE FROM api_key
    WHERE "projectId" = ${projectId}
  `;
  await sql`
    DELETE FROM project
    WHERE id = ${projectId}
  `;
}

export async function deleteApiKey(env: Env, keyId: string): Promise<void> {
  const sql = createDb(env);
  await sql`
    DELETE FROM api_key
    WHERE id = ${keyId}
  `;
}

export async function getApiKeyById(
  env: Env,
  keyId: string
): Promise<{ key_id: string; project_id: string } | null> {
  const sql = createDb(env);
  const rows = await sql`
    SELECT id as key_id, "projectId" as project_id
    FROM api_key
    WHERE id = ${keyId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return rows[0] as any;
}

export async function listApiKeysForProject(env: Env, projectId: string): Promise<ApiKeyRecord[]> {
  const sql = createDb(env);
  const rows = await sql`
    SELECT id as key_id, "projectId" as project_id, key as key_hash, name as label, 
           "createdAt" as created_at, "expiresAt" as expires_at
    FROM api_key
    WHERE "projectId" = ${projectId}
  `;
  
  return rows.map(row => ({
    ...row,
    created_at: row.created_at.toISOString(),
    expires_at: row.expires_at?.toISOString() || null
  })) as ApiKeyRecord[];
}

export async function getProjectForApiKeyHash(
  env: Env,
  keyHash: string
): Promise<{ project: Project; apiKey: ApiKeyRecord } | null> {
  const sql = createDb(env);
  const rows = await sql`
    SELECT 
      p.id as p_id, p.name as p_name, p."userId" as p_owner_id, p."createdAt" as p_created_at,
      k.id as k_id, k."projectId" as k_project_id, k.key as k_key_hash, k.name as k_label, 
      k."createdAt" as k_created_at, k."expiresAt" as k_expires_at
    FROM api_key k
    JOIN project p ON k."projectId" = p.id
    WHERE k.key = ${keyHash} AND (k."expiresAt" IS NULL OR k."expiresAt" > NOW())
    LIMIT 1
  `;

  if (rows.length === 0) return null;
  const row = rows[0];

  const project: Project = {
    project_id: row.p_id,
    name: row.p_name,
    owner_id: row.p_owner_id,
    created_at: row.p_created_at.toISOString()
  };

  const apiKey: ApiKeyRecord = {
    key_id: row.k_id,
    project_id: row.k_project_id,
    key_hash: row.k_key_hash,
    label: row.k_label,
    created_at: row.k_created_at.toISOString(),
    expires_at: row.k_expires_at?.toISOString() || null
  };

  return { project, apiKey };
}


