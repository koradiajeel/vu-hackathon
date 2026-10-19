import type { Metadata } from "next"
import { LabClient } from "./LabClient"

export const metadata: Metadata = {
  title: "Judge Playground",
  description: "Write your own attack email, web page or README and see whether AgentWarden stops the AI agent.",
}

export default function AttackLabPage() {
  return <LabClient />
}
