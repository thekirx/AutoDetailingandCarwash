import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

/**
 * shadcn tab triggers — use inside a parent <Tabs value onValueChange>.
 * Every trigger is a 44px touch target (h-11) inside a 52px track.
 */
export default function OpsTabList({ tabs, className, 'aria-label': ariaLabel }) {
  if (!tabs?.length) return null

  return (
    <TabsList
      aria-label={ariaLabel}
      className={cn('inline-flex h-[3.25rem] w-full max-w-full justify-start gap-1 overflow-x-auto overflow-y-hidden p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden group-data-horizontal/tabs:h-[3.25rem] sm:w-auto', className)}
    >
      {tabs.map((item) => {
        const Icon = item.icon
        return (
          <TabsTrigger
            key={item.id}
            value={item.id}
            className="h-11 min-h-11 shrink-0 gap-2 px-3 sm:flex-initial sm:px-4"
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
