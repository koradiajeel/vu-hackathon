import { createMDX } from "fumadocs-mdx/next"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

const withMDX = createMDX()

const fumadocsStyleShim = resolve(__dirname, "styles/shims/fumadocs-style-shim.css")

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Embedded local Postgres ships WASM files; load it from node_modules instead of bundling.
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    root: resolve(__dirname, "../../"),
    /**
     * Any accidental resolution of fumadocs-ui's Tailwind v4 bundle must not go through
     * the app's Tailwind v3 PostCSS pipeline (see build error on @layer base).
     */
    resolveAlias: {
      "fumadocs-ui/style.css": fumadocsStyleShim,
      "fumadocs-ui/dist/style.css": fumadocsStyleShim,
    },
  },
  webpack: (config) => {
    config.resolve ||= {}
    config.resolve.alias = {
      ...config.resolve.alias,
      "fumadocs-ui/style.css": fumadocsStyleShim,
      "fumadocs-ui/dist/style.css": fumadocsStyleShim,
    }
    return config
  },
}

export default withMDX(nextConfig)
