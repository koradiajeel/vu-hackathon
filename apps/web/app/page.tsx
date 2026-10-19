import { Hero } from "@/components/landing/sections/Hero"
import { FeatureBento } from "@/components/landing/sections/FeatureBento"
import { CTA } from "@/components/landing/sections/CTA"
import { MosaicBackground } from "@/components/ui/mosaic-background"
import { ShardField } from "@/components/ui/glass-shard"

export default function HomePage() {
  const base = process.env.NEXT_PUBLIC_WEB_BASE_URL ?? "https://capgent.vercel.app"

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AgentWarden",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    url: base,
    description:
      "Verification and identity for AI agents — reverse CAPTCHA challenges, proof & identity tokens, and a protected API surface.",
    author: {
      "@type": "Person",
      name: "Piyush Dhoka",
      url: "https://github.com/piyushdhoka",
      sameAs: [
        "https://github.com/piyushdhoka",
        "https://www.linkedin.com/in/piyushdhoka27",
        "https://x.com/piyush_dhoka27",
      ],
    },
  }

  return (
    <main className="min-h-dvh relative overflow-hidden bg-background">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MosaicBackground className="z-0" />
      <ShardField />

      <div className="relative z-10 flex flex-col overflow-x-hidden">
        <Hero />
        <FeatureBento />
        <CTA />
      </div>
    </main>
  )
}
