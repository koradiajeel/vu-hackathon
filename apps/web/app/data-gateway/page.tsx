import type { Metadata } from "next"
import { GatewayClient } from "./GatewayClient"

export const metadata: Metadata = {
  title: "Department Data Gateway",
  description: "AI agents from one department ask for another department's data in plain English. AgentWarden checks who they are, how risky the request is, and what SQL they may run.",
}

export default function DataGatewayPage() {
  return <GatewayClient />
}
