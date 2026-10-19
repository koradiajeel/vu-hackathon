import { cache } from "react"
import { cookies } from "next/headers";

export type Project = {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
};

export type ApiKey = {
  id: string;
  projectId: string;
  label: string | null;
  createdAt: Date;
  expiresAt: Date | null;
};

function getApiBase() {
  return (
    process.env.CAPAGENT_API_BASE_URL ??
    process.env.NEXT_PUBLIC_CAPAGENT_API_BASE_URL ??
    "http://127.0.0.1:8787"
  );
}

async function getSessionCookie() {
  return (await cookies()).get("session")?.value ?? "";
}

/**
 * Fetch all projects for the current user.
 * Wrapped with React.cache() so multiple RSC renders in the same request
 * (root layout, page) share one API call.
 */
export const getUserProjects = cache(async (): Promise<Project[]> => {
  try {
    const session = await getSessionCookie();
    const res = await fetch(`${getApiBase()}/api/me/projects`, {
      cache: "no-store",
      headers: session ? { cookie: `session=${session}` } : {},
    });
    if (!res.ok) return [];
    const json = (await res.json().catch(() => null)) as { projects?: any[] } | null;
    return (json?.projects ?? []).map((p) => ({
      id: p.project_id,
      name: p.name,
      userId: p.owner_id ?? "",
      createdAt: new Date(p.created_at),
    })) as Project[];
  } catch {
    return [];
  }
});

export async function getProjectById(projectId: string): Promise<Project | null> {
  const projects = await getUserProjects();
  return projects.find((p) => p.id === projectId) ?? null;
}

/**
 * Fetch API keys for a single project.
 * Wrapped with React.cache() so repeated calls for the same projectId
 * within one request (e.g. dashboard + layout) are deduped.
 */
export const getProjectApiKeys = cache(async (projectId: string): Promise<ApiKey[]> => {
  try {
    const session = await getSessionCookie();
    const res = await fetch(
      `${getApiBase()}/api/me/projects/${encodeURIComponent(projectId)}/keys`,
      {
        cache: "no-store",
        headers: session ? { cookie: `session=${session}` } : {},
      }
    );
    if (!res.ok) return [];
    const json = (await res.json().catch(() => null)) as { api_keys?: any[] } | null;
    return (json?.api_keys ?? []).map((k) => ({
      id: k.key_id,
      projectId,
      label: k.label ?? null,
      createdAt: new Date(k.created_at),
      expiresAt: k.expires_at ? new Date(k.expires_at) : null,
    })) as ApiKey[];
  } catch {
    return [];
  }
});
