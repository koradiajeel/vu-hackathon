import type { Metadata } from "next"
import { AuditClient } from "./AuditClient"

export const metadata: Metadata = {
  title: "Audit Log",
  description: "Every allowed, denied and approved agent action across AgentWarden's three layers.",
}

export default function AuditPage() {
  return <AuditClient />
}
