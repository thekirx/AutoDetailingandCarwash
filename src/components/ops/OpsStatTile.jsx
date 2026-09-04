import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

/** Ops dashboard metric — tabular nums, optional delta/icon/hint/loading. */
export default function OpsStatTile({
  label,
  value,
  delta,
  icon: Icon,
  hint,
  loading = false,
  mono = false,
  highlight = false,
  className,
}) {
  return (
    <div
      className={cn(
        'flex min-h-[4.5rem] flex-col justify-center gap-0.5 rounded-[var(--shape-card)] border border-border/70 bg-card px-3 py-2.5',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</span>
        {Icon ? <Icon className="size-4 shrink-0 text-primary/80" aria-hidden /> : null}
      </div>
      {loading ? (
        <Skeleton className="mt-1 h-7 w-20" />
      ) : (
        <span
          className={cn(
            'text-lg font-semibold tracking-tight',
            mono && 'font-mono tabular-nums',
            !mono && 'tabular-nums',
            highlight && 'text-primary',
          )}
        >
          {value}
        </span>
      )}
      {delta != null && delta !== '' ? (
        <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{delta}</span>
      ) : null}
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </div>
  )
}

export { OpsStatTile as StatCard }
