import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessInquiries, canSeeAllBranches, canSeeAllKpiBranches, getBranchScopeList, ROLES } from '@/auth/permissions'
import { listBranches } from '@/lib/adminApi'
import { applyBranchScope, collectPaged, resolveKpiRpcBranch } from '@/lib/crmInsights'
import { aggregateByService, averageCycleMinutes, averageWaitMinutes, compareBranchesByCompleted, failedQaCount, kpiStatHover } from '@/lib/kpiPart8'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/queue/queueApi'
import {
  getBranchScope,
  getDashboardDateRange,
  requiresTeamLeadBranchSetup,
  resolveBranchFilter,
} from '@/queue/queueLogic'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'

function todayISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
}

export default function KpiPage() {
  const { profile, canViewQueueOperations } = useAuth()
  const isTl = profile?.role === ROLES.TEAM_LEAD
  const [tab, setTab] = useState('crew')
  const [crewRows, setCrewRows] = useState([])
  const [bookings, setBookings] = useState([])
  const [sales, setSales] = useState([])
  const [complaints, setComplaints] = useState([])
  const [services, setServices] = useState([])
  const [branches, setBranches] = useState([])
  const [branchFilter, setBranchFilter] = useState(canSeeAllKpiBranches(profile) ? 'all' : (getBranchScopeList(profile)?.[0] || 'all'))
  const [datePreset, setDatePreset] = useState('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [serviceFilter, setServiceFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const range = useMemo(() => {
    if (datePreset === 'today') {
      const d = todayISO()
      return { start: d, end: d }
    }
    const r = getDashboardDateRange(datePreset, customStart, customEnd)
    return {
      start: r.start.toLocaleDateString('en-CA'),
      end: r.end.toLocaleDateString('en-CA'),
    }
  }, [datePreset, customStart, customEnd])

  const branchScope = useMemo(() => {
    if (canSeeAllKpiBranches(profile)) {
      if (!branchFilter || branchFilter === 'all') return null
      return branchFilter
    }
    return resolveBranchFilter(profile, branchFilter)
  }, [profile, branchFilter])

  const load = useCallback(async () => {
    if (requiresTeamLeadBranchSetup(profile)) {
      setLoading(false)
      return
    }
    setLoading(true)
    const startIso = `${range.start}T00:00:00+08:00`
    const endIso = `${range.end}T23:59:59.999+08:00`
    const legacyScope = getBranchScope(profile)
    const rpcBranch = resolveKpiRpcBranch(branchScope, legacyScope)

    try {
      const { data: rpcRows, error: rpcError } = await supabase.rpc('get_crew_kpi', {
        input_start_date: range.start,
        input_end_date: range.end,
        input_branch_slug: rpcBranch,
      })
      if (rpcError) {
        // fallback view — honor UI branch filter, not only legacy single scope
        let q = supabase
          .from('crew_kpi_summary')
          .select('staff_id, staff_name, branch, total_assigned, total_completed, average_service_minutes, active_jobs, completed_today')
        q = applyBranchScope(q, branchScope)
        const { data, error } = await q.order('staff_name')
        if (error) throw error
        setCrewRows(data || [])
      } else {
        const today = todayISO()
        setCrewRows(
          (rpcRows || []).map((row) => ({
            staff_id: row.staff_id,
            staff_name: row.staff_name,
            branch: row.branch_slug || row.branch_name,
            total_assigned: Number(row.cars_handled || 0) + Number(row.active_jobs || 0),
            total_completed: Number(row.cars_handled || 0),
            average_service_minutes: Number(row.average_completed_seconds || 0) / 60,
            active_jobs: Number(row.active_jobs || 0),
            completed_today: Number(row.completed_today ?? row.cars_handled_today ?? 0),
            _range_end: today,
          })),
        )
      }

      const bookingRows = await collectPaged(async (from, to) => {
        let bq = supabase
          .from('bookings')
          .select('id, branch, service_id, status, waiting_at, in_progress_at, for_payment_at, completed_at, final_checking_at, final_price_minor, redo_at')
          .eq('is_archived', false)
          .gte('scheduled_start', startIso)
          .lte('scheduled_start', endIso)
          .order('scheduled_start', { ascending: false })
          .range(from, to)
        bq = applyBranchScope(bq, branchScope)
        if (serviceFilter !== 'all') bq = bq.eq('service_id', serviceFilter)
        const { data, error } = await bq
        if (error) throw error
        return data || []
      }, 1000)
      setBookings(bookingRows)

      const saleRows = await collectPaged(async (from, to) => {
        let sq = supabase
          .from('sales')
          .select('id, branch, total_minor, occurred_at, status')
          .gte('occurred_at', startIso)
          .lte('occurred_at', endIso)
          .in('status', ['paid', 'completed'])
          .order('occurred_at', { ascending: false })
          .range(from, to)
        sq = applyBranchScope(sq, branchScope)
        const { data, error } = await sq
        if (error) throw error
        return data || []
      }, 1000)
      setSales(saleRows)

      if (canAccessInquiries(profile)) {
        let cq = supabase
          .from('complaints')
          .select('id, branch, category, status, created_at, customer_name')
          .gte('created_at', startIso)
          .lte('created_at', endIso)
          .order('created_at', { ascending: false })
          .limit(100)
        cq = applyBranchScope(cq, branchScope)
        const { data: complaintRows } = await cq
        setComplaints(complaintRows || [])
      } else {
        setComplaints([])
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [profile, range.start, range.end, branchScope, serviceFilter])

  useEffect(() => {
    listBranches().then(setBranches).catch(() => {})
    supabase.from('services').select('id, name').eq('is_active', true).then(({ data }) => setServices(data || []))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const serviceNames = useMemo(
    () => Object.fromEntries(services.map((s) => [s.id, s.name])),
    [services],
  )
  const avgCycle = useMemo(() => averageCycleMinutes(bookings), [bookings])
  const avgWait = useMemo(() => averageWaitMinutes(bookings), [bookings])
  const cancelCount = useMemo(() => bookings.filter((b) => b.status === 'cancelled').length, [bookings])
  const failedQa = useMemo(() => failedQaCount(bookings), [bookings])
  const branchCompare = useMemo(() => compareBranchesByCompleted(bookings), [bookings])
  const byService = useMemo(() => aggregateByService(bookings, serviceNames), [bookings, serviceNames])
  const salesTotal = sales.reduce((s, r) => s + Number(r.total_minor || 0), 0)
  const hover = useMemo(
    () => kpiStatHover(bookings, { salesTotal, complaintsCount: complaints.length }),
    [bookings, salesTotal, complaints.length],
  )

  if (!canViewQueueOperations) return <Navigate to="/operations/access-denied" replace />
  if (requiresTeamLeadBranchSetup(profile)) {
    return (
      <section className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-6 text-amber-100">
        Branch setup required before viewing KPI.
      </section>
    )
  }

  const branchOptions = canSeeAllKpiBranches(profile)
    ? [{ slug: 'all', name: 'All branches' }, ...branches]
    : (getBranchScopeList(profile) || []).map((slug) => ({
        slug,
        name: branches.find((b) => b.slug === slug)?.name || slug,
      }))

  return (
    <section className="planner-v2 flex flex-col gap-6">
      <header className="planner-v2-head">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] text-primary uppercase">Queue KPI</p>
          <h1>Crew and branch</h1>
          <p>
            Hover a number for sample size and share of this range · {range.start} → {range.end}
            {loading ? ' · Loading…' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(canSeeAllKpiBranches(profile) || branchOptions.length > 1) && (
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="min-h-11 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {branchOptions.map((b) => <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={datePreset} onValueChange={setDatePreset}>
            <SelectTrigger className="min-h-11 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="3mo">3 months</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {datePreset === 'custom' && (
            <>
              <Input type="date" className="min-h-11 w-36" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              <Input type="date" className="min-h-11 w-36" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </>
          )}
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="min-h-11 w-44"><SelectValue placeholder="Service" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={load}>Refresh</Button>
        </div>
      </header>

      <TooltipProvider delay={120}>
        <div className="flex flex-col gap-4">
          <div className="kpi-board">
            <Stat label="Avg cycle (min)" value={avgCycle == null ? '—' : Math.round(avgCycle)} lines={hover.cycle.lines} hero />
            <div className="kpi-strip">
              <Stat label="Avg wait (min)" value={avgWait == null ? '—' : Math.round(avgWait)} lines={hover.wait.lines} />
              <Stat label="Cancelled" value={cancelCount} lines={hover.cancelled.lines} />
              <Stat label="Failed QA" value={failedQa} lines={hover.failedQa.lines} />
            </div>
          </div>
          <div className="kpi-secondary">
            <Stat label="Bookings in range" value={bookings.length} lines={hover.bookings.lines} />
            <Stat label="Sales revenue" value={formatMoney(salesTotal)} lines={hover.sales.lines} />
            {canAccessInquiries(profile) && (
              <Stat label="Complaints" value={complaints.length} lines={hover.complaints.lines} />
            )}
          </div>
        </div>
      </TooltipProvider>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="crew">Crew</TabsTrigger>
          <TabsTrigger value="compare">Branch compare</TabsTrigger>
          <TabsTrigger value="service">By service</TabsTrigger>
          {(isTl || canSeeAllBranches(profile) || profile?.role === ROLES.ADMIN) && (
            <>
              <TabsTrigger value="sales">Sales</TabsTrigger>
              {canAccessInquiries(profile) && <TabsTrigger value="complaints">Complaints</TabsTrigger>}
            </>
          )}
        </TabsList>

        <TabsContent value="crew" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {crewRows.length ? crewRows.map((row) => (
              <article key={`${row.staff_id}-${row.branch}`} className="planner-ticket rounded-2xl border border-border bg-card p-4">
                <p className="text-base font-semibold">{row.staff_name}</p>
                <p className="mt-1 text-xs tracking-wide text-muted-foreground uppercase">{row.branch || 'All'}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Assigned</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{row.total_assigned}</dd></div>
                  <div><dt className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Released</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{row.total_completed}</dd></div>
                  <div><dt className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Active</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{row.active_jobs}</dd></div>
                  <div><dt className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Avg min</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{Math.round(row.average_service_minutes || 0)}</dd></div>
                </dl>
              </article>
            )) : (
              <p className="text-sm text-muted-foreground">No crew KPI in this range.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="compare" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Branch comparison</CardTitle>
              <CardDescription>Completed booking volume + avg in_progress→finish minutes</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Branch</TableHead>
                    <TableHead>Jobs</TableHead>
                    <TableHead>Avg min</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branchCompare.map((r) => (
                    <TableRow key={r.branch}>
                      <TableCell className="capitalize">{r.branch}</TableCell>
                      <TableCell>{r.count}</TableCell>
                      <TableCell>{r.avg_min ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                  {!branchCompare.length && (
                    <TableRow><TableCell colSpan={3} className="text-muted-foreground">No bookings.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="service" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Per service</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Jobs</TableHead>
                    <TableHead>Avg min</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byService.map((r) => (
                    <TableRow key={r.service_id}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{r.count}</TableCell>
                      <TableCell>{r.avg_min ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                  {!byService.length && (
                    <TableRow><TableCell colSpan={3} className="text-muted-foreground">No service data.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Sales (TL view)</CardTitle>
              <CardDescription>{formatMoney(salesTotal)} across {sales.length} paid sales</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.slice(0, 40).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">{new Date(s.occurred_at).toLocaleString()}</TableCell>
                      <TableCell className="capitalize">{s.branch}</TableCell>
                      <TableCell>{formatMoney(s.total_minor)}</TableCell>
                    </TableRow>
                  ))}
                  {!sales.length && (
                    <TableRow><TableCell colSpan={3} className="text-muted-foreground">No sales.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="complaints" className="mt-4" hidden={!canAccessInquiries(profile)}>
          <Card>
            <CardHeader><CardTitle>Complaints</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {complaints.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm">{new Date(c.created_at).toLocaleString()}</TableCell>
                      <TableCell>{c.customer_name || '—'}</TableCell>
                      <TableCell className="capitalize">{c.branch}</TableCell>
                      <TableCell><Badge variant="secondary">{c.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {!complaints.length && (
                    <TableRow><TableCell colSpan={4} className="text-muted-foreground">No complaints.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  )
}

function formatHoverValue(line) {
  if (line.label === 'Paid sales') return formatMoney(Number(line.value) || 0)
  return line.value
}

function Stat({ label, value, lines = [], hero = false }) {
  const body = (
    <div className={hero ? 'hakum-pos-hero planner-ticket' : 'kpi-stat planner-ticket'}>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  )
  if (!lines.length) return body
  return (
    <Tooltip>
      <TooltipTrigger className="kpi-stat-hover w-full text-left">
        {body}
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="kpi-stat-pop">
        <p className="kpi-stat-pop-title">{label}</p>
        <dl>
          {lines.map((line) => (
            <div key={line.label}>
              <dt>{line.label}</dt>
              <dd>{formatHoverValue(line)}</dd>
            </div>
          ))}
        </dl>
      </TooltipContent>
    </Tooltip>
  )
}
