import { copyFileSync, existsSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const webRoot = join(__dirname, "..")

/** Vendor copy for local dev (API route fallback). */
const vendorDest = join(webRoot, "styles", "vendor", "fumadocs-ui.css")
/** Static asset for production — always available at /fumadocs-ui.css */
const publicDest = join(webRoot, "public", "fumadocs-ui.css")

const candidates = [
  join(webRoot, "node_modules", "fumadocs-ui", "dist", "style.css"),
  join(webRoot, "..", "..", "node_modules", "fumadocs-ui", "dist", "style.css"),
]

const src = candidates.find((p) => existsSync(p))
if (!src) {
  console.warn("[copy-fumadocs-css] fumadocs-ui dist/style.css not found; skip")
  process.exit(0)
}

mkdirSync(dirname(vendorDest), { recursive: true })
copyFileSync(src, vendorDest)
console.log("[copy-fumadocs-css] ✓ styles/vendor/fumadocs-ui.css")

copyFileSync(src, publicDest)
console.log("[copy-fumadocs-css] ✓ public/fumadocs-ui.css")
