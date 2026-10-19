import type { Metadata } from "next"
import { ShieldLabClient } from "./ShieldLabClient"

export const metadata: Metadata = {
  title: "Shield Lab",
  description: "Paste any email, web page or document and see what AgentWarden's injection shield finds before an AI agent reads it.",
}

export default function ShieldPage() {
  return <ShieldLabClient />
}
