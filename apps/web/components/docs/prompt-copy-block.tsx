"use client"

import { Check, Copy } from "lucide-react"
import { useCallback, useState } from "react"

import { Button } from "@/components/ui/button"
import { GUESTBOOK_AGENT_PROMPT } from "@/lib/docs/guestbook-agent-prompt"
import { cn } from "@/lib/utils"

type PromptCopyBlockProps = {
  className?: string
}

export function PromptCopyBlock({ className }: PromptCopyBlockProps) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(GUESTBOOK_AGENT_PROMPT)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [])

  return (
    <div
      className={cn(
        "not-prose relative overflow-hidden rounded-xl border border-border bg-card text-left text-card-foreground shadow-sm",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          Agent prompt — paste into system / developer message
        </span>
        <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => void copy()}>
          {copied ? (
            <>
              <Check className="size-3.5 text-green-600 dark:text-green-400" aria-hidden />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" aria-hidden />
              Copy to clipboard
            </>
          )}
        </Button>
      </div>
      <pre className="max-h-[min(70vh,36rem)] overflow-auto p-4 text-[13px] leading-relaxed text-foreground">
        <code>{GUESTBOOK_AGENT_PROMPT}</code>
      </pre>
    </div>
  )
}
