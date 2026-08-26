/** Finance Profit and Loss — statement + metrics, shared chrome. */
import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { formatMoney } from '@/queue/queueApi'
import {
  COMPARE_PRESETS,
  downloadCsv,
  downloadExcel,
  formatFinanceWindow,
  mergePlByCategory,
  printAsPdf,
  rollupPl,
  topExpenseCategories,
} from '@/lib/financeData'
import {
  FinanceEmpty,
  FinanceMetricCell,
  FinanceMetricStrip,
  FinancePanel,
  FinanceTabSkeleton,
} from './FinanceChrome'

const expenseConfig = {
  amount: { label: 'Spend', color: '#b91c1c' },
}

export default function FinancePLTab({
  plRows,
  priorPlRows = [],
  range,
  compareRange,
  comparePreset = 'none',
  onCompareChange,
  loading,
}) {
  const pl = useMemo(() => rollupPl(plRows), [plRows])
  const prior = useMemo(() => rollupPl(priorPlRows), [priorPlRows])
  const comparing = Boolean(compareRange)
  const merged = useMemo(
    () => mergePlByCategory(plRows, comparing ? priorPlRows : []),
    [plRows, priorPlRows, comparing],
  )
  const incomeRows = merged.filter((r) => r.kind === 'income')
  const expenseRows = merged.filter((r) => r.kind === 'expense')
  const expenseBars = useMemo(() => topExpenseCategories(plRows, 6), [plRows])

  const exportRows = useMemo(() => {
    return [
      ...incomeRows.map((r) => ({
        section: 'Trading income',
        kind: 'income',
        category: r.category,
        amount: formatMoney(r.current),
        compare: comparing ? formatMoney(r.prior) : '',
        change: comparing ? `${r.deltaPct}%` : '',
      })),
      {
        section: 'Trading income',
        kind: 'income',
        category: 'Total trading income',
        amount: formatMoney(pl.income),
        compare: comparing ? formatMoney(prior.income) : '',
        change: '',
      },
      ...expenseRows.map((r) => ({
        section: 'Operating expenses',
        kind: 'expense',
        category: r.category,
        amount: formatMoney(r.current),
        compare: comparing ? formatMoney(r.prior) : '',
        change: comparing ? `${r.deltaPct}%` : '',
      })),
      {
        section: 'Operating expenses',
        kind: 'expense',
        category: 'Total operating expenses',
        amount: formatMoney(pl.expenses),
        compare: comparing ? formatMoney(prior.expenses) : '',
        change: '',
      },
      {
        section: 'Bottom line',
        kind: 'net',
        category: pl.net >= 0 ? 'Net profit' : 'Net loss',
        amount: formatMoney(pl.net),
        compare: comparing ? formatMoney(prior.net) : '',
        change: '',
      },
    ]
  }, [incomeRows, expenseRows, pl, prior, comparing])

  const exportColumns = comparing
    ? [
        { key: 'section', label: 'Section' },
        { key: 'kind', label: 'Kind' },
        { key: 'category', label: 'Category' },
        { key: 'amount', label: 'This period' },
        { key: 'compare', label: 'Compare' },
        { key: 'change', label: 'Change' },
      ]
    : [
        { key: 'section', label: 'Section' },
        { key: 'kind', label: 'Kind' },
        { key: 'category', label: 'Category' },
        { key: 'amount', label: 'Amount' },
      ]

  const windowLabel = formatFinanceWindow(range.start, range.end)
  const subtitle = comparing
    ? `${windowLabel} vs ${formatFinanceWindow(compareRange.start, compareRange.end)}`
    : windowLabel
  const fileBase = `hakum-profit-and-loss-${range.start}-to-${range.end}`
  const colSpan = comparing ? 4 : 2
  const emptyBooks = pl.income === 0 && pl.expenses === 0

  if (loading) return <FinanceTabSkeleton metrics={4} />

  return (
    <div className="finance-dash flex flex-col gap-5">
      <FinanceMetricStrip label="P&L totals">
        <FinanceMetricCell label="Income" value={formatMoney(pl.income)} hint="POS paid" tone="ink" />
        <FinanceMetricCell label="Expenses" value={formatMoney(pl.expenses)} hint="Paid + posted" tone="muted" />
        <FinanceMetricCell
          label={pl.net >= 0 ? 'Net profit' : 'Net loss'}
          value={formatMoney(pl.net)}
          hint={comparing ? `Prior ${formatMoney(prior.net)}` : 'Income − expenses'}
          tone={pl.net >= 0 ? 'up' : 'down'}
        />
        <FinanceMetricCell
          label="Margin"
          value={`${pl.margin}%`}
          hint={comparing ? `Prior ${prior.margin}%` : 'Net ÷ income'}
          tone="ink"
        />
      </FinanceMetricStrip>

      <div className="finance-toolbar">
        <p className="text-sm text-muted-foreground max-w-xl">
          Income is paid POS sales. Expenses are paid or posted bills. Use Compare in the filter bar or here.
        </p>
        <div className="finance-toolbar-actions">
          <div className="finance-filter-group">
            <Label htmlFor="pl-compare">Compare with</Label>
            <select
              id="pl-compare"
              className="finance-toolbar-select min-h-10"
              value={comparePreset}
              onChange={(e) => onCompareChange?.(e.target.value)}
            >
              {COMPARE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-10 cursor-pointer"
            onClick={() => downloadCsv(exportRows, exportColumns, `${fileBase}.csv`)}
          >
            <Download data-icon="inline-start" />
            CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-10 cursor-pointer"
            onClick={() => downloadExcel(exportRows, exportColumns, `${fileBase}.xls`, 'Hakum Profit and Loss')}
          >
            <FileSpreadsheet data-icon="inline-start" />
            Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-10 cursor-pointer"
            onClick={() => printAsPdf(exportRows, exportColumns, 'Hakum Profit and Loss', subtitle)}
          >
            <FileText data-icon="inline-start" />
            PDF
          </Button>
        </div>
      </div>

      <div className="finance-dash-split">
        <FinancePanel title="Profit and loss" description={subtitle}>
          {emptyBooks ? (
            <FinanceEmpty
              title="No income or expenses in this window"
              body="Paid POS sales and paid/posted bills build this statement."
            />
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
                <tr className="finance-pl-section">
                  <th colSpan={colSpan}>Trading income</th>
                </tr>
                {incomeRows.length === 0 ? (
                  <tr>
                    <td>No income in this window.</td>
                    <td className="text-right">—</td>
                    {comparing ? <td className="text-right">—</td> : null}
                    {comparing ? <td className="text-right">—</td> : null}
                  </tr>
                ) : (
                  incomeRows.map((r) => (
                    <tr key={`inc-${r.category}`}>
                      <td>{r.category}</td>
                      <td className="text-right tabular-nums">{formatMoney(r.current)}</td>
                      {comparing ? <td className="text-right tabular-nums">{formatMoney(r.prior)}</td> : null}
                      {comparing ? (
                        <td className="text-right tabular-nums">{formatDelta(r.delta, r.deltaPct)}</td>
                      ) : null}
                    </tr>
                  ))
                )}
                <tr className="finance-pl-subtotal">
                  <td>Total trading income</td>
                  <td className="text-right tabular-nums">{formatMoney(pl.income)}</td>
                  {comparing ? <td className="text-right tabular-nums">{formatMoney(prior.income)}</td> : null}
                  {comparing ? (
                    <td className="text-right tabular-nums">{formatDelta(pl.income - prior.income)}</td>
                  ) : null}
                </tr>
                <tr className="finance-pl-section">
                  <th colSpan={colSpan}>Operating expenses</th>
                </tr>
                {expenseRows.length === 0 ? (
                  <tr>
                    <td>No expenses in this window.</td>
                    <td className="text-right">—</td>
                    {comparing ? <td className="text-right">—</td> : null}
                    {comparing ? <td className="text-right">—</td> : null}
                  </tr>
                ) : (
                  expenseRows.map((r) => (
                    <tr key={`exp-${r.category}`}>
                      <td>{r.category}</td>
                      <td className="text-right tabular-nums">{formatMoney(r.current)}</td>
                      {comparing ? <td className="text-right tabular-nums">{formatMoney(r.prior)}</td> : null}
                      {comparing ? (
                        <td className="text-right tabular-nums">{formatDelta(r.delta, r.deltaPct)}</td>
                      ) : null}
                    </tr>
                  ))
                )}
                <tr className="finance-pl-subtotal">
                  <td>Total operating expenses</td>
                  <td className="text-right tabular-nums">{formatMoney(pl.expenses)}</td>
                  {comparing ? <td className="text-right tabular-nums">{formatMoney(prior.expenses)}</td> : null}
                  {comparing ? (
                    <td className="text-right tabular-nums">{formatDelta(pl.expenses - prior.expenses)}</td>
                  ) : null}
                </tr>
                <tr className={`finance-pl-net ${pl.net >= 0 ? 'is-positive' : 'is-negative'}`}>
                  <td>{pl.net >= 0 ? 'Net profit' : 'Net loss'}</td>
                  <td className="text-right tabular-nums">{formatMoney(pl.net)}</td>
                  {comparing ? <td className="text-right tabular-nums">{formatMoney(prior.net)}</td> : null}
                  {comparing ? (
                    <td className="text-right tabular-nums">{formatDelta(pl.net - prior.net)}</td>
                  ) : null}
                </tr>
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

        <FinancePanel title="Top expenses" description="Categories in this window">
          {expenseBars.length > 0 ? (
            <div className="finance-chart-mid">
              <ChartContainer config={expenseConfig} className="h-full w-full aspect-auto">
                <BarChart
                  accessibilityLayer
                  data={expenseBars}
                  layout="vertical"
                  margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `₱${Number(v) >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={96}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => (
                          <span className="tabular-nums font-medium">
                            {formatMoney(Math.round(Number(value) * 100))}
                          </span>
                        )}
                      />
                    }
                  />
                  <Bar dataKey="amount" fill="var(--color-amount)" radius={[0, 2, 2, 0]} maxBarSize={22} />
                </BarChart>
              </ChartContainer>
            </div>
          ) : (
            <FinanceEmpty title="No posted expenses" body="Paid and posted bills appear here by category." />
          )}
        </FinancePanel>
      </div>
    </div>
  )
}

function formatDelta(deltaMinor, pct) {
  const sign = deltaMinor > 0 ? '+' : ''
  const money = `${sign}${formatMoney(deltaMinor)}`
  return pct == null ? money : `${money} (${sign}${pct}%)`
}
