/** Finance Sales tab: POS sales list with payment-method + branch filters,
 * CSV/Excel/PDF export. Mobile cards, desktop table. */
import { useMemo, useState } from 'react'
import { Download, FileSpreadsheet, FileText, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney } from '@/queue/queueApi'
import { salesByDay, downloadCsv, downloadExcel, printAsPdf } from '@/lib/financeData'

const PAYMENT_FILTERS = [
  { value: 'all', label: 'All methods' },
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'card', label: 'Card' },
]

export default function FinanceSalesTab({
  salesRows,
  branchOptions,
  range,
  loading,
}) {
  const [method, setMethod] = useState('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    let rows = salesByDay(salesRows)
    if (method === 'cash') rows = rows.filter((r) => r.cash_minor > 0)
    if (method === 'gcash') rows = rows.filter((r) => r.gcash_minor > 0)
    if (method === 'card') rows = rows.filter((r) => r.card_minor > 0)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      rows = rows.filter((r) => r.sale_date.includes(q))
    }
    return rows
  }, [salesRows, method, query])

  const exportColumns = useMemo(
    () => [
      { key: 'sale_date', label: 'Date' },
      {
        key: 'branch',
        label: 'Branches',
        value: (row) =>
          branchOptions
            .map((b) => b.slug)
            .filter((slug) => salesRows.some((r) => r.sale_date === row.sale_date && r.branch === slug))
            .map((slug) => branchOptions.find((b) => b.slug === slug)?.name || slug)
            .join(' · ') || '—',
      },
      { key: 'total_sales_minor', label: 'Total', value: (row) => formatMoney(row.total_sales_minor) },
      { key: 'cash_minor', label: 'Cash', value: (row) => formatMoney(row.cash_minor) },
      { key: 'gcash_minor', label: 'GCash', value: (row) => formatMoney(row.gcash_minor) },
      { key: 'card_minor', label: 'Card', value: (row) => formatMoney(row.card_minor) },
      { key: 'paid_count', label: 'Paid tickets' },
      { key: 'transaction_count', label: 'Transactions' },
    ],
    [salesRows, branchOptions],
  )

  const subtitle = `${range.start} to ${range.end} · ${filtered.length} days`
  const fileBase = `hakum-sales-${range.start}-to-${range.end}`

  if (loading) return <SalesSkeleton />

  return (
    <div className="flex flex-col gap-6">
      <div className="finance-toolbar">
        <div className="finance-toolbar-search">
          <Search className="size-4" aria-hidden />
          <input
            type="search"
            placeholder="Filter by date (YYYY-MM-DD)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="finance-toolbar-actions">
          <Label htmlFor="sales-method" className="sr-only">Payment method</Label>
          <select
            id="sales-method"
            className="finance-toolbar-select"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            {PAYMENT_FILTERS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <Button variant="outline" onClick={() => downloadCsv(filtered, exportColumns, `${fileBase}.csv`)}>
            <Download className="size-3.5" /> CSV
          </Button>
          <Button variant="outline" onClick={() => downloadExcel(filtered, exportColumns, `${fileBase}.xls`, 'Hakum Sales')}>
            <FileSpreadsheet className="size-3.5" /> Excel
          </Button>
          <Button variant="outline" onClick={() => printAsPdf(filtered, exportColumns, 'Hakum Sales', subtitle)}>
            <FileText className="size-3.5" /> PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>POS sales by day</CardTitle>
          <CardDescription>{subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales match these filters.</p>
          ) : (
            <>
              <div className="finance-mobile-list">
                {filtered.map((row) => (
                  <article key={`m-${row.sale_date}`} className="finance-mobile-card">
                    <div>
                      <p className="finance-mobile-title">{row.sale_date}</p>
                      <p className="finance-mobile-sub">
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
                ))}
              </div>
              <div className="finance-table-wrap">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
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
                      <TableRow key={row.sale_date}>
                        <TableCell className="font-medium">{row.sale_date}</TableCell>
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
        </CardContent>
      </Card>
    </div>
  )
}

function SalesSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="finance-skeleton-line h-10" />
        ))}
      </CardContent>
    </Card>
  )
}
