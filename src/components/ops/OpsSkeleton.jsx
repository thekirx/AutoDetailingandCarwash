import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** Page-shaped skeleton for ops lists / dashboards. */
export default function OpsSkeleton({ rows = 4, className }) {
  return (
    <div className={cn('flex flex-col gap-3', className)} aria-busy="true" aria-label="Loading">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={`stat-${i}`} className="h-[4.5rem] rounded-[var(--shape-card)]" />
        ))}
      </div>
      <Skeleton className="h-11 w-full max-w-sm rounded-[var(--shape-interactive)]" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={`row-${i}`} className="h-14 w-full rounded-[var(--shape-card)]" />
      ))}
    </div>
  )
}
