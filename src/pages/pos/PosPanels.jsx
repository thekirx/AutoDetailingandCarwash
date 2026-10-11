import { useEffect, useState } from 'react'
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Clock3,
  Receipt,
  ShoppingBag,
  Volume2,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  POS_LONG_WAIT_MIN,
  POS_WORKFLOW_STEPS,
  formatQueueTicket,
  formatWaitMinutes,
  waitMinutes,
} from '@/lib/posInsights'
import { formatMoney } from '@/queue/queueApi'
export function PosStatsBoard({ stats, categoryRows = [], compact = false }) {
  const {
    salesMinor = 0,
    paidCount = 0,
    pendingCount = 0,
    avgTicketMinor = 0,
    expenseMinor = 0,
  } = stats || {}

  const tiles = [
    { label: 'Paid today', value: String(paidCount), mono: false },
    { label: 'Waiting to pay', value: String(pendingCount), mono: false, highlight: pendingCount > 0 },
    { label: 'Avg ticket', value: formatMoney(avgTicketMinor), mono: true },
    ...(compact ? [] : [{ label: 'Expenses', value: formatMoney(expenseMinor), mono: true }]),
  ]

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
          <div>
            <CardDescription className="text-[10px] font-semibold tracking-[0.16em] uppercase">
              Sales today
            </CardDescription>
            <CardTitle className="mt-1 font-mono text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">
              {formatMoney(salesMinor)}
            </CardTitle>
          </div>
          {pendingCount > 0 ? (
            <Badge variant="secondary" className="shrink-0">
              {pendingCount} waiting
            </Badge>
          ) : null}
        </CardHeader>
        <CardContent className="pt-0">
          <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
            {tiles.map((tile) => (
              <div key={tile.label} className="min-h-[44px]">
                <dt className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{tile.label}</dt>
                <dd
                  className={`mt-1 text-lg font-semibold ${tile.mono ? 'font-mono tabular-nums' : ''} ${
                    tile.highlight ? 'text-primary' : ''
                  }`}
                >
                  {tile.value}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {!compact && categoryRows.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {categoryRows.map((row) => (
            <div
              key={row.label}
              className="flex min-h-[44px] flex-col justify-center rounded-xl border border-border/70 bg-card px-3 py-2"
            >
              <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{row.label}</span>
              <b className="mt-0.5 font-mono text-base font-semibold tabular-nums">{row.value}</b>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

const STEP_ICONS = {
  sell: ShoppingBag,
  queue: Receipt,
  expenses: Wallet,
  close: CircleDollarSign,
}

export function PosGuideCard({ defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Card className="border-primary/15 bg-muted/15">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div className="flex gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BookOpen className="size-5" aria-hidden />
          </div>
          <div>
            <CardTitle className="text-base">How POS works</CardTitle>
            <CardDescription className="mt-1 max-w-prose">
              Four steps from sale to crew pay. Tap a step if you are new to the counter.
            </CardDescription>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11 min-w-11 shrink-0"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
          <span className="sr-only">{open ? 'Hide guide' : 'Show guide'}</span>
        </Button>
      </CardHeader>
      {open ? (
        <CardContent className="pt-0">
          <ol className="grid gap-3 sm:grid-cols-2">
            {POS_WORKFLOW_STEPS.map((step, index) => {
              const Icon = STEP_ICONS[step.id] || Clock3
              return (
                <li
                  key={step.id}
                  className="flex gap-3 rounded-xl border border-border/60 bg-background/80 p-3"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold tabular-nums">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-medium">
                      <Icon className="size-4 text-primary" aria-hidden />
                      {step.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </CardContent>
      ) : null}
    </Card>
  )
}

const TICKETS_SHOWN = 6

/** Re-renders every 30s so wait times stay current without a reload. */
function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])
  return now
}

/** Cars the floor sent to pay, oldest first, as large tickets above the catalogue. Tap one to put it on the order. */
export function PosOpenTickets({ tickets = [], activeId = null, totalMinor = 0, onOpen, onReplay }) {
  const now = useMinuteClock()
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? tickets : tickets.slice(0, TICKETS_SHOWN)
  const hidden = tickets.length - visible.length
  const longWaits = tickets.filter((row) => (waitMinutes(row.created_at, now) ?? 0) >= POS_LONG_WAIT_MIN).length

  return (
    <section aria-labelledby="pos-open-tickets-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-2.5">
          <h2 id="pos-open-tickets-title" className="text-lg font-semibold tracking-tight">
            Waiting to pay
          </h2>
          {tickets.length ? (
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--pos-navy)] px-2 text-xs font-semibold text-white tabular-nums">
              {tickets.length}
            </span>
          ) : null}
          {longWaits ? (
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-amber-500/15 px-2 text-xs font-medium text-amber-900 dark:text-amber-100">
              <Clock3 className="size-3.5" aria-hidden />
              {longWaits} over {POS_LONG_WAIT_MIN} min
            </span>
          ) : null}
        </div>
        {tickets.length ? (
          <p className="text-sm text-muted-foreground">
            To collect{' '}
            <span className="font-mono text-base font-semibold text-foreground tabular-nums">{formatMoney(totalMinor)}</span>
          </p>
        ) : null}
      </div>

      {tickets.length ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,16.5rem),1fr))] gap-3">
          {visible.map((row) => {
            const booking = row.bookings || {}
            const active = row.id === activeId
            const plate = booking.vehicle_plate || 'No plate'
            const name = booking.customer_name || 'Customer'
            const vehicle = [booking.vehicle_make, booking.vehicle_model].filter(Boolean).join(' ')
            const waited = waitMinutes(row.created_at, now)
            const long = (waited ?? 0) >= POS_LONG_WAIT_MIN
            const amount = formatMoney(row.amount_minor ?? booking.final_price_minor ?? booking.price_minor ?? 0)
            return (
              <li key={row.id} className="relative min-w-0">
                <button
                  type="button"
                  aria-pressed={active}
                  aria-label={`${formatQueueTicket(booking)} · ${plate} · ${name} · ${amount}${waited != null ? ` · waiting ${formatWaitMinutes(waited)}` : ''}`}
                  onClick={() => onOpen(row)}
                  className={`flex min-h-[7.5rem] w-full items-stretch overflow-hidden rounded-2xl border text-left transition-[border-color,background-color,transform] duration-150 ease-out active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none ${
                    active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  <span className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center gap-1 bg-[var(--pos-navy)] px-1 text-white">
                    <span className="text-[10px] font-semibold tracking-[0.14em] text-white/70 uppercase">Queue</span>
                    <span className="font-mono text-2xl font-semibold tabular-nums">
                      {booking.queue_number != null ? String(booking.queue_number).padStart(3, '0') : '—'}
                    </span>
                  </span>
                  <span className={`flex min-w-0 flex-1 flex-col gap-1 py-3 pl-4 ${onReplay ? 'pr-12' : 'pr-4'}`}>
                    <span className="truncate font-mono text-lg leading-tight font-semibold tracking-wide uppercase" title={plate}>
                      {plate}
                    </span>
                    <span className="truncate text-sm text-muted-foreground" title={vehicle ? `${vehicle} · ${name}` : name}>
                      {vehicle ? `${vehicle} · ${name}` : name}
                    </span>
                    <span className="mt-auto flex items-end justify-between gap-2 pt-1">
                      <span className="font-mono text-xl font-semibold tracking-tight tabular-nums">{amount}</span>
                      {active ? (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">On order</span>
                      ) : waited != null ? (
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums ${
                            long ? 'bg-amber-500/15 text-amber-900 dark:text-amber-100' : 'text-muted-foreground'
                          }`}
                        >
                          <Clock3 className="size-3.5" aria-hidden />
                          {formatWaitMinutes(waited)}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
                {onReplay ? (
                  <button
                    type="button"
                    aria-label={`Announce ${plate} again`}
                    title="Announce again"
                    onClick={() => onReplay(row)}
                    className="absolute top-1.5 right-1.5 flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Volume2 className="size-4" aria-hidden />
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
          No cars waiting to pay. Tickets from the floor show up here on their own.
        </p>
      )}

      {tickets.length > TICKETS_SHOWN ? (
        <Button type="button" variant="outline" className="min-h-11 self-start" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
          {showAll ? 'Show fewer' : `Show ${hidden} more waiting`}
        </Button>
      ) : null}
    </section>
  )
}
