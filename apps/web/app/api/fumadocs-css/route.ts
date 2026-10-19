import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { NextResponse } from "next/server"

/** `app/api/fumadocs-css` → `apps/web` (three levels up from this file’s directory). */
const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const vendorCss = join(webRoot, "styles", "vendor", "fumadocs-ui.css")

let cached: string | null = null

function getCss(): string {
  if (process.env.NODE_ENV === "development") {
    return readFileSync(vendorCss, "utf-8")
  }
  if (!cached) {
    cached = readFileSync(vendorCss, "utf-8")
  }
  return cached
}

/**
 * Serves the prebuilt Fumadocs UI bundle without putting CSS under `public/`.
 * Source file is produced by `scripts/copy-fumadocs-css.mjs` (dev/build).
 */
export function GET() {
  if (!existsSync(vendorCss)) {
    return new NextResponse(
      "/* Fumadocs CSS missing — run: node scripts/copy-fumadocs-css.mjs */\n",
      {
        status: 503,
        headers: { "Content-Type": "text/css; charset=utf-8" },
      }
    )
  }
  return new NextResponse(getCss(), {
    headers: {
      "Content-Type": "text/css; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  })
}
