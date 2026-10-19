import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_WEB_BASE_URL ?? "https://capgent.vercel.app"
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: `${base.replace(/\/+$/, "")}/sitemap.xml`,
  }
}

