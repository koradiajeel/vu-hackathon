import type { ReactNode } from "react"
import { AppShell } from "@/components/layout/AppShell"
import { getSession } from "@/lib/auth"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getSession()
  return (
    <AppShell user={user ?? undefined}>
      <div className="p-6 md:p-8">{children}</div>
    </AppShell>
  )
}
