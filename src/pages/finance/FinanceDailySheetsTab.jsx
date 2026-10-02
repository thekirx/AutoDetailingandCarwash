/** Finance › Daily sheets — inbox + history. Open a row to read the sheet and Approve / Return it. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { formatAccounting, SHEET_STATUS_LABELS } from '@/lib/dailySheet'
import { listSheets, sheetErrorMessage } from '@/lib/dailySheetApi'
import { downloadCsv, formatFinanceWindow } from '@/lib/financeData'
import DailySheetPanel, { SheetStatusChip } from '@/pages/pos/DailySheetPanel'
import { FinanceEmpty, FinanceMetricCell, FinanceMetricStrip, FinancePanel, FinanceTabSkeleton } from './FinanceChrome'

const STATUS_FILTERS = [
  { value: 'submitted', label: 'Waiting for approval' },
  { value: 'returned', label: 'Returned' },
  { value: 'approved', label: 'Approved' },
  { value: 'draft', label: 'Draft' },
  { value: 'all', label: 'All' },
]

const t = (row, key) => Number(row?.totals?.[key]) || 0
const overShort = (row) => (row?.totals?.overShortMinor == null ? null : Number(row.totals.overShortMinor) || 0)

const CSV_COLUMNS = [
  { label: 'Date', key: 'business_date' },
  { label: 'Branch', key: 'branch' },
  { label: 'Status', value: (r) => SHEET_STATUS_LABELS[r.status] || r.status },
  { label: 'Submitted by', value: (r) => r.staff_profiles?.full_name || '' },
  { label: 'Gross sales', value: (r) => (t(r, 'grossMinor') / 100).toFixed(2) },
  { label: 'Net sales', value: (r) => (t(r, 'netMinor') / 100).toFixed(2) },
  { label: 'Expenses', value: (r) => (t(r, 'expensesMinor') / 100).toFixed(2) },
  { label: 'Salaries', value: (r) => (t(r, 'salariesMinor') / 100).toFixed(2) },
  { label: 'Net profit', value: (r) => (t(r, 'netProfitMinor') / 100).toFixed(2) },
  { label: 'Over/short', value: (r) => (overShort(r) == null ? '' : (overShort(r) / 100).toFixed(2)) },
  { label: 'Review note', key: 'review_note' },
]

export default function FinanceDailySheetsTab({
  profile,
  range,
  branchFilter = 'all',
  branchOptions = [],
  status = 'submitted',
  overShortOnly = false,
  openSheetId = '',
  onFilters,
}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(() => new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listSheets({ status, branch: branchFilter, from: range.start, to: range.end }))
      setError('')
    } catch (err) {
      setError(sheetErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [status, branchFilter, range.start, range.end])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => (overShortOnly ? rows.filter((r) => overShort(r)) : rows), [rows, overShortOnly])
  const totals = useMemo(
    () => visible.reduce((s, r) => ({ net: s.net + t(r, 'netMinor'), profit: s.profit + t(r, 'netProfitMinor'), gap: s.gap + (overShort(r) || 0) }), { net: 0, profit: 0, gap: 0 }),
    [visible],
  )
  const branchName = (slug) => branchOptions.find((b) => b.slug === slug)?.name || slug
  const allChecked = visible.length > 0 && visible.every((r) => selected.has(r.id))

  function toggle(id) {
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exportRows(list) {
    downloadCsv(list.map((r) => ({ ...r, branch: branchName(r.branch) })), CSV_COLUMNS, `hakum-daily-sheets-${range.start}-to-${range.end}.csv`)
  }

  if (loading && !rows.length) return <FinanceTabSkeleton metrics={3} />

  return (
    <div className="finance-dash flex flex-col gap-5">
      <FinanceMetricStrip label="Daily sheet totals">
        <FinanceMetricCell label="Sheets" value={visible.length.toLocaleString('en-PH')} hint={formatFinanceWindow(range.start, range.end)} />
        <FinanceMetricCell label="Net sales" value={formatAccounting(totals.net)} hint="On these sheets" />
        <FinanceMetricCell label="Net profit" value={formatAccounting(totals.profit)} hint="After expenses and salaries" />
        <FinanceMetricCell label="Drawer over/short" value={formatAccounting(totals.gap)} hint="Counted minus expected" tone={totals.gap ? 'muted' : 'ink'} />
      </FinanceMetricStrip>

      <FinancePanel
        title="Daily sheets"
        description="One sheet per branch per day. Approving posts its expenses and salaries to the books."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="min-h-11 gap-2" onClick={load} disabled={loading}>
              <RefreshCw aria-hidden className={cn('size-4', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={!visible.length} onClick={() => exportRows(selected.size ? visible.filter((r) => selected.has(r.id)) : visible)}>
              <Download aria-hidden className="size-4" />
              {selected.size ? `Export ${selected.size} selected` : 'Export CSV'}
            </Button>
            <Button asChild variant="ghost" className="min-h-11">
              <Link to="/operations/finance?tab=shift-close">Old shift closes</Link>
            </Button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              type="button"
              size="sm"
              variant={status === f.value ? 'default' : 'outline'}
              aria-pressed={status === f.value}
              className="min-h-11"
              onClick={() => onFilters?.({ status: f.value === 'submitted' ? '' : f.value })}
            >
              {f.label}
            </Button>
          ))}
          <label className="ml-auto flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[#052699]" checked={overShortOnly} onChange={(e) => onFilters?.({ os: e.target.checked ? '1' : '' })} />
            Over/short only
          </label>
        </div>

        {error ? (
          <div className="ds-banner ds-banner--warn" role="alert">
            <p className="text-sm">{error}</p>
          </div>
        ) : visible.length === 0 ? (
          <FinanceEmpty
            title={status === 'submitted' ? 'Nothing waiting for approval' : 'No sheets match'}
            body={status === 'submitted' ? 'All good — every submitted sheet in this window has been reviewed.' : 'Try another status, branch or date range.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="xero-table min-w-[760px]">
              <thead>
                <tr>
                  <th className="w-10">
                    <Label className="sr-only" htmlFor="ds-all">Select all</Label>
                    <input id="ds-all" type="checkbox" className="size-4 accent-[#052699]" checked={allChecked} onChange={() => setSelected(allChecked ? new Set() : new Set(visible.map((r) => r.id)))} />
                  </th>
                  <th>Date</th>
                  <th>Branch</th>
                  <th>Submitted by</th>
                  <th className="num">Net sales</th>
                  <th className="num">Expenses</th>
                  <th className="num">Salaries</th>
                  <th className="num">Net profit</th>
                  <th className="num">Over/short</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const gap = overShort(r)
                  return (
                    <tr key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onFilters?.({ sheet: r.id })}>
                      <td onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" aria-label={`Select ${r.business_date} ${branchName(r.branch)}`} className="size-4 accent-[#052699]" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                      </td>
                      <td>
                        <button type="button" className="ds-link min-h-11 text-left" onClick={(e) => { e.stopPropagation(); onFilters?.({ sheet: r.id }) }}>
                          {r.business_date}
                        </button>
                      </td>
                      <td>{branchName(r.branch)}</td>
                      <td>{r.staff_profiles?.full_name || '—'}</td>
                      <td className="num">{formatAccounting(t(r, 'netMinor'))}</td>
                      <td className="num">{formatAccounting(t(r, 'expensesMinor'))}</td>
                      <td className="num">{formatAccounting(t(r, 'salariesMinor'))}</td>
                      <td className="num">{formatAccounting(t(r, 'netProfitMinor'))}</td>
                      <td className={cn('num', gap && 'ds-alert')}>{gap == null ? '—' : formatAccounting(gap)}</td>
                      <td><SheetStatusChip status={r.status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </FinancePanel>

      <Sheet open={Boolean(openSheetId)} onOpenChange={(open) => !open && onFilters?.({ sheet: '' })}>
        <SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-5xl">
          <SheetHeader>
            <SheetTitle>Review daily sheet</SheetTitle>
          </SheetHeader>
          {openSheetId ? (
            <div className="px-4 pb-6">
              <DailySheetPanel
                key={openSheetId}
                mode="review"
                sheetId={openSheetId}
                profile={profile}
                onReviewed={() => {
                  load()
                  onFilters?.({ sheet: '' })
                }}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
