/** Finance Reports tab: three sections — Sales, Operations, Customer Retention.
 * Each section pulls real data and exports to CSV/Excel/PDF. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileSpreadsheet, FileText, Users, Wrench, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { canAccessInquiries } from '@/auth/permissions'
import { toast } from 'sonner'
import { formatMoney } from '@/queue/queueApi'
import { downloadCsv, downloadExcel, printAsPdf, retentionBuckets, rollupRetentionByCustomer, salesByBranch, salesByDay, scopeBranch, branchScopeList } from '@/lib/financeData'

export default function FinanceReportsTab({
  salesRows,
  branchOptions,
  range,
  loading,
  profile,
  branchFilter,
}) {
  // Complaints are readable by Super Admin / Assistant Super Admin only; for anyone
  // else RLS silently returns 0, so skip the query rather than show a false zero.
  const showComplaints = canAccessInquiries(profile)
  const [operations, setOperations] = useState({ bookings: 0, complaints: 0, crew: 0 })
  const [retention, setRetention] = useState([])
  const [retentionSummary, setRetentionSummary] = useState({ fresh: 0, returning: 0, loyal: 0, total: 0 })

  const load = useCallback(async () => {
    const startIso = `${range.start}T00:00:00+08:00`
    const endIso = `${range.end}T23:59:59.999+08:00`
    const allSites = branchScopeList(profile) === null && (!branchFilter || branchFilter === 'all')
    const [books, comps, crew, retentionRes] = await Promise.all([
      scopeBranch(
        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('is_archived', false)
          .in('status', ['completed', 'for_payment'])
          .gte('scheduled_start', startIso)
          .lte('scheduled_start', endIso),
        profile,
        branchFilter,
      ),
      showComplaints
        ? scopeBranch(
            supabase
              .from('complaints')
              .select('id', { count: 'exact', head: true })
              .gte('created_at', startIso)
              .lte('created_at', endIso),
            profile,
            branchFilter,
          )
        : Promise.resolve({ count: 0, error: null }),
      scopeBranch(
        supabase.from('crew_kpi_summary').select('staff_id', { count: 'exact', head: true }),
        profile,
        branchFilter,
      ),
      scopeBranch(
        supabase
          .from('finance_customer_retention')
          .select('branch, customer_id, full_name, phone, paid_sales, total_spent_minor, first_paid_at, last_paid_at')
          .order('total_spent_minor', { ascending: false })
          .limit(allSites ? 200 : 50),
        profile,
        branchFilter,
      ),
    ])
    if (books.error) toast.error(books.error.message)
    if (comps.error) toast.error(comps.error.message)
    if (crew.error) toast.error(crew.error.message)
    if (retentionRes.error) toast.error(retentionRes.error.message)
    setOperations({
      bookings: books.count || 0,
      complaints: comps.count || 0,
      crew: crew.count || 0,
    })
    let retentionRows = retentionRes.data || []
    if (allSites) retentionRows = rollupRetentionByCustomer(retentionRows).slice(0, 50)
    setRetention(retentionRows)
    setRetentionSummary(retentionBuckets(retentionRows))
  }, [range.start, range.end, profile, branchFilter, showComplaints])

  useEffect(() => {
    load()
  }, [load])

  const salesByDayRows = useMemo(() => salesByDay(salesRows), [salesRows])
  const salesByBranchRows = useMemo(() => salesByBranch(salesRows), [salesRows])

  const salesColumns = useMemo(
    () => [
      { key: 'sale_date', label: 'Date' },
      { key: 'total_sales_minor', label: 'Total', value: (r) => formatMoney(r.total_sales_minor) },
      { key: 'cash_minor', label: 'Cash', value: (r) => formatMoney(r.cash_minor) },
      { key: 'gcash_minor', label: 'GCash', value: (r) => formatMoney(r.gcash_minor) },
      { key: 'card_minor', label: 'Card', value: (r) => formatMoney(r.card_minor) },
      { key: 'paid_count', label: 'Paid tickets' },
      { key: 'transaction_count', label: 'Transactions' },
    ],
    [],
  )

  const operationsColumns = useMemo(
    () => [
      { key: 'metric', label: 'Metric' },
      { key: 'value', label: 'Value' },
    ],
    [],
  )

  const operationsRows = useMemo(
    () => [
      { metric: 'Completed bookings', value: operations.bookings },
      ...(showComplaints ? [{ metric: 'Complaints', value: operations.complaints }] : []),
      { metric: 'Crew in KPI view', value: operations.crew },
      { metric: 'Branches with sales', value: salesByBranchRows.length },
    ],
    [operations, salesByBranchRows.length, showComplaints],
  )

  const retentionColumns = useMemo(
    () => [
      { key: 'full_name', label: 'Customer' },
      { key: 'phone', label: 'Phone' },
      { key: 'paid_sales', label: 'Paid sales' },
      { key: 'total_spent_minor', label: 'Total spent', value: (r) => formatMoney(r.total_spent_minor) },
      { key: 'first_paid_at', label: 'First paid', value: (r) => r.first_paid_at ? new Date(r.first_paid_at).toLocaleDateString() : '—' },
      { key: 'last_paid_at', label: 'Last paid', value: (r) => r.last_paid_at ? new Date(r.last_paid_at).toLocaleDateString() : '—' },
    ],
    [],
  )

  const subtitle = `${range.start} to ${range.end}`

  if (loading) return <ReportsSkeleton />

  return (
    <div className="flex flex-col gap-6">
      <ReportSection
        icon={<ShoppingCart className="size-4" aria-hidden />}
        title="Sales report"
        description={`${salesByDayRows.length} days · ${formatMoney(salesByDayRows.reduce((s, r) => s + r.total_sales_minor, 0))} in paid sales`}
        onCsv={() => downloadCsv(salesByDayRows, salesColumns, `hakum-sales-report-${range.start}-to-${range.end}.csv`)}
        onExcel={() => downloadExcel(salesByDayRows, salesColumns, `hakum-sales-report-${range.start}-to-${range.end}.xls`, 'Hakum Sales Report')}
        onPdf={() => printAsPdf(salesByDayRows, salesColumns, 'Hakum Sales Report', subtitle)}
      >
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesByDayRows.slice(0, 14).map((r) => (
                <TableRow key={r.sale_date}>
                  <TableCell className="font-medium">{r.sale_date}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.total_sales_minor)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.cash_minor)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.gcash_minor)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.card_minor)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.paid_count}</TableCell>
                </TableRow>
              ))}
              {!salesByDayRows.length && (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground">No sales in this window.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </ReportSection>

      <ReportSection
        icon={<Wrench className="size-4" aria-hidden />}
        title="Operations report"
        description={showComplaints
          ? `${operations.bookings} completed bookings · ${operations.complaints} complaints`
          : `${operations.bookings} completed bookings`}
        onCsv={() => downloadCsv(operationsRows, operationsColumns, `hakum-operations-report-${range.start}-to-${range.end}.csv`)}
        onExcel={() => downloadExcel(operationsRows, operationsColumns, `hakum-operations-report-${range.start}-to-${range.end}.xls`, 'Hakum Operations Report')}
        onPdf={() => printAsPdf(operationsRows, operationsColumns, 'Hakum Operations Report', subtitle)}
      >
        <div className="finance-kpi-row">
          <Kpi label="Completed bookings" value={operations.bookings} />
          {showComplaints && <Kpi label="Complaints" value={operations.complaints} />}
          <Kpi label="Crew in KPI" value={operations.crew} />
          <Kpi label="Branches with sales" value={salesByBranchRows.length} />
        </div>
      </ReportSection>

      <ReportSection
        icon={<Users className="size-4" aria-hidden />}
        title="Customer retention"
        description={`${retentionSummary.total} customers · ${retentionSummary.fresh} new · ${retentionSummary.loyal} loyal`}
        onCsv={() => downloadCsv(retention, retentionColumns, `hakum-retention-report-${range.start}-to-${range.end}.csv`)}
        onExcel={() => downloadExcel(retention, retentionColumns, `hakum-retention-report-${range.start}-to-${range.end}.xls`, 'Hakum Customer Retention')}
        onPdf={() => printAsPdf(retention, retentionColumns, 'Hakum Customer Retention', subtitle)}
      >
        <div className="finance-kpi-row">
          <Kpi label="New (1 visit)" value={retentionSummary.fresh} />
          <Kpi label="Returning (2-4)" value={retentionSummary.returning} />
          <Kpi label="Loyal (5+)" value={retentionSummary.loyal} />
          <Kpi label="Total customers" value={retentionSummary.total} />
        </div>
        <div className="finance-table-wrap">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Paid sales</TableHead>
                <TableHead className="text-right">Total spent</TableHead>
                <TableHead>Last paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {retention.slice(0, 14).map((r) => (
                <TableRow key={r.customer_id}>
                  <TableCell className="font-medium">{r.full_name || '—'}</TableCell>
                  <TableCell>{r.paid_sales}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.total_spent_minor)}</TableCell>
                  <TableCell>{r.last_paid_at ? new Date(r.last_paid_at).toLocaleDateString() : '—'}</TableCell>
                </TableRow>
              ))}
              {!retention.length && (
                <TableRow><TableCell colSpan={4} className="text-muted-foreground">No customers with paid sales yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </ReportSection>
    </div>
  )
}

function ReportSection({ icon, title, description, onCsv, onExcel, onPdf, children }) {
  return (
    <Card>
      <CardHeader>
        <div className="finance-report-header">
          <div className="finance-report-title">
            <span className="finance-report-icon" aria-hidden>{icon}</span>
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          <div className="finance-report-actions">
            <Button variant="outline" onClick={onCsv}>
              <Download className="size-3.5" /> CSV
            </Button>
            <Button variant="outline" onClick={onExcel}>
              <FileSpreadsheet className="size-3.5" /> Excel
            </Button>
            <Button variant="outline" onClick={onPdf}>
              <FileText className="size-3.5" /> PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function Kpi({ label, value }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
        <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

function ReportsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <CardContent className="space-y-2">
            <div className="finance-skeleton-line h-8 w-48" />
            <div className="finance-skeleton-line h-40" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
