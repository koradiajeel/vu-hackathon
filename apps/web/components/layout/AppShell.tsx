import * as React from "react"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { cn } from "@/lib/utils"

type ShellUser = {
  name?: string | null
  email: string
  image?: string | null
}

export function AppShell({
  children,
  className,
  user,
}: {
  children: React.ReactNode
  className?: string
  user?: ShellUser
}) {
  return (
    <div className="container flex w-full max-w-screen-xl">
      <AppSidebar user={user} />
      <div className={cn("min-w-0 flex-1", className)}>{children}</div>
    </div>
  )
}
