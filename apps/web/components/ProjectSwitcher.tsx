"use client"

import * as React from "react"
import { BookOpen, CaretUpDown, Check, Gear, PlusCircle } from "@phosphor-icons/react"
import { useRouter, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type Project = {
  id: string
  name: string
}

interface ProjectSwitcherProps {
  projects: Project[]
}

export function ProjectSwitcher({ projects }: ProjectSwitcherProps) {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedProjectId = searchParams.get("project_id")

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || projects[0]

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">/</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            role="combobox"
            aria-expanded={open}
            className="h-9 justify-between px-2 text-sm font-medium hover:bg-muted"
          >
            {selectedProject?.name || "Select project"}
            <CaretUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandList>
              <CommandInput placeholder="Search project..." />
              <CommandEmpty>No project found.</CommandEmpty>
              <CommandGroup heading="PROJECTS">
                {projects.map((project) => (
                  <CommandItem
                    key={project.id}
                    onSelect={() => {
                      router.push(`/projects?project_id=${project.id}`)
                      setOpen(false)
                    }}
                    className="text-sm"
                  >
                    {project.name}
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        selectedProject?.id === project.id
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <CommandSeparator />
            <CommandList>
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    router.push("/projects")
                    setOpen(false)
                  }}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create Project
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    router.push("/projects")
                    setOpen(false)
                  }}
                >
                  <Gear className="mr-2 h-4 w-4" />
                  Manage Projects
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    router.push("/docs")
                    setOpen(false)
                  }}
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  Learn More
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
