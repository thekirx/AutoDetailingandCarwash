/** Finance Dashboard — owner cash-flow view.
 * Dense metric strip + trend/composition charts (shadcn Chart + Recharts).
 * Real POS + P&L only — empty windows stay empty, with cues to act. */
import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowRight, Download, FileBarChart, FileSpreadsheet, FileText, Receipt, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { formatMoney } from '@/queue/queueApi'
import {
  downloadCsv,
  downloadExcel,
  financeOwnerInsights,
  formatFinanceWindow,
  pctChange,
  plTrendByDay,
  printAsPdf,
  rollupPl,
  salesByBranch,
  shareOfTotal,
  sumMinor,
  topExpenseCategories,
} from '@/lib/financeData'
import {
  FinanceEmpty,
  FinanceMetricCell,
  FinanceMetricStrip,
  FinancePanel,
  FinanceTabSkeleton,
} from './FinanceChrome'

const pesoTick = (v) => {
  const n = Number(v) || 0
  if (Math.abs(n) >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `₱${(n / 1_000).toFixed(0)}k`
  return `₱${n.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`
}

const shortDate = (ymd) => {
  const [y, m, d] = String(ymd || '').split('-')
  if (!y || !m || !d) return ymd || ''
  return `${Number(d)}/${Number(m)}`
}

const cashflowConfig = {
  income: { label: 'Income', color: '#052699' },
  expenses: { label: 'Expenses', color: '#64748b' },
  net: { label: 'Net', color: '#0f766e' },
}

const branchConfig = {
  sales: { label: 'Sales', color: '#052699' },
}

const paymentConfig = {
  cash: { label: 'Cash', color: '#020a31' },
  gcash: { label: 'GCash', color: '#0ea5e9' },
  card: { label: 'Card', color: '#94a3b8' },
}

const expenseConfig = {
  amount: { label: 'Spend', color: '#b91c1c' },
}

export default function FinanceOverviewTab({
  plRows,
  priorPlRows = [],
  salesRows,
  branchOptions,
  range,
  compareRange = null,
  loading,
  onNavigate,
}) {
  const pl = useMemo(() => rollupPl(plRows), [plRows])
  const prior = useMemo(() => rollupPl(priorPlRows), [priorPlRows])
  const comparing = Boolean(compareRange)
  const byBranch = useMemo(() => salesByBranch(salesRows), [salesRows])
  const trend = useMemo(() => plTrendByDay(plRows), [plRows])
  const expenseBars = useMemo(() => topExpenseCategories(plRows, 6), [plRows])
  const insights = useMemo(() => financeOwnerInsights(salesRows, plRows), [salesRows, plRows])

  const branchChart = useMemo(
    () =>
      byBranch.map((b) => ({
        branch: branchOptions.find((x) => x.slug === b.branch)?.name || b.branch,
        sales: b.total_sales_minor / 100,
        sales_minor: b.total_sales_minor,
        paid_count: b.paid_count,
      })),
    [byBranch, branchOptions],
  )

  const paymentStack = useMemo(() => {
    const cash = sumMinor(salesRows, 'cash_sales_minor')
    const gcash = sumMinor(salesRows, 'gcash_sales_minor')
    const card = sumMinor(salesRows, 'card_sales_minor')
    const total = cash + gcash + card
    if (total <= 0) return []
    return [
      {
        label: 'Mix',
        cash: cash / 100,
        gcash: gcash / 100,
        card: card / 100,
        cash_minor: cash,
        gcash_minor: gcash,
        card_minor: card,
      },
    ]
  }, [salesRows])

  const paymentRows = useMemo(() => {
    const cash = sumMinor(salesRows, 'cash_sales_minor')
    const gcash = sumMinor(salesRows, 'gcash_sales_minor')
    const card = sumMinor(salesRows, 'card_sales_minor')
    const total = cash + gcash + card
    return [
      { name: 'Cash', minor: cash, color: paymentConfig.cash.color },
      { name: 'GCash', minor: gcash, color: paymentConfig.gcash.color },
      { name: 'Card', minor: card, color: paymentConfig.card.color },
    ]
      .filter((r) => r.minor > 0)
      .map((r) => ({ ...r, ...shareOfTotal(r.minor, total) }))
  }, [salesRows])

  const recentSales = useMemo(() => {
    return [...(salesRows || [])]
      .sort((a, b) => (a.sale_date < b.sale_date ? 1 : -1))
      .slice(0, 6)
  }, [salesRows])

  const incomeDelta = comparing ? pctChange(pl.income, prior.income) : null
  const expenseDelta = comparing ? pctChange(pl.expenses, prior.expenses) : null
  const netDelta = comparing ? pctChange(pl.net, prior.net) : null
  const windowLabel = formatFinanceWindow(range?.start, range?.end)

  const overviewExportRows = useMemo(
    () => [
      { metric: 'Income', amount: formatMoney(pl.income) },
      { metric: 'Expenses', amount: formatMoney(pl.expenses) },
      { metric: 'Net profit', amount: formatMoney(pl.net) },
      { metric: 'Margin %', amount: `${pl.margin}%` },
      { metric: 'Paid tickets', amount: String(insights.paidCount) },
      ...byBranch.map((b) => ({
        metric: `Sales · ${b.branch}`,
        amount: formatMoney(b.total_sales_minor),
      })),
      ...expenseBars.map((e) => ({
        metric: `Expense · ${e.category}`,
        amount: formatMoney(e.amount_minor),
      })),
    ],
    [pl, insights.paidCount, byBranch, expenseBars],
  )
  const exportCols = [
    { key: 'metric', label: 'Metric' },
    { key: 'amount', label: 'Amount' },
  ]
  function exportOverview(kind) {
    const title = `Finance overview · ${windowLabel}`
    const file = `finance-overview-${range.start}_${range.end}`
    if (kind === 'csv') downloadCsv(overviewExportRows, exportCols, `${file}.csv`)
    else if (kind === 'excel') downloadExcel(overviewExportRows, exportCols, `${file}.xls`, title)
    else printAsPdf(overviewExportRows, exportCols, title, windowLabel)
  }

  if (loading) return <FinanceTabSkeleton metrics={6} lines={4} />

  const hasCashflow = trend.some((d) => d.income_minor > 0 || d.expenses_minor > 0)

  return (
    <div className="finance-dash flex flex-col gap-5">
      <FinanceMetricStrip label="Business totals">
        <FinanceMetricCell
          label="Income"
          value={formatMoney(pl.income)}
          hint={
            comparing && incomeDelta != null
              ? `${incomeDelta > 0 ? '+' : ''}${incomeDelta}% vs compare`
              : 'POS paid'
          }
          tone="ink"
        />
        <FinanceMetricCell
          label="Expenses"
          value={formatMoney(pl.expenses)}
          hint={
            comparing && expenseDelta != null
              ? `${expenseDelta > 0 ? '+' : ''}${expenseDelta}% vs compare`
              : 'Paid + posted'
          }
          tone="muted"
        />
        <FinanceMetricCell
          label={pl.net >= 0 ? 'Net profit' : 'Net loss'}
          value={formatMoney(pl.net)}
          hint={
            comparing && netDelta != null
              ? `${netDelta > 0 ? '+' : ''}${netDelta}% vs compare`
              : `${pl.margin}% margin`
          }
          tone={pl.net >= 0 ? 'up' : 'down'}
        />
        <FinanceMetricCell label="Margin" value={`${pl.margin}%`} hint="Net ÷ income" tone="ink" />
        <FinanceMetricCell
          label="Paid tickets"
          value={insights.paidCount.toLocaleString('en-PH')}
          hint={byBranch.length ? `${byBranch.length} branch${byBranch.length === 1 ? '' : 'es'}` : 'No sales days'}
          tone="ink"
        />
        <FinanceMetricCell
          label="Avg ticket"
          value={insights.avgTicketMinor ? formatMoney(insights.avgTicketMinor) : '—'}
          hint={insights.cashShare ? `${insights.cashShare}% cash` : 'Per paid sale'}
          tone="ink"
        />
      </FinanceMetricStrip>

      {comparing && compareRange ? (
        <p className="finance-compare-note">
          Comparing to {formatFinanceWindow(compareRange.start, compareRange.end)}
        </p>
      ) : null}

      {onNavigate ? (
        <nav className="finance-dash-links" aria-label="Finance modules">
          <DashLink label="Sales" onClick={() => onNavigate('sales')} icon={<ShoppingCart aria-hidden />} />
          <DashLink label="Bills & expenses" onClick={() => onNavigate('purchases')} icon={<Receipt aria-hidden />} />
          <DashLink label="Profit and loss" onClick={() => onNavigate('pl')} icon={<FileBarChart aria-hidden />} />
        </nav>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Export overview</span>
        <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => exportOverview('csv')}>
          <Download data-icon="inline-start" />
          CSV
        </Button>
        <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => exportOverview('excel')}>
          <FileSpreadsheet data-icon="inline-start" />
          Excel
        </Button>
        <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => exportOverview('pdf')}>
          <FileText data-icon="inline-start" />
          PDF
        </Button>
      </div>

      <FinancePanel
        title="Cash flow"
        description={`Income, expenses, and net by day · ${windowLabel}`}
        actions={
          hasCashflow ? (
            <Badge variant="secondary" className="tabular-nums">
              {trend.length} day{trend.length === 1 ? '' : 's'}
            </Badge>
          ) : null
        }
        bodyClassName="finance-chart-tall"
      >
        {hasCashflow ? (
          <ChartContainer config={cashflowConfig} className="h-full w-full aspect-auto">
            <AreaChart accessibilityLayer data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={28}
                tickFormatter={shortDate}
              />
              <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={pesoTick} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={(v) => String(v)}
                    formatter={(value, name) => (
                      <span className="tabular-nums font-medium">
                        {formatMoney(Math.round(Number(value) * 100))}
                        <span className="text-muted-foreground font-normal"> · {cashflowConfig[name]?.label || name}</span>
                      </span>
                    )}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                type="monotone"
                dataKey="income"
                stroke="var(--color-income)"
                fill="var(--color-income)"
                fillOpacity={0.12}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="var(--color-expenses)"
                fill="var(--color-expenses)"
                fillOpacity={0.1}
                strokeWidth={2}
                strokeDasharray="4 3"
              />
              <Area
                type="monotone"
                dataKey="net"
                stroke="var(--color-net)"
                fill="var(--color-net)"
                fillOpacity={0.08}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <FinanceEmpty
            title="No cash-flow points yet"
            body="Paid POS sales and paid/posted expenses appear here by Manila day. Close a shift or post a bill, then refresh."
            action={onNavigate ? { label: 'Open Sales', onClick: () => onNavigate('sales') } : null}
          />
        )}
      </FinancePanel>

      <div className="finance-dash-split">
        <FinancePanel title="Revenue by branch" description="POS paid sales in the window" bodyClassName="finance-chart-mid">
          {branchChart.length > 0 ? (
            <ChartContainer config={branchConfig} className="h-full w-full aspect-auto">
              <BarChart
                accessibilityLayer
                data={branchChart}
                layout="vertical"
                margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={pesoTick} />
                <YAxis
                  type="category"
                  dataKey="branch"
                  width={88}
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
                <Bar dataKey="sales" fill="var(--color-sales)" radius={[0, 2, 2, 0]} maxBarSize={28} />
              </BarChart>
            </ChartContainer>
          ) : (
            <FinanceEmpty title="No branch sales" body="Paid tickets in this window will rank branches here." />
          )}
        </FinancePanel>

        <FinancePanel title="Payment mix" description="Cash · GCash · Card" bodyClassName="finance-chart-mid">
          {paymentStack.length > 0 ? (
            <div className="flex h-full flex-col gap-4">
              <ChartContainer config={paymentConfig} className="min-h-[88px] w-full aspect-auto flex-none">
                <BarChart
                  accessibilityLayer
                  data={paymentStack}
                  layout="vertical"
                  margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                  stackOffset="expand"
                >
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="label" hide />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <span className="tabular-nums font-medium">
                            {formatMoney(Math.round(Number(value) * 100))}
                            <span className="text-muted-foreground font-normal">
                              {' '}
                              · {paymentConfig[name]?.label || name}
                            </span>
                          </span>
                        )}
                      />
                    }
                  />
                  <Bar dataKey="cash" stackId="a" fill="var(--color-cash)" />
                  <Bar dataKey="gcash" stackId="a" fill="var(--color-gcash)" />
                  <Bar dataKey="card" stackId="a" fill="var(--color-card)" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ChartContainer>
              <ul className="finance-mix-legend">
                {paymentRows.map((r) => (
                  <li key={r.name}>
                    <span className="finance-mix-swatch" style={{ background: r.color }} aria-hidden />
                    <span>{r.name}</span>
                    <span className="tabular-nums text-muted-foreground">{r.percent}%</span>
                    <span className="tabular-nums font-medium">{formatMoney(r.minor)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <FinanceEmpty
              title="No payments recorded"
              body="Paid sale methods show as a share bar with pesos beside each method."
            />
          )}
        </FinancePanel>
      </div>

      <div className="finance-dash-split">
        <FinancePanel
          title="Where spend goes"
          description="Top expense categories"
          actions={
            onNavigate ? (
              <Button type="button" variant="ghost" size="sm" className="cursor-pointer" onClick={() => onNavigate('pl')}>
                Full P&amp;L
                <ArrowRight data-icon="inline-end" />
              </Button>
            ) : null
          }
          bodyClassName="finance-chart-mid"
        >
          {expenseBars.length > 0 ? (
            <ChartContainer config={expenseConfig} className="h-full w-full aspect-auto">
              <BarChart
                accessibilityLayer
                data={expenseBars}
                layout="vertical"
                margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={pesoTick} />
                <YAxis
                  type="category"
                  dataKey="category"
                  width={100}
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
                <Bar dataKey="amount" fill="var(--color-amount)" radius={[0, 2, 2, 0]} maxBarSize={24} />
              </BarChart>
            </ChartContainer>
          ) : (
            <FinanceEmpty
              title="No posted expenses"
              body="Paid and posted bills land here by category."
              action={onNavigate ? { label: 'Open bills', onClick: () => onNavigate('purchases') } : null}
            />
          )}
        </FinancePanel>

        <FinancePanel title="Owner watchlist" description="What to check before the next ops call">
          <ul className="finance-cue-list">
            {insights.cues.map((cue) => (
              <li key={cue.text} data-tone={cue.tone}>
                {cue.text}
              </li>
            ))}
          </ul>
          {insights.expenseRatio != null ? (
            <p className="finance-cue-foot tabular-nums">
              Expense ratio {insights.expenseRatio}%
              {insights.busiestDay ? ` · Peak day ${insights.busiestDay}` : ''}
            </p>
          ) : null}
        </FinancePanel>
      </div>

      <FinancePanel title="Recent POS days" description="Latest sales days in the window">
        {recentSales.length === 0 ? (
          <FinanceEmpty title="No sales days" body="Paid POS days in this window will list here." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentSales.map((row) => {
                const name = branchOptions.find((x) => x.slug === row.branch)?.name || row.branch
                return (
                  <TableRow key={`${row.branch}-${row.sale_date}`}>
                    <TableCell className="tabular-nums">{row.sale_date}</TableCell>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(row.total_sales_minor)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.paid_count}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </FinancePanel>
    </div>
  )
}

function DashLink({ label, onClick, icon }) {
  return (
    <Button type="button" variant="outline" size="sm" className="finance-dash-link min-h-10 cursor-pointer" onClick={onClick}>
      {icon}
      {label}
      <ArrowRight data-icon="inline-end" />
    </Button>
  )
}
