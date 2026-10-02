/** Finance Profit and Loss — Xero-style: statement, this year by month, compare 1–12 periods, compare branches.
 * Trading income is split by service family with a reconciling discounts row. Layout lives in the URL (by, n). */
import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Download, FileSpreadsheet, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { supabase } from '@/lib/supabase'
import { collectPaged } from '@/lib/crmInsights'
import { formatMoney } from '@/queue/queueApi'
import { formatAccounting } from '@/lib/dailySheet'
import {
  FINANCE_LINE_KINDS,
  downloadCsv,
  downloadExcel,
  formatFinanceWindow,
  mergePlByCategory,
  printAsPdf,
  rollupPl,
  scopeBranch,
  topExpenseCategories,
} from '@/lib/financeData'
import {
  PERIOD_UNITS,
  PL_LAYOUTS,
  buildComparePeriods,
  parsePlLayout,
  pivotExportRows,
  plByBranches,
  plByPeriods,
  tradingIncomeRows,
  yearMonths,
} from '@/lib/financeBooks'
import { FinanceEmpty, FinanceMetricCell, FinanceMetricStrip, FinancePanel, FinanceTabSkeleton } from './FinanceChrome'

const expenseConfig = {
  amount: { label: 'Spend', color: '#b91c1c' },
}
const FAMILY_LABELS = Object.fromEntries(FINANCE_LINE_KINDS.map((k) => [k.id, k.label]))

function usePlSpan({ enabled, start, end, profile, branchFilter }) {
  const [state, setState] = useState({ loading: false, error: '', pl: [], kinds: [] })
  useEffect(() => {
    if (!enabled) return undefined
    let alive = true
    const page = (table, cols) =>
      collectPaged(async (from, to) => {
        const q = scopeBranch(supabase.from(table).select(cols).gte('period_date', start).lte('period_date', end), profile, branchFilter)
        const { data, error } = await q.range(from, to)
        if (error) throw error
        return data || []
      }, 1000)
    setState((s) => ({ ...s, loading: true, error: '' }))
    Promise.all([
      page('finance_daily_pl', 'branch, period_date, kind, category, amount_minor'),
      page('finance_daily_line_kind', 'branch, period_date, line_kind, amount_minor').catch(() => []),
    ]).then(
      ([pl, kinds]) => alive && setState({ loading: false, error: '', pl, kinds }),
      (err) => alive && setState({ loading: false, error: err.message || 'Could not load P&L', pl: [], kinds: [] }),
    )
    return () => {
      alive = false
    }
  }, [enabled, start, end, profile, branchFilter])
  return state
}

function PivotTable({ headings, pivot }) {
  const sum = (arr) => arr.reduce((s, v) => s + v, 0)
  const cells = (values, total, strong) => (
    <>
      {values.map((v, i) => (
        <td key={headings[i]} className={`num${strong ? ' font-semibold' : ''}`}>
          {v ? formatAccounting(v) : '—'}
        </td>
      ))}
      <td className="num font-semibold">{formatAccounting(total)}</td>
    </>
  )
  const section = (title, rows, totalLabel, totals) => (
    <>
      <tr className="finance-pl-section">
        <th colSpan={headings.length + 2}>{title}</th>
      </tr>
      {rows.map((r) => (
        <tr key={`${title}:${r.category}`}>
          <td>{r.category}</td>
          {cells(r.values, r.total)}
        </tr>
      ))}
      <tr className="finance-pl-subtotal">
        <td>{totalLabel}</td>
        {cells(totals, sum(totals), true)}
      </tr>
    </>
  )
  const net = sum(pivot.totals.net)
  return (
    <div className="overflow-x-auto">
      <table className="xero-table" style={{ minWidth: `${Math.max(520, 200 + headings.length * 112)}px` }}>
        <thead>
          <tr>
            <th>Account</th>
            {headings.map((h) => (
              <th key={h} className="num">
                {h}
              </th>
            ))}
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {section('Trading income', pivot.income, 'Total trading income', pivot.totals.income)}
          {section('Operating expenses', pivot.expense, 'Total operating expenses', pivot.totals.expenses)}
          <tr className={`finance-pl-net ${net >= 0 ? 'is-positive' : 'is-negative'}`}>
            <td>Net profit</td>
            {cells(pivot.totals.net, net, true)}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default function FinancePLTab({
  plRows,
  priorPlRows = [],
  kindRows = [],
  priorKindRows = [],
  range,
  compareRange,
  loading,
  profile,
  branchFilter = 'all',
  branchOptions = [],
  layout: layoutParam = '',
  periodsBack = '',
  onLayout,
}) {
  const { layout, unit, count } = parsePlLayout(layoutParam, periodsBack)
  const periods = useMemo(() => {
    if (layout === 'fy') return yearMonths(range.end)
    if (layout === 'compare') return buildComparePeriods({ end: range.end, unit, count })
    return []
  }, [layout, unit, count, range.end])
  const span = usePlSpan({
    enabled: periods.length > 0,
    start: periods[0]?.start,
    end: periods[periods.length - 1]?.end,
    profile,
    branchFilter,
  })

  const splitRows = useMemo(() => tradingIncomeRows(plRows, kindRows, FAMILY_LABELS), [plRows, kindRows])
  const splitPrior = useMemo(() => tradingIncomeRows(priorPlRows, priorKindRows, FAMILY_LABELS), [priorPlRows, priorKindRows])
  const pl = useMemo(() => rollupPl(plRows), [plRows])
  const prior = useMemo(() => rollupPl(priorPlRows), [priorPlRows])
  const comparing = Boolean(compareRange)
  const merged = useMemo(() => mergePlByCategory(splitRows, comparing ? splitPrior : []), [splitRows, splitPrior, comparing])
  const incomeRows = merged.filter((r) => r.kind === 'income')
  const expenseRows = merged.filter((r) => r.kind === 'expense')
  const expenseBars = useMemo(() => topExpenseCategories(plRows, 6), [plRows])

  const branchCols = useMemo(() => {
    const list = branchFilter && branchFilter !== 'all' ? branchOptions.filter((b) => b.slug === branchFilter) : branchOptions
    return list.length ? list : [...new Set(plRows.map((r) => r.branch))].map((slug) => ({ slug, name: slug }))
  }, [branchOptions, branchFilter, plRows])

  const grid = useMemo(() => {
    if (layout === 'branches') {
      return { headings: branchCols.map((b) => b.name), pivot: plByBranches(splitRows, branchCols.map((b) => b.slug)) }
    }
    if (!periods.length) return null
    const rows = tradingIncomeRows(span.pl, span.kinds, FAMILY_LABELS)
    return { headings: periods.map((p) => p.label), pivot: plByPeriods(rows, periods) }
  }, [layout, branchCols, splitRows, periods, span.pl, span.kinds])

  const statementExport = useMemo(() => {
    const line = (section, category, current, priorMinor, pct) => ({
      section,
      category,
      amount: formatMoney(current),
      compare: comparing ? formatMoney(priorMinor) : '',
      change: comparing && pct != null ? `${pct}%` : '',
    })
    return [
      ...incomeRows.map((r) => line('Trading income', r.category, r.current, r.prior, r.deltaPct)),
      line('Trading income', 'Total trading income', pl.income, prior.income),
      ...expenseRows.map((r) => line('Operating expenses', r.category, r.current, r.prior, r.deltaPct)),
      line('Operating expenses', 'Total operating expenses', pl.expenses, prior.expenses),
      line('Bottom line', pl.net >= 0 ? 'Net profit' : 'Net loss', pl.net, prior.net),
    ]
  }, [incomeRows, expenseRows, pl, prior, comparing])

  const windowLabel = formatFinanceWindow(range.start, range.end)
  const subtitle =
    layout === 'fy'
      ? `${range.end.slice(0, 4)} by month`
      : layout === 'compare'
        ? `${periods[0]?.label} – ${periods[periods.length - 1]?.label}`
        : comparing
          ? `${windowLabel} vs ${formatFinanceWindow(compareRange.start, compareRange.end)}`
          : windowLabel
  const fileBase = `hakum-profit-and-loss-${layout || 'statement'}-${range.start}-to-${range.end}`

  function exportAs(kind) {
    const rows = grid ? pivotExportRows(grid.pivot, grid.headings) : statementExport
    const columns = grid
      ? [{ key: 'section', label: 'Section' }, { key: 'account', label: 'Account' }, ...grid.headings.map((h) => ({ key: h, label: h })), { key: 'total', label: 'Total' }]
      : [
          { key: 'section', label: 'Section' },
          { key: 'category', label: 'Account' },
          { key: 'amount', label: comparing ? 'This period' : 'Amount' },
          ...(comparing ? [{ key: 'compare', label: 'Compare' }, { key: 'change', label: 'Change' }] : []),
        ]
    if (kind === 'csv') downloadCsv(rows, columns, `${fileBase}.csv`)
    else if (kind === 'xls') downloadExcel(rows, columns, `${fileBase}.xls`, 'Profit and loss')
    else printAsPdf(rows, columns, 'Hakum · Profit and loss', subtitle)
  }

  if (loading) return <FinanceTabSkeleton metrics={4} />

  const colSpan = comparing ? 4 : 2
  const emptyBooks = pl.income === 0 && pl.expenses === 0

  return (
    <div className="finance-dash flex flex-col gap-5">
      <p className="text-xs text-muted-foreground" data-testid="finance-pl-provenance">
        Income is paid POS sales, split by service family; the discounts row keeps it equal to what customers paid.
        Expenses are paid or posted bills and approved daily sheets · view{' '}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]">finance_daily_pl</code>.
      </p>
      <FinanceMetricStrip label="P&L totals">
        <FinanceMetricCell label="Income" value={formatMoney(pl.income)} hint="POS paid" tone="ink" />
        <FinanceMetricCell label="Expenses" value={formatMoney(pl.expenses)} hint="Paid + posted" tone="muted" />
        <FinanceMetricCell
          label={pl.net >= 0 ? 'Net profit' : 'Net loss'}
          value={formatMoney(pl.net)}
          hint={comparing ? `Prior ${formatMoney(prior.net)}` : 'Income − expenses'}
          tone={pl.net >= 0 ? 'up' : 'down'}
        />
        <FinanceMetricCell label="Margin" value={`${pl.margin}%`} hint={comparing ? `Prior ${prior.margin}%` : 'Net ÷ income'} tone="ink" />
      </FinanceMetricStrip>

      <div className="finance-toolbar flex-wrap">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="P&L layout">
          {PL_LAYOUTS.map((l) => (
            <Button
              key={l.id || 'statement'}
              type="button"
              size="sm"
              variant={layout === l.id ? 'default' : 'outline'}
              className="min-h-11 cursor-pointer"
              aria-pressed={layout === l.id}
              onClick={() => onLayout?.({ by: l.id === 'compare' ? unit : l.id, n: l.id === 'compare' ? String(count) : '' })}
            >
              {l.label}
            </Button>
          ))}
          {layout === 'compare' ? (
            <>
              <label className="sr-only" htmlFor="pl-count">
                Previous periods
              </label>
              <select id="pl-count" className="finance-toolbar-select min-h-11" value={count} onChange={(e) => onLayout?.({ by: unit, n: e.target.value })}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((v) => (
                  <option key={v} value={v}>
                    {v} previous
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="pl-unit">
                Period
              </label>
              <select id="pl-unit" className="finance-toolbar-select min-h-11" value={unit} onChange={(e) => onLayout?.({ by: e.target.value, n: String(count) })}>
                {PERIOD_UNITS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </>
          ) : null}
        </div>
        <div className="finance-toolbar-actions">
          <Button type="button" variant="outline" className="min-h-11 cursor-pointer" onClick={() => exportAs('csv')}>
            <Download data-icon="inline-start" />
            CSV
          </Button>
          <Button type="button" variant="outline" className="min-h-11 cursor-pointer" onClick={() => exportAs('xls')}>
            <FileSpreadsheet data-icon="inline-start" />
            Excel
          </Button>
          <Button type="button" variant="outline" className="min-h-11 cursor-pointer" onClick={() => exportAs('pdf')}>
            <Printer data-icon="inline-start" />
            PDF
          </Button>
        </div>
      </div>

      {grid ? (
        <FinancePanel title="Profit and loss" description={`${subtitle} · ${layout === 'branches' ? 'one column per branch' : 'calendar periods ending with the filter end date'}`}>
          {span.loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground" role="status">
              Loading columns…
            </p>
          ) : span.error ? (
            <p className="text-sm text-destructive" role="alert">
              {span.error}
            </p>
          ) : grid.pivot.income.length || grid.pivot.expense.length ? (
            <PivotTable headings={grid.headings} pivot={grid.pivot} />
          ) : (
            <FinanceEmpty title="No income or expenses in these columns" body="Pick a later end date in the filter bar, or another layout." />
          )}
        </FinancePanel>
      ) : (
        <div className="finance-dash-split">
          <FinancePanel title="Profit and loss" description={subtitle}>
            {emptyBooks ? (
              <FinanceEmpty title="No income or expenses in this window" body="Paid POS sales and paid/posted bills build this statement." />
            ) : (
              <table className="finance-pl-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th className="text-right">This period</th>
                    {comparing ? <th className="text-right">Compare</th> : null}
                    {comparing ? <th className="text-right">Change</th> : null}
                  </tr>
                </thead>
                <tbody>
                  <StatementSection title="Trading income" rows={incomeRows} comparing={comparing} colSpan={colSpan} empty="No income in this window." />
                  <TotalRow label="Total trading income" current={pl.income} prior={prior.income} comparing={comparing} />
                  <StatementSection title="Operating expenses" rows={expenseRows} comparing={comparing} colSpan={colSpan} empty="No expenses in this window." />
                  <TotalRow label="Total operating expenses" current={pl.expenses} prior={prior.expenses} comparing={comparing} />
                  <TotalRow
                    label={pl.net >= 0 ? 'Net profit' : 'Net loss'}
                    current={pl.net}
                    prior={prior.net}
                    comparing={comparing}
                    className={`finance-pl-net ${pl.net >= 0 ? 'is-positive' : 'is-negative'}`}
                  />
                  <tr className="finance-pl-margin">
                    <td>Net margin</td>
                    <td className="text-right tabular-nums">
                      <Badge variant={pl.margin >= 0 ? 'default' : 'destructive'}>{pl.margin}%</Badge>
                    </td>
                    {comparing ? (
                      <td className="text-right tabular-nums">
                        <Badge variant="secondary">{prior.margin}%</Badge>
                      </td>
                    ) : null}
                    {comparing ? <td /> : null}
                  </tr>
                </tbody>
              </table>
            )}
          </FinancePanel>

          <FinancePanel title="Top expenses" description="Accounts in this window">
            {expenseBars.length > 0 ? (
              <div className="finance-chart-mid">
                <ChartContainer config={expenseConfig} className="h-full w-full aspect-auto">
                  <BarChart accessibilityLayer data={expenseBars} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => `₱${Number(v) >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                    <YAxis type="category" dataKey="category" width={96} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent formatter={(value) => <span className="tabular-nums font-medium">{formatMoney(Math.round(Number(value) * 100))}</span>} />
                      }
                    />
                    <Bar dataKey="amount" fill="var(--color-amount)" radius={[0, 2, 2, 0]} maxBarSize={22} />
                  </BarChart>
                </ChartContainer>
              </div>
            ) : (
              <FinanceEmpty title="No posted expenses" body="Paid and posted bills appear here by account." />
            )}
          </FinancePanel>
        </div>
      )}
    </div>
  )
}

function StatementSection({ title, rows, comparing, colSpan, empty }) {
  return (
    <>
      <tr className="finance-pl-section">
        <th colSpan={colSpan}>{title}</th>
      </tr>
      {rows.length === 0 ? (
        <tr>
          <td>{empty}</td>
          <td className="text-right">—</td>
          {comparing ? <td className="text-right">—</td> : null}
          {comparing ? <td className="text-right">—</td> : null}
        </tr>
      ) : (
        rows.map((r) => (
          <tr key={`${title}-${r.category}`}>
            <td>{r.category}</td>
            <td className="text-right tabular-nums">{formatAccounting(r.current)}</td>
            {comparing ? <td className="text-right tabular-nums">{formatAccounting(r.prior)}</td> : null}
            {comparing ? <td className="text-right tabular-nums">{formatDelta(r.delta, r.deltaPct)}</td> : null}
          </tr>
        ))
      )}
    </>
  )
}

function TotalRow({ label, current, prior, comparing, className = 'finance-pl-subtotal' }) {
  return (
    <tr className={className}>
      <td>{label}</td>
      <td className="text-right tabular-nums">{formatAccounting(current)}</td>
      {comparing ? <td className="text-right tabular-nums">{formatAccounting(prior)}</td> : null}
      {comparing ? <td className="text-right tabular-nums">{formatDelta(current - prior)}</td> : null}
    </tr>
  )
}

function formatDelta(deltaMinor, pct) {
  const sign = deltaMinor > 0 ? '+' : ''
  const money = `${sign}${formatMoney(deltaMinor)}`
  return pct == null ? money : `${money} (${sign}${pct}%)`
}
