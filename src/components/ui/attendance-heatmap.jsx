/**
 * Staff × date attendance heatmap.
 * Y-axis = team · X-axis = dates · cells open override when allowed.
 */
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'

function cellTone(count) {
  if (!count) return 'bg-muted'
  if (count === 1) return 'bg-destructive/20 dark:bg-destructive/35'
  if (count === 2) return 'bg-amber-300/90 dark:bg-amber-600/55'
  return 'bg-emerald-500 dark:bg-emerald-600'
}

function shortDate(iso, period) {
  try {
    const d = parseISO(iso)
    if (period === 'daily') return format(d, 'EEE MMM d')
    if (period === 'weekly') return format(d, 'EEE d')
    return format(d, 'd')
  } catch {
    return iso
  }
}

export function AttendanceHeatmap({
  matrix = [],
  dates = [],
  period = 'weekly',
  onCellClick,
  canOverride = false,
  className,
}) {
  return (
    <div className={cn('overflow-x-auto rounded-2xl border border-border/80 bg-card p-4 shadow-sm', className)}>
      <div className="inline-block min-w-full">
        <div
          className="grid gap-1.5"
          style={{
            gridTemplateColumns: `minmax(8rem,10rem) repeat(${Math.max(dates.length, 1)}, minmax(1.75rem, 2.25rem))`,
          }}
        >
          <div className="sticky left-0 z-10 bg-card py-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Team
          </div>
          {dates.map((d) => (
            <div key={d} className="truncate py-1 text-center text-[10px] font-medium text-muted-foreground" title={d}>
              {shortDate(d, period)}
            </div>
          ))}

          {matrix.map((row) => (
            <div key={row.staffId} className="contents">
              <div
                className="sticky left-0 z-10 truncate bg-card py-1 pr-2 text-xs font-medium text-foreground"
                title={row.role ? `${row.name} · ${row.role}` : row.name}
              >
                {row.name}
              </div>
              {row.cells.map((cell) => {
                const label = cell.status
                  ? `${row.name} · ${cell.date} · ${cell.status}`
                  : `${row.name} · ${cell.date} · no record`
                const clickable = canOverride
                return (
                  <button
                    key={`${row.staffId}-${cell.date}`}
                    type="button"
                    disabled={!clickable}
                    title={label}
                    aria-label={label}
                    onClick={() => clickable && onCellClick?.({ staffId: row.staffId, name: row.name, cell })}
                    className={cn(
                      'aspect-square min-h-7 w-full rounded-md border border-border/50 transition active:scale-[0.97]',
                      cellTone(cell.count),
                      clickable && 'cursor-pointer hover:ring-2 hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-ring',
                      !clickable && 'cursor-default',
                    )}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border/60 pt-4 text-xs text-muted-foreground">
        {[
          [0, 'Empty'],
          [1, 'Absent'],
          [2, 'Late'],
          [4, 'Present'],
        ].map(([idx, label]) => (
          <span key={label} className="inline-flex items-center gap-2">
            <span className={cn('inline-block size-3 rounded-md border border-border/50', cellTone(idx))} aria-hidden />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

export { AttendanceHeatmap as GitHubCalendar }
