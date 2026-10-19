import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 text-center">
      <div className="space-y-6 max-w-md">
        {/* Large 404 */}
        <div className="relative">
          <p className="font-heading text-[8rem] font-bold leading-none tabular-nums text-muted/30 select-none">
            404
          </p>
          <p className="absolute inset-0 flex items-center justify-center font-heading text-[8rem] font-bold leading-none tabular-nums text-foreground/5 blur-sm select-none">
            404
          </p>
        </div>

        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Page not found</h1>
          <p className="text-sm text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/docs">Documentation</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
