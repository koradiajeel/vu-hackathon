"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createProjectAction } from "./actions"

type CreateProjectState = {
  status: "idle" | "success" | "error"
  projectId?: string
  message?: string
}

const initialState: CreateProjectState = {
  status: "idle",
}

export function ProjectsForm() {
  const [state, formAction] = useActionState(createProjectAction, initialState)
  const router = useRouter()

  useEffect(() => {
    if (state.status === "success") {
      router.refresh()
    }
  }, [state, router])

  return (
    <div className="space-y-4">
      <form action={formAction}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project name</Label>
            <Input id="name" name="name" placeholder="My agent backend" required />
          </div>
          <Button type="submit">Create project</Button>
        </div>
      </form>

      {state.status === "success" && (
        <p className="text-xs text-emerald-600">Project created successfully.</p>
      )}

      {state.status === "error" && state.message && (
        <p className="text-xs text-destructive">{state.message}</p>
      )}
    </div>
  )
}

