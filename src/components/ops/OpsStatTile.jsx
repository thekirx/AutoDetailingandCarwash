import { cn } from '@/lib/utils'

/** Compact metric tile for ops dashboards — tabular nums when mono. */
export default function OpsStatTile({ label, value, mono = false, highlight = false, className }) {
  return (
    <div className={cn('flex min-h-[44px] flex-col justify-center rounded-xl border border-border/70 bg-card px-3 py-2', className)}>
      <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</span>
      <span
        className={cn(
          'mt-0.5 text-lg font-semibold',
          mono && 'font-mono tabular-nums',
          highlight && 'text-primary',
        )}
      >
        {value}
      </span>
    </div>
  )
}
