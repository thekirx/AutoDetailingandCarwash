/** Floor Board › Money (SA / ASA with finance view) for the selected timeline: gross / net / transactions / average /
 * net profit vs the prior window, net sales by hour, payment-method and service bars, per-branch table,
 * daily sheets waiting and drawer over/short alerts. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { supabase } from '@/lib/supabase'
import { collectPaged } from '@/lib/crmInsights'
import { scopeBranch } from '@/lib/financeData'
import { salesPeriodLabel } from '@/lib/salesSummary'
import { floorCompareWindow, floorMoneyBreakdown, formatAccounting } from '@/lib/dailySheet'
import { listSheets, loadSalesBetween } from '@/lib/dailySheetApi'

const LIGHT_SALE = 'id, branch, status, total_minor, discount_minor, payment_method, occurred_at'
const CARD = 'rounded-2xl border border-border bg-card p-4'
const EYEBROW = 'text-xs font-medium uppercase tracking-wide text-muted-foreground'

function Delta({ pct, vs }) {
  if (pct == null) return <span className="text-xs text-muted-foreground">{vs ? 'Nothing to compare' : '—'}</span>
  const up = pct >= 0
  return (
    <span className={`text-xs font-medium tabular-nums ${up ? 'text-emerald-700' : 'text-rose-700'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct)}% {vs}
    </span>
  )
}

function Kpi({ label, value, pct, vs, negative, children }) {
  return (
    <div className={`${CARD} flex flex-col gap-1`}>
      <p className={EYEBROW}>{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${negative ? 'text-rose-700' : ''}`}>{value}</p>
      {children || <Delta pct={pct} vs={vs} />}
    </div>
  )
}

function ShareBars({ title, rows, empty }) {
  return (
    <section className={CARD} aria-label={title}>
      <h3 className="mb-3 font-semibold">{title}</h3>
      {rows.length ? (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.id}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span>{r.label}</span>
                <span className="tabular-nums">
                  {formatAccounting(r.minor)} <span className="text-muted-foreground">· {r.share}%</span>
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-[#052699]" style={{ width: `${r.share}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  )
}

function Row({ label, value, children }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-2 border-b border-border/60 text-sm last:border-0">
      <span>{children || label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

export default function FloorMoneyPanel({
  profile,
  branchFilter = 'all',
  branchName = (slug) => slug,
  refreshKey,
  preset = 'today',
  startDate,
  endDate,
  cancelLossMinor = 0,
  onOpenCancelled,
}) {
  const [state, setState] = useState({ loading: true, error: '', money: null, sheetsError: '', win: null })
  const seq = useRef(0)

  const load = useCallback(async () => {
    if (!startDate || !endDate) return
    const id = ++seq.current
    const win = floorCompareWindow(preset, { start: startDate, end: endDate })
    const weekAgo = new Date(`${endDate}T00:00:00Z`)
    weekAgo.setUTCDate(weekAgo.getUTCDate() - 6)
    setState((s) => ({ ...s, loading: true }))
    try {
      const [sales, priorSales, plRows, sheetRes] = await Promise.all([
        loadSalesBetween(branchFilter, `${startDate}T00:00:00+08:00`, `${endDate}T23:59:59.999+08:00`),
        win ? loadSalesBetween(branchFilter, win.startIso, win.endIso, { select: LIGHT_SALE }) : [],
        collectPaged(async (from, to) => {
          const q = scopeBranch(
            supabase.from('finance_daily_pl').select('branch, kind, amount_minor').gte('period_date', startDate).lte('period_date', endDate),
            profile,
            branchFilter,
          )
          const { data, error } = await q.range(from, to)
          if (error) throw error
          return data || []
        }, 1000),
        listSheets({ branch: branchFilter, from: weekAgo.toISOString().slice(0, 10), limit: 100 }).then(
          (rows) => ({ rows }),
          (err) => ({ rows: [], error: err.message }),
        ),
      ])
      if (id !== seq.current) return
      setState({
        loading: false,
        error: '',
        win,
        sheetsError: sheetRes.error ? 'Daily sheets are not available yet (database update pending).' : '',
        money: floorMoneyBreakdown({ sales, priorSales, cutoffIso: win?.cutoffIso, plRows, sheets: sheetRes.rows }),
      })
    } catch (err) {
      if (id !== seq.current) return
      setState({ loading: false, error: err.message || 'Could not load money', money: null, sheetsError: '', win: null })
    }
  }, [profile, branchFilter, preset, startDate, endDate])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  if (state.loading && !state.money) {
    return <p className={`${CARD} text-sm text-muted-foreground`} role="status">Loading money…</p>
  }
  if (state.error) {
    return (
      <p className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900" role="alert">
        {state.error}. Tap Refresh above, or open Finance.
      </p>
    )
  }
  const m = state.money
  const today = preset === 'today'
  const vs = today ? 'vs yesterday' : 'vs prior period'
  const chartConfig = {
    today: { label: today ? 'Today' : 'This period', color: '#052699' },
    prior: { label: today ? 'Yesterday' : 'Prior period', color: '#b9b9b0' },
  }
  const hourly = m.hourly.filter((r) => (r.hour >= 7 && r.hour <= 21) || r.today || r.prior)
  const hasHourly = hourly.some((r) => r.today || r.prior)

  return (
    <div className={`flex flex-col gap-4 ${state.loading ? 'opacity-60' : ''}`} data-testid="floor-money" aria-busy={state.loading}>
      <p className="text-sm text-muted-foreground">
        {salesPeriodLabel(preset, { start: startDate, end: endDate })}
        {state.win ? ` · ${state.win.label}` : ''}
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Gross sales" value={formatAccounting(m.totals.grossMinor)} pct={m.change.gross} vs={vs} />
        <Kpi label="Net sales" value={formatAccounting(m.totals.netMinor)} pct={m.change.net} vs={vs} />
        <Kpi label="Transactions" value={m.totals.count.toLocaleString('en-PH')} pct={m.change.count} vs={vs} />
        <Kpi label="Average sale" value={formatAccounting(m.totals.avgMinor)} pct={m.change.avg} vs={vs} />
        <Kpi label="Net profit" value={formatAccounting(m.netProfitMinor)} negative={m.netProfitMinor < 0}>
          <Link to="/operations/finance?tab=pl" className="ds-link inline-flex min-h-11 items-center text-xs">
            Posted P&amp;L · open Profit and loss
          </Link>
        </Kpi>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className={CARD} aria-label="Net sales by hour">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold">Net sales by hour</h3>
            <p className="text-xs text-muted-foreground">
              {chartConfig.today.label} vs {chartConfig.prior.label.toLowerCase()}
            </p>
          </div>
          {hasHourly ? (
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
            <p className="py-10 text-center text-sm text-muted-foreground">No paid sales in this timeline or the one before.</p>
          )}
        </section>

        <div className="flex flex-col gap-4">
          <section className={CARD} aria-label="Daily sheets">
            <h3 className="mb-2 font-semibold">Daily sheets</h3>
            {m.allGood ? (
              <p className="text-sm text-muted-foreground">All good — nothing waiting, drawers balanced.</p>
            ) : (
              <div className="flex flex-col gap-1 text-sm">
                {m.waiting ? (
                  <Link to="/operations/finance?tab=sheets" className="ds-link inline-flex min-h-11 items-center font-medium">
                    {m.waiting} waiting for approval
                  </Link>
                ) : null}
                {m.alerts.slice(0, 3).map((a) => (
                  <Link key={a.id} to={`/operations/finance?tab=sheets&status=all&os=1&sheet=${a.id}`} className="inline-flex min-h-11 items-center text-rose-800 underline-offset-2 hover:underline">
                    {branchName(a.branch)} · {a.date}: drawer {a.overShortMinor > 0 ? 'over' : 'short'} {formatAccounting(Math.abs(a.overShortMinor))}
                  </Link>
                ))}
              </div>
            )}
            {state.sheetsError ? <p className="text-xs text-muted-foreground">{state.sheetsError}</p> : null}
          </section>

          <section className={CARD} aria-label="Deductions and costs">
            <h3 className="mb-1 font-semibold">Deductions and costs</h3>
            <Row label="Discounts" value={formatAccounting(m.totals.discountsMinor)} />
            <Row label="Refunds" value={formatAccounting(m.totals.refundsMinor)} />
            <Row value={formatAccounting(cancelLossMinor)}>
              {onOpenCancelled ? (
                <button type="button" className="ds-link min-h-9 text-left" onClick={onOpenCancelled}>
                  Cancelled jobs (estimate)
                </button>
              ) : (
                'Cancelled jobs (estimate)'
              )}
            </Row>
            <Row label="Posted expenses" value={formatAccounting(m.expensesMinor)} />
          </section>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ShareBars title="By payment method" rows={m.byMethod} empty="No paid sales in this timeline." />
        <ShareBars title="By service" rows={m.byFamily} empty="Nothing sold in this timeline." />
      </div>

      <section className={CARD} aria-label="By branch">
        <h3 className="mb-2 font-semibold">By branch</h3>
        {m.byBranch.length ? (
          <div className="overflow-x-auto">
            <table className="xero-table min-w-[640px]">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th className="num">Net sales</th>
                  <th className="num">Transactions</th>
                  <th className="num">Average</th>
                  <th className="num">Expenses</th>
                  <th className="num">Net profit</th>
                  <th className="num">Change</th>
                </tr>
              </thead>
              <tbody>
                {m.byBranch.map((b) => (
                  <tr key={b.branch}>
                    <td>{branchName(b.branch)}</td>
                    <td className="num">{formatAccounting(b.netMinor)}</td>
                    <td className="num">{b.count.toLocaleString('en-PH')}</td>
                    <td className="num">{formatAccounting(b.avgMinor)}</td>
                    <td className="num">{formatAccounting(b.expensesMinor)}</td>
                    <td className={`num ${b.netProfitMinor < 0 ? 'text-rose-700' : ''}`}>{formatAccounting(b.netProfitMinor)}</td>
                    <td className="num">
                      <Delta pct={b.netPct} vs="" />
                    </td>
                  </tr>
                ))}
              </tbody>
              {m.byBranch.length > 1 ? (
                <tfoot>
                  <tr className="font-semibold">
                    <td>Total</td>
                    <td className="num">{formatAccounting(m.totals.netMinor)}</td>
                    <td className="num">{m.totals.count.toLocaleString('en-PH')}</td>
                    <td className="num">{formatAccounting(m.totals.avgMinor)}</td>
                    <td className="num">{formatAccounting(m.expensesMinor)}</td>
                    <td className="num">{formatAccounting(m.netProfitMinor)}</td>
                    <td className="num">
                      <Delta pct={m.change.net} vs="" />
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No sales or posted P&amp;L in this timeline.</p>
        )}
      </section>
    </div>
  )
}
