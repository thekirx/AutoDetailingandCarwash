import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, RotateCcw } from 'lucide-react'
import { canSeeAllBranches, getBranchScopeList } from '@/auth/permissions'
import { listBranches } from '@/lib/adminApi'
import {
  ALL_WEEKDAYS,
  INSIGHT_DATE_PRESETS,
  WEEKDAYS,
  aggregateLineItemsByFamily,
  aggregateSalesByBranch,
  aggregateSalesByHour,
  aggregateSalesByWeekday,
  applyBranchScope,
  bestWeekday,
  bookingSalesTotal,
  collectInChunks,
  collectPaged,
  filterSalesByWeekdays,
  insightsDateRange,
  manilaDateKey,
  peakSalesHour,
  topSalesDates,
  weekdayBranchBreakdown,
} from '@/lib/crmInsights'
import { topCustomersBySpend, insightsToCsv, downloadCsv } from '@/lib/crmInsightsExport'
import { formatMoney } from '@/queue/queueApi'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

const WEEKDAY_SET = [1, 2, 3, 4, 5]
const WEEKEND_SET = [6, 0]
const sameDays = (a, b) => a.length === b.length && b.every((d) => a.includes(d))
const fmtKey = (key, opts = { month: 'short', day: 'numeric', year: 'numeric' }) =>
  new Date(`${key}T00:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', ...opts })
const groupLabel = 'text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase'

export default function CrmInsightsPanel({ profile }) {
  const [branches, setBranches] = useState([])
  const [selectedBranches, setSelectedBranches] = useState([])
  const [days, setDays] = useState(ALL_WEEKDAYS)
  const [datePreset, setDatePreset] = useState('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [sales, setSales] = useState([])
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(false)
  const reqRef = useRef(0)
  const today = useMemo(() => manilaDateKey(), [])

  const range = useMemo(() => insightsDateRange(datePreset, customStart, customEnd, today), [datePreset, customStart, customEnd, today])

  const scopeList = useMemo(() => getBranchScopeList(profile), [profile])
  const scope = useMemo(() => (selectedBranches.length ? selectedBranches : scopeList), [selectedBranches, scopeList])

  const load = useCallback(async () => {
    const req = ++reqRef.current
    if (!range) {
      setSales([])
      setLines([])
      setLoading(false)
      return
    }
    setLoading(true)
    const startIso = `${range.start}T00:00:00+08:00`
    const endIso = `${range.end}T23:59:59.999+08:00`
    let rows = []
    try {
      rows = await collectPaged(async (from, to) => {
        let q = supabase
          .from('sales')
          .select('id, branch, total_minor, occurred_at, status, customer_id, booking_id, customers(id, full_name, phone)')
          .gte('occurred_at', startIso)
          .lte('occurred_at', endIso)
          .in('status', ['paid', 'completed'])
          .order('occurred_at', { ascending: false })
          .range(from, to)
        q = applyBranchScope(q, scope)
        const { data, error } = await q
        if (error) throw error
        return data || []
      }, 1000)
    } catch (error) {
      if (req !== reqRef.current) return
      toast.error(error.message)
      setSales([])
      setLines([])
      setLoading(false)
      return
    }
    if (req !== reqRef.current) return
    setSales(rows)
    if (!rows.length) {
      setLines([])
      setLoading(false)
      return
    }
    const ids = rows.map((r) => r.id)
    let lineRows = []
    try {
      lineRows = await collectInChunks(ids, async (chunk, from, to) => {
        const { data, error: lineErr } = await supabase
          .from('sale_line_items')
          .select('sale_id, item_type, service_id, name, quantity, line_total_minor, services(pay_category, slug)')
          .in('sale_id', chunk)
          .order('id', { ascending: true })
          .range(from, to)
        if (lineErr) throw lineErr
        return data || []
      })
    } catch (lineErr) {
      if (req === reqRef.current) toast.error(lineErr.message)
    }
    if (req !== reqRef.current) return
    setLines(lineRows)
    setLoading(false)
  }, [range, scope])

  useEffect(() => {
    listBranches().then(setBranches).catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const daySales = useMemo(() => filterSalesByWeekdays(sales, days), [sales, days])
  const dayLines = useMemo(() => {
    if (daySales.length === sales.length) return lines
    const ids = new Set(daySales.map((s) => s.id))
    return lines.filter((l) => ids.has(l.sale_id))
  }, [daySales, sales.length, lines])

  const hourly = useMemo(() => aggregateSalesByHour(daySales), [daySales])
  const peak = useMemo(() => peakSalesHour(hourly), [hourly])
  const byBranch = useMemo(() => aggregateSalesByBranch(daySales), [daySales])
  const byFamily = useMemo(() => aggregateLineItemsByFamily(dayLines), [dayLines])
  const topCustomers = useMemo(() => topCustomersBySpend(daySales, 20), [daySales])
  const totalMinor = daySales.reduce((s, r) => s + Number(r.total_minor || 0), 0)
  const bookingMinor = useMemo(() => bookingSalesTotal(daySales), [daySales])

  const weekdayOpts = useMemo(() => ({ start: range?.start, end: range?.end, days, today }), [range, days, today])
  const weekdayRows = useMemo(() => aggregateSalesByWeekday(daySales, weekdayOpts), [daySales, weekdayOpts])
  const bestDay = useMemo(() => bestWeekday(weekdayRows), [weekdayRows])
  const branchBreakdown = useMemo(
    () => weekdayBranchBreakdown(daySales, { ...weekdayOpts, branches: selectedBranches.length ? selectedBranches : undefined }),
    [daySales, weekdayOpts, selectedBranches],
  )
  const topDates = useMemo(() => topSalesDates(daySales, 5), [daySales])

  const branchName = (slug) => branches.find((b) => b.slug === slug)?.name || slug
  const branchOptions = canSeeAllBranches(profile)
    ? branches
    : (scopeList || []).map((slug) => ({ slug, name: branchName(slug) }))
  const toggleBranch = (slug) => {
    const next = selectedBranches.includes(slug) ? selectedBranches.filter((s) => s !== slug) : [...selectedBranches, slug]
    setSelectedBranches(next.length >= branchOptions.length ? [] : next)
  }
  const toggleDay = (id) => {
    if (days.includes(id)) {
      if (days.length > 1) setDays(days.filter((d) => d !== id))
    } else setDays([...days, id])
  }

  const rangeText = range
    ? range.start === range.end ? fmtKey(range.start) : `${fmtKey(range.start, { month: 'short', day: 'numeric' })} to ${fmtKey(range.end)}`
    : 'Pick a start and end date'
  const daysText = sameDays(days, ALL_WEEKDAYS) ? 'Every day' : sameDays(days, WEEKDAY_SET) ? 'Weekdays' : sameDays(days, WEEKEND_SET) ? 'Weekends'
    : WEEKDAYS.filter((d) => days.includes(d.id)).map((d) => d.short).join(', ')
  const branchText = selectedBranches.length ? selectedBranches.map(branchName).join(', ') : 'All branches'
  const filtered = !sameDays(days, ALL_WEEKDAYS) || datePreset !== 'month' || selectedBranches.length > 0
  const resetFilters = () => {
    setDays(ALL_WEEKDAYS)
    setDatePreset('month')
    setCustomStart('')
    setCustomEnd('')
    setSelectedBranches([])
  }
  const fileTag = range?.start || today

  const maxHourCount = Math.max(1, ...hourly.map((h) => h.count))

  return (
    <div className="flex flex-col gap-6" aria-busy={loading || undefined}>
      <Card>
        <CardContent className="flex flex-col gap-5 pt-5">
          <div className="grid gap-5 lg:grid-cols-[auto_auto_minmax(0,1fr)] lg:gap-8">
            <fieldset className="flex min-w-0 flex-col gap-2">
              <legend className={cn(groupLabel, 'mb-2')}>Days</legend>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days of the week">
                {WEEKDAYS.map((d) => (
                  <Button
                    key={d.id}
                    type="button"
                    size="sm"
                    variant={days.includes(d.id) ? 'default' : 'outline'}
                    aria-pressed={days.includes(d.id)}
                    aria-label={d.long}
                    className="min-h-11 w-12 px-0 xl:min-h-9"
                    onClick={() => toggleDay(d.id)}
                  >
                    {d.short}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1" role="group" aria-label="Day shortcuts">
                {[['Every day', ALL_WEEKDAYS], ['Weekdays', WEEKDAY_SET], ['Weekends', WEEKEND_SET]].map(([label, set]) => (
                  <Button key={label} type="button" size="sm" variant={sameDays(days, set) ? 'secondary' : 'ghost'} aria-pressed={sameDays(days, set)} className="min-h-11 xl:min-h-8" onClick={() => setDays(set)}>
                    {label}
                  </Button>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex min-w-0 flex-col gap-2">
              <legend className={cn(groupLabel, 'mb-2')}>Date</legend>
              <Select value={datePreset} onValueChange={setDatePreset} items={INSIGHT_DATE_PRESETS.map((p) => ({ value: p.id, label: p.label }))}>
                <SelectTrigger className="min-h-11 w-48" aria-label="Date range"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INSIGHT_DATE_PRESETS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {datePreset === 'custom' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Input type="date" aria-label="Start date" className="min-h-11 w-40" value={customStart} max={today} onChange={(e) => setCustomStart(e.target.value)} />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input type="date" aria-label="End date" className="min-h-11 w-40" value={customEnd} max={today} onChange={(e) => setCustomEnd(e.target.value)} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground tabular-nums">{rangeText}</p>
              )}
            </fieldset>

            {branchOptions.length > 1 ? (
              <fieldset className="flex min-w-0 flex-col gap-2">
                <legend className={cn(groupLabel, 'mb-2')}>Branches</legend>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Branches">
                  <Button type="button" size="sm" variant={!selectedBranches.length ? 'default' : 'outline'} aria-pressed={!selectedBranches.length} className="min-h-11 xl:min-h-9" onClick={() => setSelectedBranches([])}>
                    All branches
                  </Button>
                  {branchOptions.map((b) => (
                    <Button key={b.slug} type="button" size="sm" variant={selectedBranches.includes(b.slug) ? 'default' : 'outline'} aria-pressed={selectedBranches.includes(b.slug)} className="min-h-11 xl:min-h-9" onClick={() => toggleBranch(b.slug)}>
                      {b.name}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Pick one or more to compare.</p>
              </fieldset>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-sm" aria-live="polite">
              <span className="font-medium">{daysText}</span>
              <span className="text-muted-foreground"> · {rangeText} · {branchText}</span>
              {loading ? <span className="text-muted-foreground"> · Loading…</span> : null}
            </p>
            {filtered ? (
              <Button type="button" size="sm" variant="ghost" className="min-h-11 gap-1.5 xl:min-h-8" onClick={resetFilters}>
                <RotateCcw className="size-3.5" aria-hidden /> Reset filters
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Paid sales" value={daySales.length} />
        <Stat label="Revenue" value={formatMoney(totalMinor)} />
        <Stat label="Booking sales" value={formatMoney(bookingMinor)} />
        <Stat label="Best day" value={bestDay?.label || '-'} hint={bestDay?.avg_minor != null ? `${formatMoney(bestDay.avg_minor)} per day` : undefined} />
        <Stat label="Peak hour" value={peak ? `${String(peak.hour).padStart(2, '0')}:00 (${peak.count})` : '-'} />
        <Stat label="Top branch" value={byBranch[0] ? branchName(byBranch[0].branch) : '-'} />
      </div>

      <ProfitableDays rows={weekdayRows} best={bestDay} breakdown={branchBreakdown} topDates={topDates} branchName={branchName} rangeText={rangeText} />

      <Card>
        <CardHeader>
          <CardTitle>Sales by hour</CardTitle>
          <CardDescription>{rangeText} (Asia/Manila)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {hourly.filter((h) => h.count > 0).length ? (
            hourly.map((h) => (
              <div key={h.hour} className="flex items-center gap-3 text-sm">
                <span className="w-12 tabular-nums text-muted-foreground">{String(h.hour).padStart(2, '0')}:00</span>
                <div className="h-2 flex-1 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${(h.count / maxHourCount) * 100}%` }} />
                </div>
                <span className="w-24 text-right tabular-nums">{h.count} · {formatMoney(h.total_minor)}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No paid sales in this range.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Per branch</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch</TableHead>
                  <TableHead>Sales</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byBranch.map((row) => (
                  <TableRow key={row.branch}>
                    <TableCell>{branchName(row.branch)}</TableCell>
                    <TableCell>{row.count}</TableCell>
                    <TableCell>{formatMoney(row.total_minor)}</TableCell>
                  </TableRow>
                ))}
                {!byBranch.length && (
                  <TableRow><TableCell colSpan={3} className="text-muted-foreground">No data.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <ServiceRollup
          title="Top wash / packages"
          rows={byFamily.wash}
          rangeText={rangeText}
          filename={`hakum-wash-packages-${fileTag}.csv`}
        />
        <ServiceRollup
          title="Top detailing"
          rows={byFamily.detailing}
          rangeText={rangeText}
          filename={`hakum-detailing-${fileTag}.csv`}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Top 20 customers by spend</CardTitle>
            <CardDescription>{rangeText}</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!topCustomers.length}
            onClick={() => {
              const csv = insightsToCsv(topCustomers, [
                { key: 'name', label: 'Customer' },
                { key: 'phone', label: 'Phone' },
                { key: 'sales_count', label: 'Sales' },
                { key: 'total_minor', label: 'Revenue (centavos)', get: (r) => r.total_minor },
                { key: 'total_pesos', label: 'Revenue (₱)', get: (r) => (r.total_minor / 100).toFixed(2) },
              ])
              downloadCsv(`hakum-top-customers-${fileTag}.csv`, csv)
              toast.success('CSV downloaded')
            }}
          >
            <Download className="size-4" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Sales</TableHead>
                <TableHead>Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topCustomers.map((row, idx) => (
                <TableRow key={row.customer_id}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.phone || '—'}</TableCell>
                  <TableCell>{row.sales_count}</TableCell>
                  <TableCell>{formatMoney(row.total_minor)}</TableCell>
                </TableRow>
              ))}
              {!topCustomers.length && (
                <TableRow><TableCell colSpan={5} className="text-muted-foreground">No customer data.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function serviceCsv(rows) {
  return insightsToCsv(rows, [
    { key: 'name', label: 'Service' },
    { key: 'count', label: 'Qty' },
    { key: 'total_minor', label: 'Revenue (centavos)' },
    { key: 'total_pesos', label: 'Revenue (₱)', get: (r) => (r.total_minor / 100).toFixed(2) },
  ])
}

function ServiceRollup({ title, rows, rangeText, filename }) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{rangeText}</CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={!rows.length}
          onClick={() => {
            downloadCsv(filename, serviceCsv(rows))
            toast.success('CSV downloaded')
          }}
        >
          <Download className="size-4" /> Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.count}</TableCell>
                <TableCell>{formatMoney(row.total_minor)}</TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow><TableCell colSpan={3} className="text-muted-foreground">No service lines.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function ProfitableDays({ rows, best, breakdown, topDates, branchName, rangeText }) {
  const maxAvg = Math.max(1, ...rows.map((r) => r.avg_minor || 0))
  const hasSales = rows.some((r) => r.total_minor > 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Most profitable days</CardTitle>
        <CardDescription>
          Paid POS revenue per weekday, averaged over how many of that day fall in the range, so a month with five Saturdays does not win on count alone. {rangeText}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-8">
        {!hasSales ? (
          <p className="text-sm text-muted-foreground">No paid sales for these days, dates and branches.</p>
        ) : (
          <>
            <div className="grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <ol aria-label="Average revenue by weekday" className="flex flex-col gap-3">
                {rows.map((r) => {
                  const isBest = best?.day === r.day
                  return (
                    <li key={r.day} className="grid grid-cols-[6rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                      <span className={cn('font-medium', isBest && 'text-primary')}>
                        {r.label}
                        {isBest ? <span className="sr-only"> (best day)</span> : null}
                      </span>
                      <div className="h-2.5 rounded-full bg-muted" aria-hidden>
                        <div className={cn('h-full rounded-full', isBest ? 'bg-primary' : 'bg-primary/35')} style={{ width: `${((r.avg_minor || 0) / maxAvg) * 100}%` }} />
                      </div>
                      <div className="min-w-36 text-right tabular-nums">
                        <p className={cn('font-semibold', r.avg_minor == null && 'font-normal text-muted-foreground')}>
                          {r.avg_minor == null ? 'Not in range' : `${formatMoney(r.avg_minor)} / day`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatMoney(r.total_minor)} · {r.count} {r.count === 1 ? 'sale' : 'sales'} · {r.occurrences} {r.occurrences === 1 ? 'day' : 'days'}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ol>

              <section aria-labelledby="crm-best-dates">
                <h3 id="crm-best-dates" className="text-sm font-medium">Best dates</h3>
                <ol className="mt-2 flex flex-col divide-y divide-border">
                  {topDates.map((d, i) => (
                    <li key={d.date} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">
                          <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}</span>
                          {fmtKey(d.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {d.count} {d.count === 1 ? 'sale' : 'sales'} · led by {branchName(d.topBranch)} ({formatMoney(d.topBranchMinor)})
                        </p>
                      </div>
                      <span className="font-semibold tabular-nums">{formatMoney(d.total_minor)}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            <section aria-labelledby="crm-days-by-branch" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 id="crm-days-by-branch" className="text-sm font-medium">By branch</h3>
                <p className="text-xs text-muted-foreground">Average revenue per day. Shading is relative to each branch&apos;s own best day.</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Branch</TableHead>
                    {rows.map((r) => <TableHead key={r.day} className="text-right">{r.short}</TableHead>)}
                    <TableHead>Best day</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdown.map((b) => {
                    const branchMax = Math.max(1, ...b.days.map((d) => d.avg_minor || 0))
                    return (
                      <TableRow key={b.branch}>
                        <TableCell className="font-medium whitespace-nowrap">{branchName(b.branch)}</TableCell>
                        {b.days.map((d) => {
                          const isBest = b.best?.day === d.day
                          const share = (d.avg_minor || 0) / branchMax
                          return (
                            <TableCell
                              key={d.day}
                              className={cn('text-right tabular-nums whitespace-nowrap', isBest ? 'font-semibold' : !d.total_minor && 'text-muted-foreground')}
                              style={d.total_minor ? { backgroundColor: `color-mix(in oklab, var(--primary) ${Math.round(5 + share * 20)}%, transparent)` } : undefined}
                              title={`${branchName(b.branch)} · ${d.label}: ${formatMoney(d.total_minor)} from ${d.count} sales over ${d.occurrences} days`}
                            >
                              {d.avg_minor == null ? '-' : formatMoney(d.avg_minor)}
                            </TableCell>
                          )
                        })}
                        <TableCell className="whitespace-nowrap">{b.best ? b.best.label : <span className="text-muted-foreground">No sales</span>}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Stat({ label, value, hint }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
        <p className="mt-3 text-2xl font-semibold tabular-nums capitalize">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground tabular-nums">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}
