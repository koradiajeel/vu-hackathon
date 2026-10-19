/** Shared URLs and labels for the documentation shell (Fumadocs UI). */

export const DOCS_PRODUCT = {
  name: "AgentWarden",
  /** Docs home (sidebar title link). */
  docsHomePath: "/docs",
} as const

export const DOCS_LINKS = {
  github: "https://github.com/piyushdhoka/Capgent",
  npmSdk: "https://www.npmjs.com/package/capgent-sdk",
  webApp: "https://capgent.vercel.app",
} as const

/**
 * Hosted Capgent API on Vercel (Hono mounted at `/api/capgent`).
 * Same origin the web app + playground use — agents must call this absolute URL (not `/api/capgent` alone).
 */
export const PUBLIC_CAPGENT_API_BASE = "https://capgent.vercel.app/api/capgent" as const

/** Public Cloudflare Worker used by the default guestbook agent prompt (direct `/api/...` paths). */
export const PUBLIC_CAPGENT_WORKER_API_BASE =
  "https://capgent.piyushdhoka007.workers.dev" as const
