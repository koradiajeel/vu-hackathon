"use client"

import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

/**
 * Hides marketing chrome (header) on Fumadocs routes so the docs layout is full-width like fumadocs.dev.
 */
export function MarketingChromeGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/"
  if (pathname === "/docs" || pathname.startsWith("/docs/")) return null
  return <>{children}</>
}
