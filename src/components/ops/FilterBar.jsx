import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** Search + optional filters + clear. One row desktop; wraps on phone. */
export default function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  children,
  chips,
  onClear,
  className,
}) {
  const hasClear = typeof onClear === 'function'
  return (
    <div className={cn('flex flex-col gap-3 rounded-[var(--shape-card)] border border-border bg-card p-3', className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {typeof onSearchChange === 'function' ? (
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="min-h-11 pl-9"
              aria-label={searchPlaceholder}
            />
          </div>
        ) : null}
        {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
        {hasClear ? (
          <Button type="button" variant="ghost" className="min-h-11" onClick={onClear}>
            <X className="size-4" aria-hidden />
            Clear
          </Button>
        ) : null}
      </div>
      {chips?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.id || chip.label}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-foreground"
            >
              {chip.label}
              {chip.onRemove ? (
                <button type="button" className="rounded-full p-0.5 hover:bg-muted" aria-label={`Remove ${chip.label}`} onClick={chip.onRemove}>
                  <X className="size-3" />
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
