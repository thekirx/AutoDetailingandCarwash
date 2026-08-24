/** Finance Reports tab: three sections — Sales, Operations, Customer Retention.
 * Each section pulls real data and exports to CSV/Excel/PDF. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileSpreadsheet, FileText, Users, Wrench, ShoppingCart, ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { canAccessInquiries } from '@/auth/permissions'
import { toast } from 'sonner'
import { formatMoney } from '@/queue/queueApi'
import {
  downloadCsv,
  downloadExcel,
  formatFinanceWindow,
  printAsPdf,
  retentionBuckets,
  rollupRetentionByCustomer,
  salesByBranch,
  salesByDay,
  scopeBranch,
  branchScopeList,
} from '@/lib/financeData'
import {
  FinanceMetricCell,
  FinanceMetricStrip,
  FinancePanel,
  FinanceTabSkeleton,
} from './FinanceChrome'

export default function FinanceReportsTab({
  salesRows,
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
  const [shiftCloses, setShiftCloses] = useState([])

  const load = useCallback(async () => {
    const startIso = `${range.start}T00:00:00+08:00`
    const endIso = `${range.end}T23:59:59.999+08:00`
    const allSites = branchScopeList(profile) === null && (!branchFilter || branchFilter === 'all')
    let shiftQ = supabase
      .from('shift_close_reports')
      .select('id, branch, business_date, status, submitted, pos_baseline')
      .in('status', ['accepted', 'locked'])
      .gte('business_date', range.start)
      .lte('business_date', range.end)
      .order('business_date', { ascending: false })
      .limit(60)
    if (branchFilter && branchFilter !== 'all') shiftQ = shiftQ.eq('branch', branchFilter)

    const [books, comps, crew, retentionRes, shiftRes] = await Promise.all([
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
      shiftQ,
    ])
    if (books.error) toast.error(books.error.message)
    if (comps.error) toast.error(comps.error.message)
    if (crew.error) toast.error(crew.error.message)
    if (retentionRes.error) toast.error(retentionRes.error.message)
    if (shiftRes.error) toast.error(shiftRes.error.message)
    setOperations({
      bookings: books.count || 0,
      complaints: comps.count || 0,
      crew: crew.count || 0,
    })
    let retentionRows = retentionRes.data || []
    if (allSites) retentionRows = rollupRetentionByCustomer(retentionRows).slice(0, 50)
    setRetention(retentionRows)
    setRetentionSummary(retentionBuckets(retentionRows))
    setShiftCloses(shiftRes.data || [])
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

  const shiftCloseColumns = useMemo(
    () => [
      { key: 'business_date', label: 'Date' },
      { key: 'branch', label: 'Branch' },
      { key: 'status', label: 'Status' },
      {
        key: 'square_sales_minor',
        label: 'Total sales (submitted)',
        value: (r) =>
          formatMoney(r.submitted?.total_sales_minor ?? r.submitted?.square_sales_minor ?? 0),
      },
      {
        key: 'total_gcash_minor',
        label: 'GCash (submitted)',
        value: (r) => formatMoney(r.submitted?.total_gcash_minor ?? 0),
      },
      {
        key: 'credit_card_minor',
        label: 'Credit card (submitted)',
        value: (r) => formatMoney(r.submitted?.credit_card_minor ?? 0),
      },
      {
        key: 'total_expenses_minor',
        label: 'Expenses (submitted)',
        value: (r) => formatMoney(r.submitted?.total_expenses_minor ?? 0),
      },
      {
        key: 'ca_collected_minor',
        label: 'CA collected (submitted)',
        value: (r) => formatMoney(r.submitted?.ca_collected_minor ?? 0),
      },
      {
        key: 'total_cash_left_minor',
        label: 'Cash left (submitted)',
        value: (r) => formatMoney(r.submitted?.total_cash_left_minor ?? 0),
      },
    ],
    [],
  )

  const subtitle = formatFinanceWindow(range.start, range.end)
  const salesTotal = useMemo(
    () => salesByDayRows.reduce((s, r) => s + r.total_sales_minor, 0),
    [salesByDayRows],
  )

  if (loading) return <FinanceTabSkeleton metrics={4} lines={4} />

  return (
    <div className="finance-dash flex flex-col gap-5">
      <FinanceMetricStrip label="Report snapshot">
        <FinanceMetricCell label="POS sales" value={formatMoney(salesTotal)} hint={subtitle} tone="ink" />
        <FinanceMetricCell label="Bookings done" value={String(operations.bookings)} tone="ink" />
        <FinanceMetricCell label="Shift closes" value={String(shiftCloses.length)} hint="Accepted / locked" tone="muted" />
        <FinanceMetricCell label="Customers" value={String(retentionSummary.total)} hint={`${retentionSummary.loyal} loyal`} tone="up" />
      </FinanceMetricStrip>

      <ReportSection
        icon={<ClipboardCheck aria-hidden />}
        title="Shift close attestation"
        description={`${shiftCloses.length} accepted/locked closes · read-only · does not rewrite POS sales`}
        onCsv={() => downloadCsv(shiftCloses, shiftCloseColumns, `hakum-shift-close-${range.start}-to-${range.end}.csv`)}
        onExcel={() => downloadExcel(shiftCloses, shiftCloseColumns, `hakum-shift-close-${range.start}-to-${range.end}.xls`, 'Hakum Shift Close')}
        onPdf={() => printAsPdf(shiftCloses, shiftCloseColumns, 'Hakum Shift Close Attestation', subtitle)}
      >
        <div className="finance-table-wrap">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total sales</TableHead>
                <TableHead className="text-right">GCash</TableHead>
                <TableHead className="text-right">Card</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">CA collected</TableHead>
                <TableHead className="text-right">Cash left</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shiftCloses.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.business_date}</TableCell>
                  <TableCell>{r.branch}</TableCell>
                  <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(r.submitted?.total_sales_minor ?? r.submitted?.square_sales_minor ?? 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.submitted?.total_gcash_minor ?? 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.submitted?.credit_card_minor ?? 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.submitted?.total_expenses_minor ?? 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.submitted?.ca_collected_minor ?? 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.submitted?.total_cash_left_minor ?? 0)}</TableCell>
                </TableRow>
              ))}
              {!shiftCloses.length && (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground">
                    No accepted or locked shift closes in this window.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </ReportSection>

      <ReportSection
        icon={<ShoppingCart aria-hidden />}
        title="Sales report"
        description={`${salesByDayRows.length} days · ${formatMoney(salesTotal)} in paid sales`}
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
        icon={<Wrench aria-hidden />}
        title="Operations report"
        description={showComplaints
          ? `${operations.bookings} completed bookings · ${operations.complaints} complaints`
          : `${operations.bookings} completed bookings`}
        onCsv={() => downloadCsv(operationsRows, operationsColumns, `hakum-operations-report-${range.start}-to-${range.end}.csv`)}
        onExcel={() => downloadExcel(operationsRows, operationsColumns, `hakum-operations-report-${range.start}-to-${range.end}.xls`, 'Hakum Operations Report')}
        onPdf={() => printAsPdf(operationsRows, operationsColumns, 'Hakum Operations Report', subtitle)}
      >
        <FinanceMetricStrip label="Operations">
          <FinanceMetricCell label="Completed bookings" value={String(operations.bookings)} tone="ink" />
          {showComplaints ? (
            <FinanceMetricCell label="Complaints" value={String(operations.complaints)} tone="muted" />
          ) : null}
          <FinanceMetricCell label="Crew in KPI" value={String(operations.crew)} tone="ink" />
          <FinanceMetricCell label="Branches with sales" value={String(salesByBranchRows.length)} tone="muted" />
        </FinanceMetricStrip>
      </ReportSection>

      <ReportSection
        icon={<Users aria-hidden />}
        title="Customer retention"
        description={`${retentionSummary.total} customers · ${retentionSummary.fresh} new · ${retentionSummary.loyal} loyal`}
        onCsv={() => downloadCsv(retention, retentionColumns, `hakum-retention-report-${range.start}-to-${range.end}.csv`)}
        onExcel={() => downloadExcel(retention, retentionColumns, `hakum-retention-report-${range.start}-to-${range.end}.xls`, 'Hakum Customer Retention')}
        onPdf={() => printAsPdf(retention, retentionColumns, 'Hakum Customer Retention', subtitle)}
      >
        <FinanceMetricStrip label="Retention">
          <FinanceMetricCell label="New (1 visit)" value={String(retentionSummary.fresh)} tone="ink" />
          <FinanceMetricCell label="Returning (2-4)" value={String(retentionSummary.returning)} tone="muted" />
          <FinanceMetricCell label="Loyal (5+)" value={String(retentionSummary.loyal)} tone="up" />
          <FinanceMetricCell label="Total customers" value={String(retentionSummary.total)} tone="ink" />
        </FinanceMetricStrip>
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
    <FinancePanel
      title={
        <span className="inline-flex items-center gap-2">
          <span className="finance-kpi-icon" aria-hidden>
            {icon}
          </span>
          {title}
        </span>
      }
      description={description}
      actions={
        <>
          <Button type="button" variant="outline" className="min-h-10 cursor-pointer" onClick={onCsv}>
            <Download data-icon="inline-start" />
            CSV
          </Button>
          <Button type="button" variant="outline" className="min-h-10 cursor-pointer" onClick={onExcel}>
            <FileSpreadsheet data-icon="inline-start" />
            Excel
          </Button>
          <Button type="button" variant="outline" className="min-h-10 cursor-pointer" onClick={onPdf}>
            <FileText data-icon="inline-start" />
            PDF
          </Button>
        </>
      }
    >
      {children}
    </FinancePanel>
  )
}
