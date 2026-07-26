/**
 * Staff × date attendance heatmap (adapted from contribution-calendar pattern).
 * Y-axis = employee names · X-axis = dates · cells clickable for admin override.
 */
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'

const DEFAULT_COLORS = ['#1e293b', '#7f1d1d', '#ca8a04', '#15803d', '#22c55e']
const LIGHT_COLORS = ['#e2e8f0', '#fecaca', '#fde047', '#86efac', '#22c55e']
// 0 empty, 1 absent, 2 late, 3 unused, 4 present

function cellColor(count, colors) {
  if (!count) return colors[0]
  if (count === 1) return colors[1]
  if (count === 2) return colors[2]
  if (count === 3) return colors[3]
  return colors[4] || colors[colors.length - 1]
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
  colors,
  onCellClick,
  canOverride = false,
  className,
}) {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  const palette = colors || (isDark ? DEFAULT_COLORS : LIGHT_COLORS)

  return (
    <div className={cn('overflow-x-auto rounded-2xl border border-border bg-muted/30 p-4', className)}>
      <div className="inline-block min-w-full">
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `minmax(7.5rem,9rem) repeat(${Math.max(dates.length, 1)}, minmax(1.65rem, 2rem))`,
          }}
        >
          <div className="sticky left-0 z-10 bg-muted/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Staff
          </div>
          {dates.map((d) => (
            <div key={d} className="truncate text-center text-[10px] font-semibold text-muted-foreground" title={d}>
              {shortDate(d, period)}
            </div>
          ))}

          {matrix.map((row) => (
            <div key={row.staffId} className="contents">
              <div
                className="sticky left-0 z-10 truncate bg-muted/30 py-0.5 pr-2 text-xs font-medium text-foreground"
                title={row.name}
              >
                {row.name}
              </div>
              {row.cells.map((cell) => {
                const color = cellColor(cell.count, palette)
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
                      'h-6 w-full rounded-[4px] border border-border/60 transition',
                      clickable && 'cursor-pointer hover:ring-2 hover:ring-primary/50',
                      !clickable && 'cursor-default',
                    )}
                    style={{ backgroundColor: color }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
        <span>Empty</span>
        {palette.map((color, i) => (
          <div key={i} className="h-3 w-3 rounded-[4px]" style={{ backgroundColor: color }} title={['none', 'absent', 'late', '', 'present'][i]} />
        ))}
        <span>Present</span>
        <span className="ml-2">· absent · late · present</span>
      </div>
    </div>
  )
}

export { AttendanceHeatmap as GitHubCalendar }
