import type { Metadata } from "next"
import { DemoClient } from "./DemoClient"

export const metadata: Metadata = {
  title: "Live Attack Demo",
  description: "Watch an AI agent get hijacked by a hidden instruction — and see AgentWarden's three layers stop it.",
}

export default function DemoPage() {
  return <DemoClient />
}
