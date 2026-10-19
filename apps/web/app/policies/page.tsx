import type { Metadata } from "next"
import { PoliciesClient } from "./PoliciesClient"

export const metadata: Metadata = {
  title: "Agent Permissions",
  description: "Least-privilege roles for AI agents: what each agent may do, what needs approval, and what is always denied.",
}

export default function PoliciesPage() {
  return <PoliciesClient />
}
