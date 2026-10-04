import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, CarFront } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import { computeSheetTotals, formatAccounting, hourlyNetSales, manilaHour, METHOD_LABELS, summarizeSheetSales, topServices } from '@/lib/dailySheet'
import { pctChange } from '@/lib/financeData'
import { loadDaySales, loadSheet, previousDay, sheetErrorMessage } from '@/lib/dailySheetApi'
import { SheetStatusChip } from '@/pages/pos/DailySheetPanel'

const chartConfig = {
  today: { label: 'Today', color: '#052699' },
  prior: { label: 'Yesterday', color: '#b9b9b0' },
}

function Delta({ current, previous }) {
  const pct = pctChange(current, previous)
  if (!previous || pct == null) return <span className="text-xs text-muted-foreground">No sales yesterday by now</span>
  const up = pct >= 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={up ? 'ds-ok inline-flex items-center gap-0.5 text-xs font-semibold' : 'ds-neg inline-flex items-center gap-0.5 text-xs font-semibold'}>
      <Icon aria-hidden className="size-3.5" />
      {Math.abs(pct)}% vs yesterday by now
    </span>
  )
}

function Metric({ label, value, current, previous }) {
  return (
    <div className="ds-card flex flex-col gap-1 p-4">
      <p className="ds-eyebrow">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <Delta current={current} previous={previous} />
    </div>
  )
}

function Small({ label, value, hint }) {
  return (
    <div className="ds-card flex flex-col gap-1 p-4">
      <p className="ds-eyebrow">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

/** Branch Admin "Today": Square-style numbers, hourly vs yesterday, sheet status, cars waiting to pay. */
export default function PosTodayPanel({ branch, branchLabel, waitingCount = 0, waitingMinor = 0, refreshKey, onOpenSheet }) {
  const [today, setToday] = useState([])
  const [prior, setPrior] = useState([])
  const [sheet, setSheet] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!branch) return
    const date = getLocalCalendarDate()
    try {
      const [t, p] = await Promise.all([loadDaySales(branch, date), loadDaySales(branch, previousDay(date))])
      setToday(t)
      setPrior(p)
      setError('')
    } catch (err) {
      setError(sheetErrorMessage(err))
    }
    // Sheet status is optional here — a missing migration must not hide today's sales.
    loadSheet(branch, date).then(setSheet, () => setSheet(null))
  }, [branch])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const nowHour = manilaHour(new Date().toISOString())
  const t = useMemo(() => summarizeSheetSales(today), [today])
  const y = useMemo(
    () => summarizeSheetSales(prior.filter((s) => s.occurred_at && manilaHour(s.occurred_at) <= nowHour)),
    [prior, nowHour],
  )
  const hourly = useMemo(() => hourlyNetSales(today, prior).filter((r) => r.hour >= 7 && r.hour <= 21), [today, prior])
  const hasSales = hourly.some((r) => r.today > 0 || r.prior > 0)
  const top = useMemo(() => topServices(today, 5), [today])
  const spent = useMemo(() => computeSheetTotals({ lines: sheet?.daily_sheet_lines || [] }), [sheet])
  const pctOfGross = (minor) => (t.grossMinor ? `${Math.round((minor / t.grossMinor) * 1000) / 10}% of gross` : 'Nothing sold yet')

  return (
    <div className="ds-root">
      <header className="ds-head">
        <div>
          <p className="ds-eyebrow">Today · {branchLabel}</p>
          <h2 className="ds-title">How the day is going</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SheetStatusChip status={sheet?.status} />
          {onOpenSheet ? (
            <Button type="button" variant="outline" className="min-h-11" onClick={onOpenSheet}>
              Open daily sheet
            </Button>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="ds-banner ds-banner--warn" role="alert">
          <p className="text-sm">{error}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Gross sales" value={formatAccounting(t.grossMinor)} current={t.grossMinor} previous={y.grossMinor} />
        <Metric label="Net sales" value={formatAccounting(t.netMinor)} current={t.netMinor} previous={y.netMinor} />
        <Metric label="Transactions" value={t.count.toLocaleString('en-PH')} current={t.count} previous={y.count} />
        <Metric label="Average sale" value={formatAccounting(t.avgMinor)} current={t.avgMinor} previous={y.avgMinor} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Small label="Discounts" value={formatAccounting(t.discountsMinor)} hint={pctOfGross(t.discountsMinor)} />
        <Small label="Refunds" value={formatAccounting(t.refundsMinor)} hint={pctOfGross(t.refundsMinor)} />
        <Small
          label="Spent so far"
          value={formatAccounting(spent.totalExpensesMinor)}
          hint={sheet ? `Expenses ${formatAccounting(spent.expensesMinor)} · Salaries ${formatAccounting(spent.salariesMinor)}` : 'Nothing on the daily sheet yet'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <section className="ds-card p-4" aria-label="Net sales by hour">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h3 className="font-semibold">Net sales by hour</h3>
              <p className="text-xs text-muted-foreground">Today vs yesterday</p>
            </div>
            {hasSales ? (
              <div className="h-56">
                <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
                  <BarChart accessibilityLayer data={hourly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} />
                    <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `₱${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(v, name) => `${chartConfig[name]?.label || name}: ${formatAccounting(Math.round(Number(v) * 100))}`} />} />
                    <Bar dataKey="prior" fill="var(--color-prior)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="today" fill="var(--color-today)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No paid sales yet today or yesterday.</p>
            )}
          </section>

          <section className="ds-card p-4" aria-label="Top services">
            <h3 className="mb-2 font-semibold">Top services</h3>
            {top.length ? (
              top.map((s, i) => (
                <div key={s.name} className="ds-row">
                  <span>
                    {i + 1}. {s.name} <span className="text-muted-foreground">· {s.count} sold</span>
                  </span>
                  <span className="ds-num">{formatAccounting(s.grossMinor)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No services sold yet today.</p>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="ds-card flex items-center gap-3 p-4" aria-label="Cars waiting to pay">
            <CarFront aria-hidden className="size-8 text-[#052699]" />
            <div>
              <p className="text-2xl font-semibold tabular-nums">{waitingCount}</p>
              <p className="text-sm text-muted-foreground">
                {waitingCount === 1 ? 'car' : 'cars'} waiting to pay{waitingCount ? ` · ${formatAccounting(waitingMinor)}` : ''}
              </p>
            </div>
          </section>

          <section className="ds-card p-4" aria-label="Payment methods">
            <h3 className="mb-2 font-semibold">Payment methods</h3>
            {Object.entries(METHOD_LABELS).map(([key, label]) => (
              <div key={key} className="ds-row">
                <span>{label}</span>
                <span className="ds-num">{formatAccounting(t.byMethod[key])}</span>
              </div>
            ))}
          </section>

          <section className="ds-card p-4" aria-label="Sales by service">
            <h3 className="mb-2 font-semibold">By service</h3>
            {t.byFamily.length ? (
              t.byFamily.map((f) => (
                <div key={f.id} className="ds-row">
                  <span>{f.label}</span>
                  <span className="ds-num">{formatAccounting(f.minor)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nothing sold yet.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
