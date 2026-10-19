"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { BookOpen, CaretLeft, CaretRight, Database, Flask, Folder, House, List, ListChecks, LockKey, Play, ShieldCheck, SignOut, Siren } from "@phosphor-icons/react"
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { signoutAction } from "@/app/login/actions"

const STORAGE_KEY = "capgent_dashboard_sidebar_collapsed"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: House },
  { href: "/projects", label: "Projects & Keys", icon: Folder },
  { href: "/demo", label: "Live Attack Demo", icon: Siren },
  { href: "/attack-lab", label: "Judge Playground", icon: Flask },
  { href: "/data-gateway", label: "Data Gateway", icon: Database },
  { href: "/shield", label: "Injection Shield", icon: ShieldCheck },
  { href: "/policies", label: "Agent Permissions", icon: LockKey },
  { href: "/audit", label: "Audit Log", icon: ListChecks },
]

const QUICK_LINKS = [
  { href: "/docs", label: "Docs", icon: BookOpen },
  { href: "/playground", label: "Playground", icon: Play },
]

type SidebarUser = {
  name?: string | null
  email: string
  image?: string | null
}

function getInitial(user: SidebarUser) {
  return (user.name ?? user.email).charAt(0).toUpperCase()
}

function UserWidget({ user, collapsed }: { user: SidebarUser; collapsed: boolean }) {
  const initial = getInitial(user)
  return (
    <div className={cn("px-2 py-3", collapsed && "px-1")}>
      {collapsed ? (
        <form action={signoutAction} className="flex justify-center">
          <button
            type="submit"
            title="Sign out"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors"
          >
            {initial}
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted/50 transition-colors">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary select-none">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-foreground leading-tight">
              {user.name ?? user.email}
            </div>
            {user.name && (
              <div className="truncate text-[11px] text-muted-foreground leading-tight">{user.email}</div>
            )}
          </div>
          <form action={signoutAction}>
            <button
              type="submit"
              title="Sign out"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <SignOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export function AppSidebar({ user }: { user?: SidebarUser }) {
  const pathname = usePathname() || "/"
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === "true") setCollapsed(true)
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed))
  }, [collapsed])

  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`))

  return (
    <>
      {/* Mobile drawer trigger + content */}
      <div className="md:hidden w-0">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="fixed left-3 top-20 z-50 h-10 w-10 rounded-md border border-border/40 bg-background/80 text-muted-foreground backdrop-blur hover:text-foreground"
              aria-label="Open navigation"
            >
              <List className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 flex flex-col">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted/40">
                    <House className="h-4 w-4" weight="fill" />
                  </span>
                  <span className="text-sm font-semibold">Workspace</span>
                </div>
              </div>
              <Separator />
              <nav className="flex-1 overflow-y-auto px-2 py-3">
                <div className="space-y-1">
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon
                    const active = isActive(item.href)
                    return (
                      <SheetClose asChild key={item.href}>
                        <Button
                          asChild
                          size="sm"
                          variant={active ? "secondary" : "ghost"}
                          className={cn(
                            "h-9 w-full rounded-md justify-start gap-2",
                            active
                              ? "font-medium text-foreground"
                              : "font-normal text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Link href={item.href} className="flex items-center gap-2">
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        </Button>
                      </SheetClose>
                    )
                  })}
                </div>
              </nav>
              <Separator />
              <div className="px-2 py-3">
                {QUICK_LINKS.map((item) => {
                  const Icon = item.icon
                  return (
                    <SheetClose asChild key={item.href}>
                      <Button asChild size="sm" variant="ghost" className="h-9 w-full justify-start gap-2 rounded-md px-2">
                        <Link href={item.href} className="flex items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      </Button>
                    </SheetClose>
                  )
                })}
              </div>
              {user && (
                <>
                  <Separator />
                  <UserWidget user={user} collapsed={false} />
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden h-[calc(100vh-4rem)] shrink-0 border-r border-border/40 bg-background md:flex",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex h-full flex-col">
          {collapsed ? (
            <div className="flex flex-col items-center gap-1 px-1 py-3">
              <Link
                href="/dashboard"
                className="flex h-9 w-9 items-center justify-center rounded-md bg-muted/40"
                aria-label="Go to dashboard overview"
              >
                <House className="h-4 w-4" weight="fill" />
              </Link>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                onClick={() => setCollapsed(false)}
                aria-label="Expand sidebar"
              >
                <CaretRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between px-3 py-3">
              <Link
                href="/dashboard"
                className="flex items-center gap-2"
                aria-label="Go to dashboard overview"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted/40">
                  <House className="h-4 w-4" weight="fill" />
                </span>
                <span className="text-sm font-semibold">Workspace</span>
              </Link>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                onClick={() => setCollapsed(true)}
                aria-label="Collapse sidebar"
              >
                <CaretLeft className="h-4 w-4" />
              </Button>
            </div>
          )}

          <Separator />

          <nav className={cn("flex-1 overflow-y-auto px-2 py-3", collapsed && "px-1")}>
            <div className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Button
                    key={item.href}
                    asChild
                    size="sm"
                    variant={active ? "secondary" : "ghost"}
                    className={cn(
                      "h-9 w-full rounded-md",
                      collapsed ? "justify-center px-0" : "justify-start px-2",
                      active
                        ? "font-medium text-foreground"
                        : "font-normal text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Link
                      href={item.href}
                      className="flex items-center gap-2"
                      aria-label={collapsed ? item.label : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </Button>
                )
              })}
            </div>
          </nav>

          <Separator />

          <div className={cn("px-2 py-3 space-y-1", collapsed && "px-1")}>
            {QUICK_LINKS.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Button
                  key={item.href}
                  asChild
                  size="sm"
                  variant={active ? "secondary" : "ghost"}
                  className={cn(
                    "h-9 w-full rounded-md",
                    collapsed ? "justify-center px-0" : "justify-start px-2",
                    active
                      ? "font-medium text-foreground"
                      : "font-normal text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Link
                    href={item.href}
                    aria-label={collapsed ? item.label : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                </Button>
              )
            })}
          </div>

          {user && (
            <>
              <Separator />
              <UserWidget user={user} collapsed={collapsed} />
            </>
          )}
        </div>
      </aside>
    </>
  )
}
