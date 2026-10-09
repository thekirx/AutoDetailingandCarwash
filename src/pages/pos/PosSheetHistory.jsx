/** POS › Sheet history — every Daily Sheet for this branch as a weekly / monthly / daily table. */
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import { downloadCsv } from '@/lib/financeData'
import {
  SHEET_STATUS_LABELS,
  filterSheets,
  formatAccounting,
  groupSheetsByPeriod,
  sheetHistoryRange,
  sheetPeriodLabel,
} from '@/lib/dailySheet'
import { listSheets, sheetErrorMessage } from '@/lib/dailySheetApi'
import { SheetStatusChip } from '@/pages/pos/DailySheetPanel'

const VIEWS = [
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'day', label: 'Daily' },
]
const PRESETS = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'last90', label: 'Last 90 days' },
]
const STATUSES = [{ value: 'all', label: 'All' }, ...['submitted', 'approved', 'returned', 'draft'].map((value) => ({ value, label: SHEET_STATUS_LABELS[value] }))]

const t = (row, key) => Number(row?.totals?.[key]) || 0
const gapOf = (row) => (row?.totals?.overShortMinor == null ? null : Number(row.totals.overShortMinor) || 0)

const csvColumns = [
  { label: 'Date', key: 'business_date' },
  { label: 'Status', value: (r) => SHEET_STATUS_LABELS[r.status] || r.status },
  { label: 'Submitted by', value: (r) => r.staff_profiles?.full_name || '' },
  { label: 'Net sales', value: (r) => (t(r, 'netMinor') / 100).toFixed(2) },
  { label: 'Expenses', value: (r) => (t(r, 'expensesMinor') / 100).toFixed(2) },
  { label: 'Salaries', value: (r) => (t(r, 'salariesMinor') / 100).toFixed(2) },
  { label: 'Net profit', value: (r) => (t(r, 'netProfitMinor') / 100).toFixed(2) },
  { label: 'Over/short', value: (r) => (gapOf(r) == null ? '' : (gapOf(r) / 100).toFixed(2)) },
  { label: 'Review note', key: 'review_note' },
]

function Metric({ label, children, hint }) {
  return (
    <div className="min-w-0">
      <p className="ds-mini-head">{label}</p>
      <p className="ds-num text-left text-lg font-semibold">{children}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export default function PosSheetHistory({ branch, branchLabel, onOpenSheet }) {
  const today = getLocalCalendarDate()
  const [view, setView] = useState('week')
  const [preset, setPreset] = useState('last30')
  const [range, setRange] = useState(() => sheetHistoryRange('last30', today))
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!branch) return
    setLoading(true)
    try {
      setRows(await listSheets({ branch, status, from: range.from, to: range.to, limit: 500 }))
      setError('')
    } catch (err) {
      setError(sheetErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [branch, status, range.from, range.to])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => filterSheets(rows, { search }), [rows, search])
  const groups = useMemo(() => groupSheetsByPeriod(visible, view), [visible, view])
  const totals = useMemo(
    () =>
      visible.reduce(
        (s, r) => ({ net: s.net + t(r, 'netMinor'), profit: s.profit + t(r, 'netProfitMinor'), gap: s.gap + (gapOf(r) || 0), pending: s.pending + (r.status === 'submitted' ? 1 : 0) }),
        { net: 0, profit: 0, gap: 0, pending: 0 },
      ),
    [visible],
  )
  const rangeBad = range.from && range.to && range.from > range.to
  const filtered = Boolean(search || status !== 'all')

  function pickPreset(value) {
    setPreset(value)
    setRange(sheetHistoryRange(value, today))
  }
  function setDate(key, value) {
    setPreset('')
    setRange((cur) => ({ ...cur, [key]: value }))
  }
  function clear() {
    setSearch('')
    setStatus('all')
  }

  return (
    <div className="ds-root">
      <header className="ds-head">
        <div>
          <p className="ds-eyebrow">Daily sheet history · {branchLabel}</p>
          <h2 className="ds-title">Past sheets</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="min-h-11 gap-2" onClick={load} disabled={loading}>
            <RefreshCw aria-hidden className={cn('size-4', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={!visible.length} onClick={() => downloadCsv(visible, csvColumns, `hakum-daily-sheets-${branch}-${range.from}-to-${range.to}.csv`)}>
            <Download aria-hidden className="size-4" />
            CSV
          </Button>
        </div>
      </header>

      <section className="ds-card" aria-label="Filters">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Group sheets by">
          {VIEWS.map((v) => (
            <Button key={v.value} type="button" size="sm" variant={view === v.value ? 'default' : 'outline'} aria-pressed={view === v.value} className="min-h-11" onClick={() => setView(v.value)}>
              {v.label}
            </Button>
          ))}
          <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Quick date range">
            {PRESETS.map((p) => (
              <Button key={p.value} type="button" size="sm" variant={preset === p.value ? 'secondary' : 'ghost'} aria-pressed={preset === p.value} className="min-h-11" onClick={() => pickPreset(p.value)}>
                {p.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(2,minmax(0,1fr))_minmax(0,2fr)_minmax(0,1fr)_auto]">
          <div className="flex flex-col gap-1">
            <Label htmlFor="sh-from" className="text-xs text-muted-foreground">From</Label>
            <Input id="sh-from" type="date" className="min-h-11" value={range.from} max={range.to || today} aria-invalid={rangeBad || undefined} onChange={(e) => setDate('from', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="sh-to" className="text-xs text-muted-foreground">To</Label>
            <Input id="sh-to" type="date" className="min-h-11" value={range.to} min={range.from} max={today} aria-invalid={rangeBad || undefined} onChange={(e) => setDate('to', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="sh-search" className="text-xs text-muted-foreground">Search a date, name or note</Label>
            <Input id="sh-search" type="search" className="min-h-11" placeholder="2026-10-09, Oct 9, Friday, short…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="sh-status" className="text-xs text-muted-foreground">Status</Label>
            <select id="sh-status" className="min-h-11 rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            {filtered ? (
              <Button type="button" variant="ghost" size="sm" className="min-h-11 gap-1" onClick={clear}>
                <X aria-hidden className="size-4" />
                Clear
              </Button>
            ) : null}
          </div>
        </div>
        {rangeBad ? <p className="text-sm ds-alert" role="alert">The start date is after the end date.</p> : null}
      </section>

      <section className="ds-card" aria-label="Totals">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Metric label="Sheets" hint={rows.length !== visible.length ? `of ${rows.length}` : undefined}>{visible.length}</Metric>
          <Metric label="Net sales"><span>{formatAccounting(totals.net)}</span></Metric>
          <Metric label="Net profit" hint="After expenses and salaries"><span>{formatAccounting(totals.profit)}</span></Metric>
          <Metric label="Drawer over/short"><span className={totals.gap ? 'ds-alert' : undefined}>{formatAccounting(totals.gap)}</span></Metric>
          <Metric label="Waiting for approval">{totals.pending}</Metric>
        </div>
      </section>

      <section className="ds-card" aria-label="Sheets">
        {error ? (
          <div className="ds-banner ds-banner--warn" role="alert">
            <p className="text-sm">{error}</p>
            <Button type="button" variant="outline" className="mt-2 min-h-11" onClick={load}>Try again</Button>
          </div>
        ) : loading && !rows.length ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading sheets…</p>
        ) : groups.length === 0 ? (
          <div className="py-10 text-center">
            <p className="font-semibold">{filtered ? 'No sheets match' : 'No sheets in this window'}</p>
            <p className="text-sm text-muted-foreground">{filtered ? 'Clear the search or status filter, or widen the dates.' : 'Pick a longer date range, or fill today’s sheet in the Daily sheet tab.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="xero-table min-w-[820px]">
              <thead>
                <tr>
                  <th>{view === 'week' ? 'Week / date' : view === 'month' ? 'Month / date' : 'Date'}</th>
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
                {groups.map((g) => (
                  <Fragment key={g.key}>
                    {view !== 'day' ? (
                      <tr className="xero-subtotal bg-muted/40">
                        <td>
                          {sheetPeriodLabel(g.key, view)}
                          <span className="block text-xs font-normal text-muted-foreground">
                            {g.count} sheet{g.count === 1 ? '' : 's'} · {g.approved} approved{g.pending ? ` · ${g.pending} waiting` : ''}
                          </span>
                        </td>
                        <td />
                        <td className="num">{formatAccounting(g.netMinor)}</td>
                        <td className="num">{formatAccounting(g.expensesMinor)}</td>
                        <td className="num">{formatAccounting(g.salariesMinor)}</td>
                        <td className="num">{formatAccounting(g.netProfitMinor)}</td>
                        <td className={cn('num', g.overShortMinor && 'ds-alert')}>{formatAccounting(g.overShortMinor)}</td>
                        <td />
                      </tr>
                    ) : null}
                    {g.rows.map((r) => {
                      const gap = gapOf(r)
                      return (
                        <tr key={r.id}>
                          <td>
                            <button type="button" className="ds-link min-h-11 text-left" onClick={() => onOpenSheet?.(r.business_date, r)}>
                              {sheetPeriodLabel(r.business_date, 'day')}
                            </button>
                          </td>
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
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {visible.length >= 500 ? <p className="text-xs text-muted-foreground">Showing the newest 500 sheets. Narrow the dates to see older ones.</p> : null}
      </section>
    </div>
  )
}
