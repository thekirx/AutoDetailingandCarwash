/** Square-style Sales summary for Finance › Sales: period switch, six headline numbers vs the prior period,
 * performance by hour, locations, service families and payment methods. */
import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAccounting, hourlyNetSales, summarizeSheetSales } from '@/lib/dailySheet'
import { rollupLineKinds } from '@/lib/financeData'
import { laborMinor, paymentTypes, rollupSales, salesByLocation, vsPrior } from '@/lib/salesSummary'
import { FinanceEmpty, FinanceMetricCell, FinanceMetricStrip, FinancePanel } from './FinanceChrome'
import { DeltaChip, PaymentTypesList, SalesLocationsTable, SalesPeriodBar } from './FinanceSalesBlocks'

const hourConfig = {
  today: { label: 'This period', color: '#052699' },
  prior: { label: 'Comparison', color: '#c4c4bc' },
}

export default function FinanceSalesSummary({
  saleRows = [],
  priorSaleRows = [],
  salesWindow = null,
  period,
  onPeriodChange,
  branchName,
  branchOptions = [],
  kindRows = [],
  expenses = [],
  categories = [],
}) {
  // Same definitions as the Daily Sheet and POS Today: net = paid totals, average = net ÷ paid sales.
  const cur = useMemo(() => summarizeSheetSales(saleRows), [saleRows])
  const prev = useMemo(() => summarizeSheetSales(priorSaleRows), [priorSaleRows])
  const hourly = useMemo(() => hourlyNetSales(saleRows, priorSaleRows).filter((r) => r.hour >= 6 && r.hour <= 22), [saleRows, priorSaleRows])
  const locations = useMemo(() => {
    const byBranch = {}
    for (const r of saleRows) byBranch[r.branch] ??= laborMinor(expenses, categories, r.branch)
    return salesByLocation(saleRows, priorSaleRows, byBranch)
  }, [saleRows, priorSaleRows, expenses, categories])
  const byKind = useMemo(() => rollupLineKinds(kindRows).filter((r) => r.amount_minor > 0), [kindRows])
  const pay = useMemo(() => rollupSales(saleRows), [saleRows])
  const payTypes = useMemo(() => paymentTypes(pay), [pay])
  const compareLabel = salesWindow?.compare?.label || 'prior period'

  return (
    <div className="flex flex-col gap-5">
      <SalesPeriodBar period={period} onPeriodChange={onPeriodChange} salesWindow={salesWindow} branchName={branchName} />
      <FinanceMetricStrip label="Sales summary">
        <FinanceMetricCell label="Gross sales" value={formatAccounting(cur.grossMinor)} hint={<DeltaChip pct={vsPrior(cur.grossMinor, prev.grossMinor)} />} />
        <FinanceMetricCell label="Sales count" value={cur.count.toLocaleString('en-PH')} hint={<DeltaChip pct={vsPrior(cur.count, prev.count)} />} />
        <FinanceMetricCell label="Average sale" value={formatAccounting(cur.avgMinor)} hint={<DeltaChip pct={vsPrior(cur.avgMinor, prev.avgMinor)} />} />
        <FinanceMetricCell label="Net sales" value={formatAccounting(cur.netMinor)} hint={<DeltaChip pct={vsPrior(cur.netMinor, prev.netMinor)} />} />
        <FinanceMetricCell label="Refunds" value={formatAccounting(-cur.refundsMinor)} hint={<DeltaChip pct={vsPrior(cur.refundsMinor, prev.refundsMinor)} />} tone="muted" />
        <FinanceMetricCell label="Discounts" value={formatAccounting(-cur.discountsMinor)} hint={<DeltaChip pct={vsPrior(cur.discountsMinor, prev.discountsMinor)} />} tone="muted" />
      </FinanceMetricStrip>

      <FinancePanel title="Performance by hour" description={`Net sales per hour (Manila) · this period vs ${compareLabel}`}>
        {hourly.some((r) => r.today || r.prior) ? (
          <div className="h-60">
            <ChartContainer config={hourConfig} className="aspect-auto h-full w-full">
              <BarChart accessibilityLayer data={hourly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} />
                <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v) => `₱${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v, name) => `${hourConfig[name]?.label || name}: ${formatAccounting(Math.round(Number(v) * 100))}`} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="prior" fill="var(--color-prior)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="today" fill="var(--color-today)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        ) : (
          <FinanceEmpty title="No paid sales in this period" body="Pick another period or branch above." />
        )}
      </FinancePanel>

      <FinancePanel title="Locations" description="Net sales, transactions and labor by branch vs the prior period">
        <SalesLocationsTable rows={locations} branchOptions={branchOptions} />
      </FinancePanel>

      <div className="grid gap-5 lg:grid-cols-2">
        <FinancePanel title="By service family" description="Paid sale lines in the date filter">
          {byKind.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Family</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byKind.map((row) => (
                  <TableRow key={row.line_kind}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.share}%</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatAccounting(row.amount_minor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <FinanceEmpty title="No paid lines" body="Service families appear once sales are paid." />
          )}
        </FinancePanel>
        <FinancePanel title="By payment method" description="Collected, refunds excluded">
          <PaymentTypesList types={payTypes} collectedMinor={pay.collectedMinor} />
        </FinancePanel>
      </div>
    </div>
  )
}
