"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createKeyAction } from "./actions"
import { Copy, Check, WarningCircle } from "@phosphor-icons/react"

export function KeyCreationForm({ projects, preselectedProjectId }: { projects: { id: string, name: string }[], preselectedProjectId?: string }) {
  const router = useRouter()
  const [projectId, setProjectId] = useState(preselectedProjectId || (projects.length > 0 ? projects[0].id : ""))
  const [name, setName] = useState("")
  const [expiresIn, setExpiresIn] = useState("30")
  const [loading, setLoading] = useState(false)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleCreate() {
    if (!name.trim() || !projectId) return
    setLoading(true)
    setError(null)
    try {
      const days = expiresIn === "never" ? null : parseInt(expiresIn)
      const res = await createKeyAction(projectId, name, days)
      if (res.status === "success" && res.apiKey) {
        setApiKey(res.apiKey)
      } else {
        setError(res.message || "Failed to create API key")
      }
    } catch (e) {
      setError("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (apiKey) {
    return (
      <div className="p-4 border border-emerald-500/30 bg-emerald-500/10 rounded-xl space-y-4">
        <div className="flex items-center gap-2 text-emerald-500 font-medium">
          <Check className="h-4 w-4" />
          API Key created successfully!
        </div>
        <p className="text-sm text-muted-foreground">
          Copy this key now. You won't be able to see it again once you leave this page.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 p-2 bg-muted/40 rounded-md border border-border/40 font-mono text-sm break-all">
            {apiKey}
          </code>
          <Button variant="outline" size="icon" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <Button className="w-full" onClick={() => router.refresh()}>
          Done
        </Button>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center rounded-xl border border-dashed border-border/60 bg-muted/20">
        You need to create a project first before generating an API key.
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 border border-border/60 rounded-xl bg-card">
      <div className="space-y-2">
        <Label htmlFor="project-select">Project</Label>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger id="project-select">
            <SelectValue placeholder="Select a project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="key-name">API Key Name</Label>
        <Input
          id="key-name"
          placeholder="e.g. Production Key"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="key-expiry">Expiration</Label>
        <Select value={expiresIn} onValueChange={setExpiresIn}>
          <SelectTrigger id="key-expiry">
            <SelectValue placeholder="Select expiration" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 days</SelectItem>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="60">60 days</SelectItem>
            <SelectItem value="90">90 days</SelectItem>
            <SelectItem value="never">Never</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <WarningCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      <Button 
        className="w-full" 
        disabled={!name.trim() || !projectId || loading} 
        onClick={handleCreate}
      >
        {loading ? "Creating..." : "Create API Key"}
      </Button>
    </div>
  )
}
