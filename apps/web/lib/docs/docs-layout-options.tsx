import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"
import { DOCS_LINKS, DOCS_PRODUCT } from "@/lib/docs/constants"

/**
 * Options passed to Fumadocs `DocsLayout` (nav, top links, GitHub, search).
 * Keep product copy in `constants.ts`; keep layout wiring here only.
 */
export function getDocsLayoutProps(): BaseLayoutProps {
  return {
    githubUrl: DOCS_LINKS.github,
    nav: {
      title: DOCS_PRODUCT.name,
      url: DOCS_PRODUCT.docsHomePath,
    },
    links: [
      { text: "Home", url: "/" },
      { text: "Prompt template", url: "/docs/prompt-template" },
      { text: "Playground", url: "/playground" },
      { text: "Guestbook", url: "/guestbook" },
      { text: "Benchmarks", url: "/benchmarks" },
      { text: "Dashboard", url: "/dashboard" },
      {
        text: "SDK (npm)",
        url: DOCS_LINKS.npmSdk,
        external: true,
      },
      {
        text: "Website",
        url: DOCS_LINKS.webApp,
        external: true,
      },
    ],
    searchToggle: {
      enabled: true,
    },
    themeSwitch: {
      enabled: true,
    },
  }
}
