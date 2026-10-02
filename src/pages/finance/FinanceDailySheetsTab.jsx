/** Finance › Daily sheets — inbox + history. Open a row to read the sheet and Approve / Return it. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Printer, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NamedSelect } from '@/components/ui/named-select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { filterSheets, formatAccounting, sheetSubmitters, SHEET_STATUS_LABELS } from '@/lib/dailySheet'
import { listSheets, sheetErrorMessage } from '@/lib/dailySheetApi'
import { downloadCsv, downloadExcel, formatFinanceWindow, printAsPdf } from '@/lib/financeData'
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

const QUICK_PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
]

/** Data exports (CSV / Excel) get plain pesos; Print gets ₱1,234.56 and (₱50.00). */
const sheetColumns = (forPrint) => {
  const money = (minor) => (minor == null ? '' : forPrint ? formatAccounting(minor) : (minor / 100).toFixed(2))
  return [
    { label: 'Date', key: 'business_date' },
    { label: 'Branch', key: 'branch' },
    { label: 'Status', value: (r) => SHEET_STATUS_LABELS[r.status] || r.status },
    { label: 'Submitted by', value: (r) => r.staff_profiles?.full_name || '' },
    { label: 'Gross sales', value: (r) => money(t(r, 'grossMinor')) },
    { label: 'Net sales', value: (r) => money(t(r, 'netMinor')) },
    { label: 'Expenses', value: (r) => money(t(r, 'expensesMinor')) },
    { label: 'Salaries', value: (r) => money(t(r, 'salariesMinor')) },
    { label: 'Net profit', value: (r) => money(t(r, 'netProfitMinor')) },
    { label: 'Over/short', value: (r) => money(overShort(r)) },
    { label: 'Review note', key: 'review_note' },
  ]
}

export default function FinanceDailySheetsTab({
  profile,
  range,
  branchFilter = 'all',
  branchOptions = [],
  status = 'submitted',
  overShortOnly = false,
  openSheetId = '',
  period = '',
  onPeriod,
  onFilters,
}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [search, setSearch] = useState('')
  const [submitter, setSubmitter] = useState('')
  const [minNet, setMinNet] = useState('')
  const [maxNet, setMaxNet] = useState('')

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

  const branchName = useCallback((slug) => branchOptions.find((b) => b.slug === slug)?.name || slug, [branchOptions])
  const visible = useMemo(
    () => filterSheets(rows, { search, submitter, minNet, maxNet, overShortOnly, branchName }),
    [rows, search, submitter, minNet, maxNet, overShortOnly, branchName],
  )
  const submitters = useMemo(() => sheetSubmitters(rows), [rows])
  const extraFilters = Boolean(search || submitter || minNet || maxNet || overShortOnly)
  const totals = useMemo(
    () => visible.reduce((s, r) => ({ net: s.net + t(r, 'netMinor'), profit: s.profit + t(r, 'netProfitMinor'), gap: s.gap + (overShort(r) || 0) }), { net: 0, profit: 0, gap: 0 }),
    [visible],
  )
  const allChecked = visible.length > 0 && visible.every((r) => selected.has(r.id))
  const exportList = selected.size ? visible.filter((r) => selected.has(r.id)) : visible

  function clearFilters() {
    setSearch('')
    setSubmitter('')
    setMinNet('')
    setMaxNet('')
    if (overShortOnly) onFilters?.({ os: '' })
  }

  function toggle(id) {
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exportRows(kind) {
    const list = exportList.map((r) => ({ ...r, branch: branchName(r.branch) }))
    const name = `hakum-daily-sheets-${range.start}-to-${range.end}`
    const title = 'Hakum daily sheets'
    if (kind === 'csv') downloadCsv(list, sheetColumns(false), `${name}.csv`)
    else if (kind === 'excel') downloadExcel(list, sheetColumns(false), `${name}.xls`, title)
    else printAsPdf(list, sheetColumns(true), title, `${formatFinanceWindow(range.start, range.end)} · ${list.length} sheet(s) · net profit ${formatAccounting(list.reduce((s, r) => s + t(r, 'netProfitMinor'), 0))}`)
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
            <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={!visible.length} onClick={() => exportRows('csv')}>
              <Download aria-hidden className="size-4" />
              {selected.size ? `CSV (${selected.size})` : 'CSV'}
            </Button>
            <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={!visible.length} onClick={() => exportRows('excel')}>
              <Download aria-hidden className="size-4" />
              {selected.size ? `Excel (${selected.size})` : 'Excel'}
            </Button>
            <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={!visible.length} onClick={() => exportRows('print')}>
              <Printer aria-hidden className="size-4" />
              {selected.size ? `Print (${selected.size})` : 'Print / PDF'}
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
          {onPeriod ? (
            <div className="ml-auto flex flex-wrap gap-2" role="group" aria-label="Quick date range">
              {QUICK_PERIODS.map((p) => (
                <Button key={p.value} type="button" size="sm" variant={period === p.value ? 'secondary' : 'ghost'} aria-pressed={period === p.value} className="min-h-11" onClick={() => onPeriod(p.value)}>
                  {p.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div className="flex flex-col gap-1">
            <Label htmlFor="ds-search">Search</Label>
            <Input id="ds-search" type="search" className="min-h-11" placeholder="Date, branch, name or note" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="ds-submitter">Submitted by</Label>
            <NamedSelect id="ds-submitter" className="min-h-11" value={submitter} onChange={setSubmitter} options={submitters} emptyLabel="Anyone" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="ds-min-net">Net profit from (₱)</Label>
            <Input id="ds-min-net" inputMode="decimal" className="min-h-11" placeholder="Any" value={minNet} onChange={(e) => setMinNet(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="ds-max-net">Net profit to (₱)</Label>
            <Input id="ds-max-net" inputMode="decimal" className="min-h-11" placeholder="Any" value={maxNet} onChange={(e) => setMaxNet(e.target.value)} />
          </div>
          <div className="flex items-end gap-3">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[#052699]" checked={overShortOnly} onChange={(e) => onFilters?.({ os: e.target.checked ? '1' : '' })} />
              Over/short only
            </label>
            {extraFilters ? (
              <Button type="button" variant="ghost" size="sm" className="min-h-11 gap-1" onClick={clearFilters}>
                <X aria-hidden className="size-4" />
                Clear
              </Button>
            ) : null}
          </div>
        </div>
        {extraFilters && rows.length ? (
          <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
            Showing {visible.length} of {rows.length} sheet(s)
          </p>
        ) : null}

        {error ? (
          <div className="ds-banner ds-banner--warn" role="alert">
            <p className="text-sm">{error}</p>
          </div>
        ) : visible.length === 0 ? (
          <FinanceEmpty
            title={status === 'submitted' && !extraFilters ? 'Nothing waiting for approval' : 'No sheets match'}
            body={status === 'submitted' && !extraFilters ? 'All good — every submitted sheet in this window has been reviewed.' : 'Try another status, branch, date range or clear the filters.'}
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
