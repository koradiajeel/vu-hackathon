import { redirect } from "next/navigation"
import Link from "next/link"
import { getSession } from "@/lib/auth"
import { getProjectApiKeys, getUserProjects } from "@/lib/projects"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Folder, Key, Plus, ShieldCheck } from "@phosphor-icons/react/dist/ssr"

export default async function DashboardPage() {
  const [user, projects] = await Promise.all([
    getSession(),
    getUserProjects(),
  ])

  if (!user) redirect("/login")

  const projectsWithKeyCount = await Promise.all(
    projects.map(async (p) => {
      const keys = await getProjectApiKeys(p.id)
      return { project: p, keyCount: keys.length }
    })
  )

  const totalKeys = projectsWithKeyCount.reduce((a, x) => a + x.keyCount, 0)
  const activeProjects = projectsWithKeyCount.filter((x) => x.keyCount > 0).length
  const sortedProjects = [...projectsWithKeyCount].sort(
    (a, b) => b.project.createdAt.getTime() - a.project.createdAt.getTime()
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <Badge variant="secondary" className="w-fit">Workspace</Badge>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back, {user.name ?? user.email}.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Folder className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">{projects.length}</div>
              <div className="text-xs text-muted-foreground">Projects</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Key className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">{totalKeys}</div>
              <div className="text-xs text-muted-foreground">API Keys</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">{activeProjects}</div>
              <div className="text-xs text-muted-foreground">Active projects</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="group hover:border-primary/30 transition-colors">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <Plus className="h-4 w-4 text-primary" /> Create a project
                </div>
                <p className="text-sm text-muted-foreground">
                  Start a new project to organise your API keys.
                </p>
              </div>
            </div>
            <Button asChild className="mt-4 gap-2" size="sm">
              <Link href="/projects">
                Go to Projects <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="group hover:border-primary/30 transition-colors">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <Key className="h-4 w-4 text-primary" /> Manage API keys
                </div>
                <p className="text-sm text-muted-foreground">
                  Create, view, and revoke keys across all projects.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" className="mt-4 gap-2" size="sm">
              <Link href="/projects?tab=keys">
                View API Keys <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent projects */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Recent projects
          </h2>
          {projects.length > 0 && (
            <Button asChild variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
              <Link href="/projects">View all <ArrowRight className="h-3 w-3" /></Link>
            </Button>
          )}
        </div>

        {sortedProjects.length > 0 ? (
          <div className="grid gap-2">
            {sortedProjects.slice(0, 5).map(({ project: p, keyCount }) => (
              <Button key={p.id} asChild variant="outline" className="w-full justify-between gap-4 h-auto py-3">
                <Link href={`/projects?project_id=${p.id}&tab=keys`} className="flex min-w-0 items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{p.name}</span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {keyCount} {keyCount === 1 ? "key" : "keys"}
                  </span>
                </Link>
              </Button>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No projects yet. Create your first project to get started.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
