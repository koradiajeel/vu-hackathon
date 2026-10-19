"use client"

import { useState, useTransition } from "react"
import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Check, Copy } from "@phosphor-icons/react"
import { deleteKeyAction } from "./actions"

/** Public API origin (Vercel `NEXT_PUBLIC_CAPAGENT_API_BASE_URL`) — no trailing slash. */
function getCapgentApiBaseUrl(): string {
  return String(process.env.NEXT_PUBLIC_CAPAGENT_API_BASE_URL ?? "")
    .trim()
    .replace(/\/+$/, "")
}

export function ApiKeyDetailsDialog({
  apiKey,
  children,
}: {
  apiKey: { id: string; label: string | null; project: { id: string; name: string } }
  children: ReactNode
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedName, setCopiedName] = useState(false)
  const [copiedProjectName, setCopiedProjectName] = useState(false)
  const [copiedProjectNumber, setCopiedProjectNumber] = useState(false)
  const [copiedCurl, setCopiedCurl] = useState(false)

  function copyToClipboard(text: string, setter: (val: boolean) => void) {
    navigator.clipboard.writeText(text)
    setter(true)
    setTimeout(() => setter(false), 2000)
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteKeyAction(apiKey.project.id, apiKey.id)
      setOpen(false)
      router.refresh()
    })
  }

  const apiBase = getCapgentApiBaseUrl()
  const pingUrl = apiBase ? `${apiBase}/api/protected/ping` : ""
  // GET /api/protected/ping with project API key (same as dashboard “protected” demo).
  const curlCommand = pingUrl
    ? `curl -sS -H "X-Capgent-Api-Key: ${apiKey.id}" "${pingUrl}"`
    : ""

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-lg font-semibold tracking-tight">API key details</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-6 px-6 pb-8 pt-4">
          <div className="flex flex-col gap-2">
            <span className="text-[13px] text-muted-foreground">API Key</span>
            <div className="flex items-center justify-between group">
              <span className="font-mono text-[15px] font-medium text-foreground break-all">{apiKey.id}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-60 group-hover:opacity-100"
                onClick={() => copyToClipboard(apiKey.id, setCopiedKey)}
              >
                {copiedKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] text-muted-foreground">Name</span>
            <div className="flex items-center justify-between group">
              <span className="text-[15px] text-foreground">{apiKey.label || "Untitled key"}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-60 group-hover:opacity-100"
                onClick={() => copyToClipboard(apiKey.label || "Untitled key", setCopiedName)}
              >
                {copiedName ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] text-muted-foreground">Project name</span>
            <div className="flex items-center justify-between group">
              <span className="text-[15px] font-medium text-foreground">{apiKey.project.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-60 group-hover:opacity-100"
                onClick={() => copyToClipboard(apiKey.project.name, setCopiedProjectName)}
              >
                {copiedProjectName ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] text-muted-foreground">Project number</span>
            <div className="flex items-center justify-between group">
              <span className="text-[15px] font-medium text-foreground">{apiKey.project.id}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-60 group-hover:opacity-100"
                onClick={() => copyToClipboard(apiKey.project.id, setCopiedProjectNumber)}
              >
                {copiedProjectNumber ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-5 bg-muted/30 border-t border-border/40">
          {/* Delete with confirmation */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive/90 px-0 font-medium text-[15px] hover:bg-transparent"
                disabled={isPending}
              >
                {isPending ? "Deleting…" : "Delete key"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete API key?</AlertDialogTitle>
                <AlertDialogDescription>
                  The key <span className="font-mono">...{apiKey.id.slice(-4)}</span>
                  {apiKey.label ? ` (${apiKey.label})` : ""} will be permanently revoked.
                  Any backend using it will lose access immediately. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDelete}
                >
                  Delete key
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex items-center gap-6">
            <Button
              variant="ghost"
              className="hover:bg-transparent font-medium text-[15px] px-0"
              disabled={!curlCommand}
              title={
                curlCommand
                  ? undefined
                  : "Set NEXT_PUBLIC_CAPAGENT_API_BASE_URL to your Capgent API origin (e.g. https://your-worker.workers.dev)."
              }
              onClick={() => curlCommand && copyToClipboard(curlCommand, setCopiedCurl)}
            >
              {copiedCurl ? "Copied!" : "Copy cURL quickstart"}
            </Button>
            <Button
              size="sm"
              className="font-medium rounded-full px-6"
              onClick={() => copyToClipboard(apiKey.id, setCopiedKey)}
            >
              {copiedKey ? "Copied!" : "Copy key"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
