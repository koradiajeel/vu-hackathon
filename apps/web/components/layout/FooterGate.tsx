"use client"

import { usePathname } from "next/navigation"
import { SiteFooter } from "@/components/layout/SiteFooter"

const HIDE_FOOTER_PREFIXES = ["/dashboard", "/projects", "/docs"]

export function FooterGate() {
  const pathname = usePathname() || "/"
  const hide = HIDE_FOOTER_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  if (hide) return null
  return <SiteFooter />
}

