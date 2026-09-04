/** Finance Sales — POS ledger by branch × day, payment filters, exports. */
import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Download, FileSpreadsheet, FileText, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { formatMoney } from '@/queue/queueApi'
import {
  downloadCsv,
  downloadExcel,
  formatFinanceWindow,
  printAsPdf,
  salesByDay,
  salesLedgerRows,
} from '@/lib/financeData'
import {
  FinanceEmpty,
  FinanceMetricCell,
  FinanceMetricStrip,
  FinancePanel,
  FinanceTabSkeleton,
} from './FinanceChrome'

const PAYMENT_FILTERS = [
  { value: 'all', label: 'All methods' },
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'card', label: 'Card' },
]

const trendConfig = {
  sales: { label: 'Sales', color: 'var(--color-brand-primary)' },
}

export default function FinanceSalesTab({ salesRows, branchOptions, range, loading }) {
  const [method, setMethod] = useState('all')
  const [query, setQuery] = useState('')

  const ledger = useMemo(() => salesLedgerRows(salesRows), [salesRows])
  const byDay = useMemo(() => salesByDay(salesRows), [salesRows])

  const filtered = useMemo(() => {
    let rows = ledger
    if (method === 'cash') rows = rows.filter((r) => r.cash_minor > 0)
    if (method === 'gcash') rows = rows.filter((r) => r.gcash_minor > 0)
    if (method === 'card') rows = rows.filter((r) => r.card_minor > 0)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      rows = rows.filter(
        (r) =>
          r.sale_date.includes(q) ||
          String(r.branch || '').toLowerCase().includes(q) ||
          (branchOptions.find((b) => b.slug === r.branch)?.name || '').toLowerCase().includes(q),
      )
    }
    return rows
  }, [ledger, method, query, branchOptions])

  const totals = useMemo(() => {
    const total = filtered.reduce((s, r) => s + r.total_sales_minor, 0)
    const cash = filtered.reduce((s, r) => s + r.cash_minor, 0)
    const gcash = filtered.reduce((s, r) => s + r.gcash_minor, 0)
    const card = filtered.reduce((s, r) => s + r.card_minor, 0)
    const paid = filtered.reduce((s, r) => s + r.paid_count, 0)
    return { total, cash, gcash, card, paid }
  }, [filtered])

  const chartData = useMemo(
    () =>
      [...byDay]
        .reverse()
        .map((d) => ({
          date: d.sale_date,
          sales: d.total_sales_minor / 100,
        })),
    [byDay],
  )

  const exportColumns = useMemo(
    () => [
      { key: 'sale_date', label: 'Date' },
      {
        key: 'branch',
        label: 'Branch',
        value: (row) => branchOptions.find((b) => b.slug === row.branch)?.name || row.branch || '—',
      },
      { key: 'total_sales_minor', label: 'Total', value: (row) => formatMoney(row.total_sales_minor) },
      { key: 'cash_minor', label: 'Cash', value: (row) => formatMoney(row.cash_minor) },
      { key: 'gcash_minor', label: 'GCash', value: (row) => formatMoney(row.gcash_minor) },
      { key: 'card_minor', label: 'Card', value: (row) => formatMoney(row.card_minor) },
      { key: 'paid_count', label: 'Paid tickets' },
      { key: 'transaction_count', label: 'Transactions' },
    ],
    [branchOptions],
  )

  const windowLabel = formatFinanceWindow(range.start, range.end)
  const subtitle = `${windowLabel} · ${filtered.length} row${filtered.length === 1 ? '' : 's'}`
  const fileBase = `hakum-sales-${range.start}-to-${range.end}`

  if (loading) return <FinanceTabSkeleton metrics={5} />

  const showBranch = branchOptions.length > 1

  return (
    <div className="finance-dash flex flex-col gap-5">
      <FinanceMetricStrip label="Sales totals">
        <FinanceMetricCell label="Total sales" value={formatMoney(totals.total)} hint="Filtered rows" tone="ink" />
        <FinanceMetricCell label="Cash" value={formatMoney(totals.cash)} hint="Till" tone="ink" />
        <FinanceMetricCell label="GCash" value={formatMoney(totals.gcash)} hint="Wallet" tone="ink" />
        <FinanceMetricCell label="Card" value={formatMoney(totals.card)} hint="Terminal" tone="muted" />
        <FinanceMetricCell
          label="Paid tickets"
          value={totals.paid.toLocaleString('en-PH')}
          hint={`${byDay.length} day${byDay.length === 1 ? '' : 's'} in window`}
          tone="ink"
        />
      </FinanceMetricStrip>

      <FinancePanel title="Daily sales trend" description={`POS paid · ${windowLabel}`}>
        {chartData.some((d) => d.sales > 0) ? (
          <div className="finance-chart-mid">
            <ChartContainer config={trendConfig} className="h-full w-full aspect-auto">
              <AreaChart accessibilityLayer data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={28}
                  tickFormatter={(v) => String(v).slice(5)}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(v) => `₱${Number(v) >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
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
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="var(--color-sales)"
                  fill="var(--color-sales)"
                  fillOpacity={0.14}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        ) : (
          <FinanceEmpty
            title="No paid sales in this window"
            body="Close POS tickets as paid to populate the ledger and trend."
          />
        )}
      </FinancePanel>

      <div className="finance-toolbar">
        <div className="finance-toolbar-search">
          <Search aria-hidden />
          <input
            type="search"
            placeholder={showBranch ? 'Filter by date or branch' : 'Filter by date (YYYY-MM-DD)'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter sales"
          />
        </div>
        <div className="finance-toolbar-actions">
          <Label htmlFor="sales-method" className="sr-only">
            Payment method
          </Label>
          <select
            id="sales-method"
            className="finance-toolbar-select min-h-10"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            {PAYMENT_FILTERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            className="min-h-10 cursor-pointer"
            onClick={() => downloadCsv(filtered, exportColumns, `${fileBase}.csv`)}
          >
            <Download data-icon="inline-start" />
            CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-10 cursor-pointer"
            onClick={() => downloadExcel(filtered, exportColumns, `${fileBase}.xls`, 'Hakum Sales')}
          >
            <FileSpreadsheet data-icon="inline-start" />
            Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-10 cursor-pointer"
            onClick={() => printAsPdf(filtered, exportColumns, 'Hakum Sales', subtitle)}
          >
            <FileText data-icon="inline-start" />
            PDF
          </Button>
        </div>
      </div>

      <FinancePanel title="POS sales ledger" description={subtitle}>
        {filtered.length === 0 ? (
          <FinanceEmpty title="No sales match these filters" body="Widen the period, clear the search, or choose All methods." />
        ) : (
          <>
            <div className="finance-mobile-list">
              {filtered.map((row) => {
                const name = branchOptions.find((b) => b.slug === row.branch)?.name || row.branch
                return (
                  <article key={`m-${row.branch}-${row.sale_date}`} className="finance-mobile-card">
                    <div>
                      <p className="finance-mobile-title">{row.sale_date}</p>
                      <p className="finance-mobile-sub">
                        {showBranch ? `${name} · ` : ''}
                        {row.paid_count} paid · {row.transaction_count} tx
                      </p>
                    </div>
                    <div className="finance-mobile-amount">
                      <span className="tabular-nums">{formatMoney(row.total_sales_minor)}</span>
                      <div className="finance-mobile-meta">
                        {row.cash_minor > 0 && <Badge variant="secondary">Cash {formatMoney(row.cash_minor)}</Badge>}
                        {row.gcash_minor > 0 && <Badge variant="secondary">GCash {formatMoney(row.gcash_minor)}</Badge>}
                        {row.card_minor > 0 && <Badge variant="secondary">Card {formatMoney(row.card_minor)}</Badge>}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
            <div className="finance-table-wrap">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    {showBranch ? <TableHead>Branch</TableHead> : null}
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Cash</TableHead>
                    <TableHead className="text-right">GCash</TableHead>
                    <TableHead className="text-right">Card</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Tx</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={`${row.branch}-${row.sale_date}`}>
                      <TableCell className="font-medium tabular-nums">{row.sale_date}</TableCell>
                      {showBranch ? (
                        <TableCell>
                          {branchOptions.find((b) => b.slug === row.branch)?.name || row.branch}
                        </TableCell>
                      ) : null}
                      <TableCell className="text-right tabular-nums">{formatMoney(row.total_sales_minor)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(row.cash_minor)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(row.gcash_minor)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(row.card_minor)}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.paid_count}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.transaction_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </FinancePanel>
    </div>
  )
}
