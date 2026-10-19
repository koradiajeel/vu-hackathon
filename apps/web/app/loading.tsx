import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="container max-w-5xl py-16 md:py-24 space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-6 w-40 rounded-full" />
        <Skeleton className="h-10 w-72 max-w-full rounded-xl" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-9 w-32 rounded-md mt-2" />
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-9 w-40 rounded-md mt-2" />
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  )
}

