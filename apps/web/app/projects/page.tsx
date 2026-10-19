import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { getUserProjects, getProjectApiKeys } from "@/lib/projects"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { KeyCreationForm } from "./KeyCreationForm"
import { ProjectsForm } from "./ProjectsForm"
import { FileText, Key, Plus } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { UnifiedProjectsClient } from "@/app/projects/UnifiedProjectsClient"

interface ProjectsPageProps {
  searchParams: Promise<{ project_id?: string; tab?: string }>
}

export default async function ProjectsPage(props: ProjectsPageProps) {
  const [user, projects, searchParams] = await Promise.all([
    getSession(),
    getUserProjects(),
    props.searchParams,
  ])

  if (!user) redirect("/login")

  const selectedProjectId = searchParams?.project_id?.trim() || undefined
  const initialTab = searchParams?.tab === "keys" ? "keys" : "projects"

  const allKeysNested = await Promise.all(
    projects.map(async (p) => {
      const keys = await getProjectApiKeys(p.id)
      return keys.map((k) => ({ ...k, project: p }))
    })
  )
  const allKeys = allKeysNested.flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  const projectsWithKeyCount = projects.map((p) => ({
    ...p,
    keyCount: allKeys.filter((k) => k.project.id === p.id).length,
  }))

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Projects & Keys</h1>
          <p className="text-sm text-muted-foreground">
            Manage your projects and API keys in one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" asChild className="gap-2 text-muted-foreground hover:text-foreground">
            <Link href="/docs">
              <FileText className="h-4 w-4" /> Docs
            </Link>
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 h-9">
                <Plus className="h-4 w-4" /> New project
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create a new project</DialogTitle>
                <DialogDescription>Give your project a name to get started.</DialogDescription>
              </DialogHeader>
              <ProjectsForm />
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="gap-2 rounded-full px-5 h-9 shadow-sm">
                <Key className="h-4 w-4" /> Create API key
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create new API key</DialogTitle>
                <DialogDescription>
                  Generate a new API key for your backend. Copy it once and store it securely.
                </DialogDescription>
              </DialogHeader>
              <KeyCreationForm projects={projects} preselectedProjectId={selectedProjectId} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <UnifiedProjectsClient
        projects={projectsWithKeyCount}
        allKeys={allKeys}
        allProjects={projects}
        initialProjectId={selectedProjectId}
        initialTab={initialTab}
      />
    </div>
  )
}
