import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { canSeeAllBranches, getBranchScopeList } from '@/auth/permissions'
import { listBranches } from '@/lib/adminApi'
import {
  aggregateLineItemsByFamily,
  aggregateSalesByBranch,
  aggregateSalesByHour,
  applyBranchScope,
  bookingSalesTotal,
  collectInChunks,
  collectPaged,
  peakSalesHour,
} from '@/lib/crmInsights'
import { topCustomersBySpend, insightsToCsv, downloadCsv } from '@/lib/crmInsightsExport'
import { getDashboardDateRange } from '@/queue/queueLogic'
import { formatMoney } from '@/queue/queueApi'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

function todayISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
}

export default function CrmInsightsPanel({ profile }) {
  const [branches, setBranches] = useState([])
  const [branchFilter, setBranchFilter] = useState(canSeeAllBranches(profile) ? 'all' : (getBranchScopeList(profile)?.[0] || 'all'))
  const [datePreset, setDatePreset] = useState('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [sales, setSales] = useState([])
  const [lines, setLines] = useState([])

  const range = useMemo(() => {
    if (datePreset === 'today' || datePreset === 'day') {
      const d = todayISO()
      return { start: d, end: d }
    }
    const r = getDashboardDateRange(datePreset, customStart, customEnd)
    return {
      start: r.start.toLocaleDateString('en-CA'),
      end: r.end.toLocaleDateString('en-CA'),
    }
  }, [datePreset, customStart, customEnd])

  const scope = useMemo(() => {
    const resolved = (() => {
      const list = getBranchScopeList(profile)
      if (list === null) return branchFilter === 'all' ? null : branchFilter
      if (branchFilter && branchFilter !== 'all' && list.includes(branchFilter)) return branchFilter
      if (list.length === 1) return list[0]
      if (list.length > 1 && branchFilter === 'all') return list
      return list
    })()
    return resolved
  }, [profile, branchFilter])

  const load = useCallback(async () => {
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
      toast.error(error.message)
      setSales([])
      setLines([])
      return
    }
    setSales(rows)
    if (!rows.length) {
      setLines([])
      return
    }
    const ids = rows.map((r) => r.id)
    try {
      const lineRows = await collectInChunks(ids, async (chunk, from, to) => {
        const { data, error: lineErr } = await supabase
          .from('sale_line_items')
          .select('sale_id, item_type, service_id, name, quantity, line_total_minor, services(pay_category, slug)')
          .in('sale_id', chunk)
          .order('id', { ascending: true })
          .range(from, to)
        if (lineErr) throw lineErr
        return data || []
      })
      setLines(lineRows)
    } catch (lineErr) {
      toast.error(lineErr.message)
      setLines([])
    }
  }, [range.start, range.end, scope])

  useEffect(() => {
    listBranches().then(setBranches).catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const hourly = useMemo(() => aggregateSalesByHour(sales), [sales])
  const peak = useMemo(() => peakSalesHour(hourly), [hourly])
  const byBranch = useMemo(() => aggregateSalesByBranch(sales), [sales])
  const byFamily = useMemo(() => aggregateLineItemsByFamily(lines), [lines])
  const topCustomers = useMemo(() => topCustomersBySpend(sales, 20), [sales])
  const totalMinor = sales.reduce((s, r) => s + Number(r.total_minor || 0), 0)
  const bookingMinor = useMemo(() => bookingSalesTotal(sales), [sales])

  const branchOptions = canSeeAllBranches(profile)
    ? [{ slug: 'all', name: 'All branches' }, ...branches]
    : (getBranchScopeList(profile) || []).map((slug) => ({
        slug,
        name: branches.find((b) => b.slug === slug)?.name || slug,
      }))

  const maxHourCount = Math.max(1, ...hourly.map((h) => h.count))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        {(canSeeAllBranches(profile) || branchOptions.length > 1) && (
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="min-h-11 w-44"><SelectValue placeholder="Branch" /></SelectTrigger>
            <SelectContent>
              {branchOptions.map((b) => <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={datePreset} onValueChange={setDatePreset}>
          <SelectTrigger className="min-h-11 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This week</SelectItem>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="year">This year</SelectItem>
            <SelectItem value="3mo">3 months</SelectItem>
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>
        {datePreset === 'custom' && (
          <>
            <Input type="date" className="min-h-11 w-40" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            <Input type="date" className="min-h-11 w-40" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Paid sales" value={sales.length} />
        <Stat label="Revenue" value={formatMoney(totalMinor)} />
        <Stat label="Booking sales" value={formatMoney(bookingMinor)} />
        <Stat label="Peak hour" value={peak ? `${String(peak.hour).padStart(2, '0')}:00 (${peak.count})` : '—'} />
        <Stat label="Top branch" value={byBranch[0]?.branch || '—'} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sales by hour</CardTitle>
          <CardDescription>{range.start} → {range.end} (Asia/Manila)</CardDescription>
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
                    <TableCell className="capitalize">{row.branch}</TableCell>
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
          range={range}
          filename={`hakum-wash-packages-${range.start}.csv`}
        />
        <ServiceRollup
          title="Top detailing"
          rows={byFamily.detailing}
          range={range}
          filename={`hakum-detailing-${range.start}.csv`}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Top 20 customers by spend</CardTitle>
            <CardDescription>{range.start} → {range.end}</CardDescription>
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
              downloadCsv(`hakum-top-customers-${range.start}.csv`, csv)
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

function ServiceRollup({ title, rows, range, filename }) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{range.start} → {range.end}</CardDescription>
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

function Stat({ label, value }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
        <p className="mt-3 text-2xl font-semibold tabular-nums capitalize">{value}</p>
      </CardContent>
    </Card>
  )
}
