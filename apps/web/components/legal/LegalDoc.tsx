import type { ReactNode } from "react"

export function LegalDoc({
  title,
  effectiveDate,
  children,
}: {
  title: string
  effectiveDate: string
  children: ReactNode
}) {
  return (
    <main className="container max-w-3xl py-12 md:py-20">
      <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Effective date: {effectiveDate}</p>
      <div
        className={[
          "mt-10 space-y-7 text-sm leading-relaxed text-muted-foreground",
          "[&_h2]:mt-14 [&_h2]:scroll-mt-24 [&_h2]:border-b [&_h2]:border-border/40 [&_h2]:pb-2.5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:first:mt-0",
          "[&_h3]:mt-8 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground",
          "[&_p]:text-pretty [&_p+p]:mt-4",
          "[&_ul]:mt-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-2.5 [&_ul]:pl-5",
          "[&_ol]:mt-4 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-2.5 [&_ol]:pl-5",
          "[&_li]:marker:text-muted-foreground/70",
          "[&_a]:font-medium [&_a]:text-primary [&_a]:underline underline-offset-4 hover:text-primary/90",
          "[&_strong]:font-medium [&_strong]:text-foreground",
        ].join(" ")}
      >
        {children}
      </div>
    </main>
  )
}
