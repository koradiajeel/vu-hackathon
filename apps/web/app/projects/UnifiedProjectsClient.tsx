"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Project, ApiKey } from "@/lib/projects"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { CaretDown, Check, MagnifyingGlass, Trash } from "@phosphor-icons/react"
import { ApiKeyDetailsDialog } from "./ApiKeyDetailsDialog"
import { deleteKeyAction, deleteProjectAction } from "./actions"

type ProjectWithKeyCount = Project & { keyCount: number }
type ApiKeyWithProject = ApiKey & { project: Project }

export function UnifiedProjectsClient({
  projects,
  allKeys,
  allProjects,
  initialProjectId,
  initialTab,
}: {
  projects: ProjectWithKeyCount[]
  allKeys: ApiKeyWithProject[]
  allProjects: Project[]
  initialProjectId?: string
  initialTab: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState(initialTab)

  // Projects tab state
  const [projectQuery, setProjectQuery] = useState("")
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)
  const [projectError, setProjectError] = useState<string | null>(null)

  // Keys tab state
  const [filterProject, setFilterProject] = useState<string>(initialProjectId ?? "all")
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null)

  useEffect(() => {
    setFilterProject(initialProjectId ?? "all")
  }, [initialProjectId])

  const filteredProjects = useMemo(() => {
    const q = projectQuery.trim().toLowerCase()
    if (!q) return projects
    return projects.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
  }, [projects, projectQuery])

  const filteredKeys = useMemo(() => {
    if (filterProject === "all") return allKeys
    return allKeys.filter((k) => k.project.id === filterProject)
  }, [allKeys, filterProject])

  function handleDeleteProject(projectId: string) {
    setProjectError(null)
    setDeletingProjectId(projectId)
    startTransition(async () => {
      const result = await deleteProjectAction(projectId)
      setDeletingProjectId(null)
      if (!result.success) {
        setProjectError(result.message ?? "Failed to delete project.")
      } else {
        router.refresh()
      }
    })
  }

  function handleDeleteKey(projectId: string, keyId: string) {
    setDeletingKeyId(keyId)
    startTransition(async () => {
      await deleteKeyAction(projectId, keyId)
      setDeletingKeyId(null)
      router.refresh()
    })
  }

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="bg-muted/40 border border-border/40">
        <TabsTrigger value="projects">Projects</TabsTrigger>
        <TabsTrigger value="keys">API Keys</TabsTrigger>
      </TabsList>

      {/* ─── Projects Tab ─── */}
      <TabsContent value="projects" className="mt-4 space-y-4">
        <div className="relative w-full max-w-md">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={projectQuery}
            onChange={(e) => setProjectQuery(e.target.value)}
            placeholder="Search projects..."
            className="pl-9 h-10 bg-background border-border/40 rounded-lg text-sm"
          />
        </div>

        {projectError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {projectError}
          </div>
        )}

        <Card className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <div className="grid grid-cols-[2fr_1fr_1fr_auto] items-center gap-4 px-4 py-3 border-b border-border/60 text-[13px] font-medium text-muted-foreground bg-muted/40">
            <div>Project</div>
            <div>Keys</div>
            <div>Created</div>
            <div />
          </div>
          <div className="divide-y divide-border/40">
            {filteredProjects.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {projects.length === 0 ? "No projects yet. Create your first project." : "No projects match your search."}
              </div>
            ) : (
              filteredProjects.map((p) => (
                <div
                  key={p.id}
                  className="grid grid-cols-[2fr_1fr_1fr_auto] items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-[14px] text-foreground">
                      <button
                        type="button"
                        onClick={() => { setFilterProject(p.id); setTab("keys") }}
                        className="hover:underline text-left"
                      >
                        {p.name}
                      </button>
                    </div>
                    <div className="text-[12px] text-muted-foreground mt-0.5 font-mono truncate">{p.id}</div>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => { setFilterProject(p.id); setTab("keys") }}
                      className="text-[14px] font-medium hover:underline"
                    >
                      {p.keyCount} {p.keyCount === 1 ? "key" : "keys"}
                    </button>
                  </div>
                  <div className="text-[14px] text-muted-foreground">
                    {p.createdAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                  <div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          disabled={deletingProjectId === p.id && isPending}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete &ldquo;{p.name}&rdquo;?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the project and all of its API keys. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDeleteProject(p.id)}
                          >
                            Delete project
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </TabsContent>

      {/* ─── API Keys Tab ─── */}
      <TabsContent value="keys" className="mt-4 space-y-4">
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs font-semibold">Filter by</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 bg-muted border border-border/40 h-8 text-xs hover:bg-muted/80 rounded-lg shadow-sm"
                >
                  {filterProject === "all" ? "All projects" : allProjects.find((p) => p.id === filterProject)?.name}
                  <CaretDown className="h-3 w-3 text-muted-foreground ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuItem onClick={() => setFilterProject("all")}>
                  <div className="flex items-center justify-between w-full">
                    All projects
                    {filterProject === "all" && <Check className="h-4 w-4 ml-2 text-primary" />}
                  </div>
                </DropdownMenuItem>
                {allProjects.map((p) => (
                  <DropdownMenuItem key={p.id} onClick={() => setFilterProject(p.id)}>
                    <div className="flex items-center justify-between w-full">
                      {p.name}
                      {filterProject === p.id && <Check className="h-4 w-4 ml-2 text-primary" />}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Card className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <div className="grid grid-cols-[2.5fr_2fr_1.5fr_auto] items-center gap-4 p-4 border-b border-border/60 text-[13px] font-medium text-muted-foreground bg-muted/40">
            <div>Key</div>
            <div>Project</div>
            <div>Created</div>
            <div className="w-8" />
          </div>

          <div className="divide-y divide-border/40">
            {filteredKeys.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No API keys found.</div>
            ) : (
              filteredKeys.map((k) => (
                <ApiKeyDetailsDialog key={k.id} apiKey={{ ...k, project: { id: k.project.id, name: k.project.name } }}>
                  <div
                    role="button"
                    aria-label="View API key details"
                    className="grid grid-cols-[2.5fr_2fr_1.5fr_auto] items-center gap-4 p-4 hover:bg-muted/30 transition-colors cursor-pointer group text-left"
                  >
                    <div>
                      <div className="font-mono text-[14px] text-foreground group-hover:underline">...{k.id.slice(-4)}</div>
                      <div className="text-[12px] text-muted-foreground mt-0.5">{k.label || "Untitled key"}</div>
                    </div>
                    <div>
                      <div className="font-medium text-[14px] text-foreground">{k.project.name}</div>
                    </div>
                    <div className="text-[13px] text-muted-foreground">
                      {new Date(k.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            disabled={deletingKeyId === k.id && isPending}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete API key?</AlertDialogTitle>
                            <AlertDialogDescription>
                              The key <span className="font-mono">...{k.id.slice(-4)}</span>
                              {k.label ? ` (${k.label})` : ""} will be permanently revoked.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDeleteKey(k.project.id, k.id)}
                            >
                              Delete key
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </ApiKeyDetailsDialog>
              ))
            )}
          </div>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
