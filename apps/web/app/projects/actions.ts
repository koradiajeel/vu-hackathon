"use server"

import { cookies } from "next/headers"
import { getSession } from "@/lib/auth"

type CreateProjectState = {
  status: "idle" | "success" | "error"
  apiKey?: string
  projectId?: string
  message?: string
}

export async function createProjectAction(
  _prevState: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const name = String(formData.get("name") ?? "").trim()
  if (!name) {
    return { status: "error", message: "Project name is required." }
  }

  const user = await getSession()

  if (!user?.email || !user.id) {
    return { status: "error", message: "You must be signed in." }
  }

  const apiBase = process.env.NEXT_PUBLIC_CAPAGENT_API_BASE_URL ?? "http://127.0.0.1:8787"
  const sessionCookie = (await cookies()).get("session")?.value ?? ""

  const res = await fetch(`${apiBase}/api/me/projects`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(sessionCookie ? { cookie: `session=${sessionCookie}` } : {}),
    },
    body: JSON.stringify({
      name,
    }),
  })

  if (!res.ok) {
    return { status: "error", message: "Failed to create project. Check server logs." }
  }

  const json = (await res.json().catch(() => null)) as
    | { project?: { project_id: string } }
    | null

  return {
    status: "success",
    projectId: json?.project?.project_id,
    message: "Project created successfully!",
  }
}

export async function createKeyAction(
  projectId: string,
  name: string,
  expiresInDays: number | null
): Promise<{ status: "success" | "error"; apiKey?: string; message?: string }> {
  const user = await getSession()
  if (!user?.id) return { status: "error", message: "Unauthorized" }
  const apiBase = process.env.NEXT_PUBLIC_CAPAGENT_API_BASE_URL ?? "http://127.0.0.1:8787"
  const sessionCookie = (await cookies()).get("session")?.value ?? ""

  let expiresAt: string | null = null
  if (expiresInDays) {
    const d = new Date()
    d.setDate(d.getDate() + expiresInDays)
    expiresAt = d.toISOString()
  }

  const res = await fetch(`${apiBase}/api/me/projects/${encodeURIComponent(projectId)}/keys`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(sessionCookie ? { cookie: `session=${sessionCookie}` } : {}),
    },
    body: JSON.stringify({
      label: name,
      expires_at: expiresAt,
    }),
  })

  if (!res.ok) return { status: "error", message: "Failed to create API key" }

  const json = await res.json()
  return {
    status: "success",
    apiKey: json.api_key,
    message: "API key created successfully! Copy it now, as you won't be able to see it again.",
  }
}

export async function deleteKeyAction(
  projectId: string,
  keyId: string
): Promise<{ success: boolean; message?: string }> {
  const user = await getSession()
  if (!user?.id) return { success: false, message: "Unauthorized" }
  const apiBase = process.env.NEXT_PUBLIC_CAPAGENT_API_BASE_URL ?? "http://127.0.0.1:8787"
  const sessionCookie = (await cookies()).get("session")?.value ?? ""

  const res = await fetch(
    `${apiBase}/api/me/projects/${encodeURIComponent(projectId)}/keys/${encodeURIComponent(keyId)}`,
    {
    method: "DELETE",
    headers: sessionCookie ? { cookie: `session=${sessionCookie}` } : {},
    }
  )

  if (!res.ok) return { success: false, message: "Failed to delete API key" }

  return { success: true }
}

export async function deleteProjectAction(
  projectId: string,
): Promise<{ success: boolean; message?: string }> {
  const user = await getSession()
  if (!user?.id) return { success: false, message: "Unauthorized" }
  const apiBase = process.env.NEXT_PUBLIC_CAPAGENT_API_BASE_URL ?? "http://127.0.0.1:8787"
  const sessionCookie = (await cookies()).get("session")?.value ?? ""

  const res = await fetch(`${apiBase}/api/me/projects/${encodeURIComponent(projectId)}`, {
    method: "DELETE",
    headers: sessionCookie ? { cookie: `session=${sessionCookie}` } : {},
  })

  if (!res.ok) return { success: false, message: "Failed to delete project" }
  return { success: true }
}
