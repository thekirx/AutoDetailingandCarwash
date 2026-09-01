import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

/**
 * shadcn tab triggers — use inside a parent <Tabs value onValueChange>.
 * Matches Attendance / POS: inline-flex h-11, min-h-9 touch targets.
 */
export default function OpsTabList({ tabs, className, 'aria-label': ariaLabel }) {
  if (!tabs?.length) return null

  return (
    <TabsList
      aria-label={ariaLabel}
      className={cn('inline-flex h-11 w-full max-w-full gap-1 overflow-x-auto p-1 sm:w-auto', className)}
    >
      {tabs.map((item) => {
        const Icon = item.icon
        return (
          <TabsTrigger
            key={item.id}
            value={item.id}
            className="h-9 min-h-9 shrink-0 gap-2 px-3 sm:flex-initial sm:px-4"
          >
            {Icon ? <Icon aria-hidden /> : null}
            {item.label}
            {item.badge != null && item.badge !== '' ? (
              <span className="tabular-nums text-muted-foreground">({item.badge})</span>
            ) : null}
          </TabsTrigger>
        )
      })}
    </TabsList>
  )
}
