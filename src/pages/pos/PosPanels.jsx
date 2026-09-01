import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Clock3,
  Receipt,
  ShoppingBag,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { POS_WORKFLOW_STEPS } from '@/lib/posInsights'
import { formatMoney } from '@/queue/queueApi'
import { demoWashPoolSplit, latePaySharePercent } from '@/lib/compensation'

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
    { label: 'Pay queue', value: String(pendingCount), mono: false, highlight: pendingCount > 0 },
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

export function PosGuideCard({ defaultOpen = true }) {
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

export function PosSalaryPreviewCard({ washPreview, compRules, canPayroll, canAttendance }) {
  if (!washPreview) return null
  const latePct = latePaySharePercent(compRules)
  const split = demoWashPoolSplit({
    poolMinor: washPreview.poolMinor || 0,
    onTimeCount: washPreview.presentCount || 0,
    lateCount: washPreview.lateCount || 0,
    lateWeight: compRules?.attendance_late_weight,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Crew pay connection</CardTitle>
        <CardDescription className="max-w-prose">
          Car-wash sales today feed the wash pool ({washPreview.washPoolPct}% of{' '}
          {formatMoney(washPreview.carWashMinor)} = {formatMoney(washPreview.poolMinor)}). Split among{' '}
          {washPreview.onSiteCount} on-site crew using attendance weights (late = {latePct}% share).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {washPreview.poolMinor > 0 && washPreview.onSiteCount > 0 ? (
          <div className="rounded-xl border border-border bg-muted/20 p-3 text-sm">
            <p className="font-medium">Today&apos;s pool split</p>
            <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
              {washPreview.presentCount > 0 ? (
                <li>
                  On time ({washPreview.presentCount}) → {formatMoney(split.perOnTimeMinor)} each
                </li>
              ) : null}
              {washPreview.lateCount > 0 ? (
                <li>
                  Late ({washPreview.lateCount}) → {formatMoney(split.perLateMinor)} each
                </li>
              ) : null}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Pool preview appears when there are car-wash sales and crew clocked in present or late.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {canAttendance ? (
            <Button type="button" variant="outline" className="min-h-11" asChild>
              <Link to="/operations/attendance?tab=register">Attendance register</Link>
            </Button>
          ) : null}
          {canPayroll ? (
            <Button type="button" variant="outline" className="min-h-11" asChild>
              <Link to="/operations/payroll">Open Payroll</Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

export function PosPendingEmpty() {
  return (
    <Card className="border-dashed">
      <CardHeader className="text-center">
        <CardTitle className="text-lg">No cars waiting to pay</CardTitle>
        <CardDescription className="mx-auto max-w-md">
          When the floor marks a job ready, the ticket lands here. You can also sell walk-ins from the Sell tab.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center pb-8">
        <Button type="button" variant="secondary" className="min-h-11" asChild>
          <Link to="/operations/pos">Go to Sell</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
