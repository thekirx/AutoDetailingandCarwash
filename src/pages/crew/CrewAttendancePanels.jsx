import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  MapPin,
  Search,
  UserCheck,
  UserX,
  Wallet,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import { AttendanceHeatmap } from '@/components/ui/attendance-heatmap'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { NamedSelect } from '@/components/ui/named-select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  canEditAttendanceRoles,
  canEditAttendanceSettings,
  canOverrideAttendance,
  canViewOwnPay,
  getBranchScopeList,
  isAdmin,
  isSuperAdmin,
} from '@/auth/permissions'
import {
  ATTENDANCE_ROLE_OPTIONS,
  attendanceRoleLabel,
  DEFAULT_ATTENDANCE_ROLES,
} from '@/lib/attendanceRoles'
import {
  buildAttendanceHeatmap,
  buildAttendanceTableRows,
  combineLocalDateAndTime,
  isoToLocalHhmm,
  shiftTimeToLabel,
} from '@/lib/attendanceGeo'
import {
  buildAttendancePayrollPreview,
  registerFloorStats,
  summarizePeriodAttendance,
  summarizeTodayAttendance,
} from '@/lib/attendanceInsights'
import { createCoalescedReload } from '@/lib/coalesceReload'
import {
  DEFAULT_COMPENSATION_RULES,
  demoWashPoolSplit,
  LATE_PAY_SHARE_PRESETS,
  latePaySharePercent,
  latePayWeightFromPercent,
  normalizeCompensationSettings,
  toCompensationSettingsRow,
} from '@/lib/compensation'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import { supabase } from '@/lib/supabase'
import { attendanceRowsToCsv, downloadTextFile } from '@/lib/attendanceExport'
import {
  adminOverrideAttendance,
  applyNetworkAttendanceSettings,
  fetchAttendanceMatrix,
  fetchAttendanceRoleSettings,
  fetchBranchAttendanceSettings,
  fetchCrewFloorSnapshot,
  geoTimeIn,
  geoTimeOut,
  readBrowserPosition,
  resetAttendanceRoleSettings,
  updateAttendanceRoleSettings,
} from '@/queue/attendanceApi'
import { fetchBranches, formatMoney } from '@/queue/queueApi'
import { filterBranchesForProfile, pickDefaultBranchSlug } from '@/queue/queueLogic'
import { collectPaged } from '@/lib/crmInsights'
import { buildCompensationPostPlan } from '@/lib/compensation'

const ATTENDANCE_PAGE_SIZE = 25

function fmtTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

function AttendanceStatusBadge({ status }) {
  if (!status) return <Badge variant="outline">No record</Badge>
  if (status === 'present') return <Badge className="bg-emerald-600/90 hover:bg-emerald-600/90">Present</Badge>
  if (status === 'late') return <Badge className="bg-amber-500/90 text-amber-950 hover:bg-amber-500/90">Late</Badge>
  if (status === 'absent') return <Badge variant="destructive">Absent</Badge>
  return <Badge variant="secondary">{status}</Badge>
}

function StatTile({ label, value, detail, icon: Icon }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
        {Icon ? <Icon className="size-4 text-primary" aria-hidden /> : null}
      </div>
      <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  )
}

function RegisterSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((n) => (
          <Skeleton key={n} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )
}

export function CrewAttendancePanel({ profile, canManage, showClock = true, showRegister = true }) {
  const [period, setPeriod] = useState('weekly')
  const [branchSlug, setBranchSlug] = useState(profile?.branch_slug || '')
  const [branches, setBranches] = useState([])
  const [staff, setStaff] = useState([])
  const [attendance, setAttendance] = useState([])
  const [dates, setDates] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [override, setOverride] = useState(null)
  const [myToday, setMyToday] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(ATTENDANCE_PAGE_SIZE)
  const [myPayMinor, setMyPayMinor] = useState(null)
  const [crewFloor, setCrewFloor] = useState(null)
  const [compRules, setCompRules] = useState(DEFAULT_COMPENSATION_RULES)
  const canOverride = canOverrideAttendance(profile)
  const scope = getBranchScopeList(profile)
  const today = getLocalCalendarDate()
  const showPayPreview = showRegister && (canManage || isSuperAdmin(profile))

  const load = useCallback(async () => {
    if (!branchSlug) {
      setStaff([])
      setAttendance([])
      setDates([])
      setCrewFloor(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [matrixRes, floorRes, rulesRes] = await Promise.all([
        fetchAttendanceMatrix({ branchSlug, period }),
        showRegister ? fetchCrewFloorSnapshot(branchSlug).catch(() => null) : Promise.resolve(null),
        showPayPreview
          ? supabase.from('compensation_settings').select('*').eq('id', 1).maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      const { staff: staffRows, attendance: attRows, range } = matrixRes
      setStaff(staffRows)
      setAttendance(attRows)
      setDates(range.dates)
      setCrewFloor(floorRes)
      if (rulesRes?.data) setCompRules(normalizeCompensationSettings(rulesRes.data))

      if (canViewOwnPay(profile) && profile?.id) {
        setMyToday(attRows.find((r) => r.staff_id === profile.id && r.attendance_date === today) || null)
        const startIso = `${today}T00:00:00+08:00`
        const endIso = `${today}T23:59:59.999+08:00`
        const sales = await collectPaged(async (from, to) => {
          const { data, error } = await supabase
            .from('sales')
            .select('id, branch, total_minor, sale_line_items(line_total_minor, services(pay_category))')
            .eq('status', 'paid')
            .eq('branch', branchSlug)
            .gte('occurred_at', startIso)
            .lte('occurred_at', endIso)
            .order('occurred_at', { ascending: false })
            .range(from, to)
          if (error) throw error
          return data || []
        }, 1000)
        const roster = staffRows.map((member) => {
          const rec = attRows.find((r) => r.staff_id === member.id && r.attendance_date === today)
          return {
            ...member,
            attendance_status: rec?.status,
            branch_slug: member.branch_slug || branchSlug,
          }
        })
        const plan = buildCompensationPostPlan({
          date: today,
          salesRows: sales,
          roster,
          poolPct: normalizeCompensationSettings(rulesRes?.data).wash_pool_pct,
          branchFilter: branchSlug,
        })
        const mine = plan.rows.find((row) => row.id === profile.id || row.staff_id === profile.id)
        setMyPayMinor(mine ? mine.pay_minor : null)
      } else {
        setMyPayMinor(null)
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [branchSlug, period, profile, showRegister, showPayPreview, today])

  useEffect(() => {
    fetchBranches()
      .then((rows) => {
        setBranches(rows || [])
        setBranchSlug((cur) => {
          if (cur) return cur
          if (scope === null) return rows[0]?.slug || ''
          if (Array.isArray(scope) && scope.length) return scope[0]
          return profile?.branch_slug || ''
        })
      })
      .catch((err) => toast.error(err.message))
  }, [profile?.branch_slug, scope])

  const loadRef = useRef(load)
  loadRef.current = load
  const scheduleReload = useMemo(() => createCoalescedReload(() => loadRef.current(), 400), [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!branchSlug) return undefined
    const channel = supabase
      .channel(`attendance-table:${branchSlug}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_attendance' }, scheduleReload)
      .subscribe()
    return () => {
      scheduleReload.cancel()
      supabase.removeChannel(channel)
    }
  }, [branchSlug, scheduleReload])

  const matrix = useMemo(() => buildAttendanceHeatmap(staff, attendance, dates), [staff, attendance, dates])
  const tableRows = useMemo(() => buildAttendanceTableRows(staff, attendance, dates), [staff, attendance, dates])
  const todaySummary = useMemo(() => summarizeTodayAttendance(staff, attendance, today), [staff, attendance, today])
  const periodSummary = useMemo(() => summarizePeriodAttendance(attendance, dates), [attendance, dates])
  const floorStats = useMemo(() => registerFloorStats(crewFloor, staff.length), [crewFloor, staff.length])
  const payPreview = useMemo(
    () => (showPayPreview ? buildAttendancePayrollPreview(staff, attendance, compRules, today) : []),
    [staff, attendance, compRules, today, showPayPreview],
  )

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tableRows.filter((r) => {
      if (statusFilter === 'recorded' && !r.status) return false
      if (statusFilter === 'empty' && r.status) return false
      if (statusFilter !== 'all' && statusFilter !== 'recorded' && statusFilter !== 'empty' && r.status !== statusFilter) {
        return false
      }
      if (!q) return true
      const roleText = attendanceRoleLabel(r.role).toLowerCase()
      return (
        r.name.toLowerCase().includes(q)
        || r.username.toLowerCase().includes(q)
        || r.date.includes(q)
        || roleText.includes(q)
      )
    })
  }, [tableRows, search, statusFilter])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, period, branchSlug, pageSize])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * pageSize
  const pagedRows = filteredRows.slice(pageStart, pageStart + pageSize)

  const branchOptions = useMemo(() => {
    if (scope === null) return branches
    const allowed = new Set(scope || [])
    return branches.filter((b) => allowed.has(b.slug))
  }, [branches, scope])

  const branchLabel = branchOptions.find((b) => b.slug === branchSlug)?.name || branchSlug

  const runGeo = async (kind) => {
    setBusy(kind)
    try {
      const coords = await readBrowserPosition()
      if (kind === 'in') {
        const res = await geoTimeIn({ profile, coords, branchSlug })
        toast.success(
          profile?.geofence_enabled === false
            ? `Timed in (${res.status})`
            : `Timed in (${res.status}) · ${res.distanceM}m from branch`,
        )
      } else {
        await geoTimeOut({ profile, coords })
        toast.success('Timed out')
      }
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy('')
    }
  }

  const openOverride = (payload) => {
    if (!canOverride) return
    const cell = payload.cell || { date: payload.date, status: payload.status, row: payload.row }
    const record = cell.row || payload
    setOverride({
      staffId: payload.staffId,
      name: payload.name,
      cell: { date: cell.date, status: cell.status },
      status: cell.status || 'present',
      timeIn: isoToLocalHhmm(record.checked_in_at),
      timeOut: isoToLocalHhmm(record.checked_out_at),
    })
  }

  const saveOverride = async () => {
    if (!override) return
    const status = override.status || 'present'
    setBusy('override')
    try {
      const present = status === 'present' || status === 'late'
      await adminOverrideAttendance({
        staffId: override.staffId,
        branchSlug,
        date: override.cell.date,
        status,
        profile,
        checkedInAt: present ? combineLocalDateAndTime(override.cell.date, override.timeIn) : null,
        checkedOutAt: combineLocalDateAndTime(override.cell.date, override.timeOut),
      })
      toast.success(`Set ${override.name} → ${status}`)
      setOverride(null)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {showClock ? (
        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="gap-4 pb-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl">
              <CardTitle className="text-lg tracking-tight">Geofenced time clock</CardTitle>
              <CardDescription className="mt-1.5 leading-relaxed">
                Time in inside the branch radius. Late is flagged against shift start. You must be present or late before
                a Team Lead can assign you from Queue or Crew.
              </CardDescription>
              {myToday ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">Today</span>
                  <AttendanceStatusBadge status={myToday.status} />
                  {myToday.checked_in_at ? (
                    <span className="font-mono text-sm tabular-nums text-muted-foreground">
                      in {fmtTime(myToday.checked_in_at)}
                      {myToday.checked_out_at ? ` · out ${fmtTime(myToday.checked_out_at)}` : ''}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {canViewOwnPay(profile) && myPayMinor != null ? (
                <p className="mt-3 text-sm text-foreground">
                  <Wallet className="mr-1 inline size-4 text-primary" aria-hidden />
                  Wash pool estimate today — {formatMoney(myPayMinor)} unpaid
                  {' · '}
                  <Link className="font-medium text-primary underline-offset-4 hover:underline" to="/operations/my-pay">
                    Posted payouts
                  </Link>
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="min-h-11 min-w-[7.5rem]" disabled={!!busy} onClick={() => runGeo('in')}>
                {busy === 'in' ? 'Locating…' : 'Time in'}
              </Button>
              <Button type="button" variant="outline" className="min-h-11 min-w-[7.5rem]" disabled={!!busy} onClick={() => runGeo('out')}>
                {busy === 'out' ? 'Saving…' : 'Time out'}
              </Button>
            </div>
          </CardHeader>
        </Card>
      ) : null}

      {showRegister ? (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Attendance register</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {branchLabel}
                {' · '}
                {staff.length ? `${staff.length} people on roster` : 'No roster for this branch'}
                {canOverride ? ' · tap heatmap or Override to correct a row' : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              {(canManage || isSuperAdmin(profile) || scope === null) && branchOptions.length ? (
                <div className="min-w-[12rem] flex-1 sm:flex-none">
                  <Label htmlFor="att-branch" className="sr-only">
                    Branch
                  </Label>
                  <NamedSelect
                    id="att-branch"
                    value={branchSlug}
                    onChange={setBranchSlug}
                    options={branchOptions.map((b) => ({ value: b.slug, label: b.name }))}
                    className="min-h-11"
                  />
                </div>
              ) : null}
              <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/40 p-1">
                {['daily', 'weekly', 'monthly'].map((key) => (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    className="min-h-10 capitalize"
                    variant={period === key ? 'default' : 'ghost'}
                    onClick={() => setPeriod(key)}
                  >
                    {key}
                  </Button>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-10 gap-1.5"
                disabled={!filteredRows.length}
                onClick={() => {
                  const csv = attendanceRowsToCsv(filteredRows)
                  downloadTextFile(`attendance-${branchSlug || 'branch'}-${today}.csv`, csv)
                  toast.success(`Exported ${filteredRows.length} row(s)`)
                }}
              >
                <Download data-icon="inline-start" aria-hidden />
                Export CSV
              </Button>
            </div>
          </div>

          {loading ? (
            <RegisterSkeleton />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile
                  label="On site today"
                  value={todaySummary.onSite}
                  detail={`${todaySummary.present} present · ${todaySummary.late} late`}
                  icon={UserCheck}
                />
                <StatTile
                  label="Assignable crew"
                  value={floorStats.assignable}
                  detail="Present/late and not on a job"
                  icon={Wrench}
                />
                <StatTile
                  label="On jobs"
                  value={floorStats.onJobs}
                  detail="Busy on active queue tickets"
                  icon={MapPin}
                />
                <StatTile
                  label="Period recorded"
                  value={periodSummary.recorded}
                  detail={`${periodSummary.present} present · ${periodSummary.late} late · ${periodSummary.absent} absent`}
                  icon={UserX}
                />
              </div>

              {crewFloor && (crewFloor.availableStaff?.length || crewFloor.absentStaff?.length) ? (
                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle className="text-base">Crew floor · today</CardTitle>
                        <CardDescription>
                          Only present or late bay crew can be assigned. Blocked staff cannot receive queue jobs.
                        </CardDescription>
                      </div>
                      <Button type="button" variant="outline" className="min-h-11" asChild>
                        <Link to="/operations/crew">Open crew pool</Link>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Ready ({crewFloor.availableStaff?.length || 0})
                      </p>
                      <ul className="flex flex-col gap-2">
                        {(crewFloor.availableStaff || []).slice(0, 8).map((row) => (
                          <li
                            key={row.staff_id}
                            className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-3 py-2 text-sm"
                          >
                            <span className="font-medium">{row.full_name}</span>
                            <Badge variant="secondary">Assignable</Badge>
                          </li>
                        ))}
                        {!crewFloor.availableStaff?.length ? (
                          <li className="text-sm text-muted-foreground">No deployable crew right now.</li>
                        ) : null}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Blocked ({crewFloor.absentStaff?.length || 0})
                      </p>
                      <ul className="flex flex-col gap-2">
                        {(crewFloor.absentStaff || []).slice(0, 8).map((row) => (
                          <li
                            key={row.staff_id}
                            className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-sm"
                          >
                            <span>{row.full_name}</span>
                            <AttendanceStatusBadge status={row.attendance_status === 'not_checked_in' ? null : row.attendance_status} />
                          </li>
                        ))}
                        {!crewFloor.absentStaff?.length ? (
                          <li className="text-sm text-muted-foreground">Everyone on roster is timed in.</li>
                        ) : null}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {showPayPreview && payPreview.length ? (
                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Today&apos;s wash pool share</CardTitle>
                    <CardDescription>
                      On-time crew split the day&apos;s wash pool equally. Late crew still earn{' '}
                      {latePaySharePercent(compRules)}% of an on-time share. No clock-in or absent = no pay.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Person</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Pool share</TableHead>
                          <TableHead>Can assign?</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payPreview.map((row) => (
                          <TableRow key={row.staffId}>
                            <TableCell>
                              <div className="font-medium">{row.name}</div>
                              <div className="text-xs text-muted-foreground">{attendanceRoleLabel(row.role)}</div>
                            </TableCell>
                            <TableCell>
                              <AttendanceStatusBadge status={row.status} />
                            </TableCell>
                            <TableCell className="font-mono tabular-nums">{row.weightLabel}</TableCell>
                            <TableCell>
                              {row.assignable ? (
                                <Badge variant="secondary">Allowed</Badge>
                              ) : (
                                <Badge variant="outline">Blocked</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : null}

              <Card className="border-border/80 shadow-sm">
                <CardHeader className="gap-4 pb-3">
                  <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="att-search">Search</Label>
                      <InputGroup className="min-h-11">
                        <InputGroupAddon>
                          <Search aria-hidden />
                        </InputGroupAddon>
                        <InputGroupInput
                          id="att-search"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Name, role, username, or date…"
                        />
                      </InputGroup>
                    </div>
                    <div className="flex min-w-[10rem] flex-col gap-2">
                      <Label htmlFor="att-status">Status</Label>
                      <NamedSelect
                        id="att-status"
                        value={statusFilter}
                        onChange={setStatusFilter}
                        options={[
                          { value: 'all', label: 'All rows' },
                          { value: 'recorded', label: 'Recorded only' },
                          { value: 'empty', label: 'Missing only' },
                          { value: 'present', label: 'Present' },
                          { value: 'late', label: 'Late' },
                          { value: 'absent', label: 'Absent' },
                        ]}
                        className="min-h-11"
                      />
                    </div>
                    <Button type="button" variant="ghost" className="min-h-11" onClick={() => setShowHeatmap((v) => !v)}>
                      {showHeatmap ? 'Hide heatmap' : 'Show heatmap'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {showHeatmap ? (
                    <AttendanceHeatmap
                      matrix={matrix}
                      dates={dates}
                      period={period}
                      canOverride={canOverride}
                      onCellClick={(payload) => openOverride(payload)}
                    />
                  ) : null}

                  <Separator />

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      {filteredRows.length === 0
                        ? '0 rows'
                        : `Showing ${pageStart + 1}–${Math.min(pageStart + pageSize, filteredRows.length)} of ${filteredRows.length}`}
                    </p>
                    <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      Rows
                      <NamedSelect
                        value={String(pageSize)}
                        onChange={(v) => setPageSize(Number(v))}
                        options={[10, 25, 50, 100].map((n) => ({ value: String(n), label: String(n) }))}
                        className="h-9 w-20"
                      />
                    </label>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-border/70">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Person</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Check in</TableHead>
                          <TableHead>Check out</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedRows.map((row) => (
                          <TableRow key={row.key}>
                            <TableCell>
                              <div className="font-medium">{row.name}</div>
                              {row.username ? <div className="text-xs text-muted-foreground">@{row.username}</div> : null}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {attendanceRoleLabel(row.role)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap font-mono text-sm tabular-nums">{row.date}</TableCell>
                            <TableCell>
                              <AttendanceStatusBadge status={row.status} />
                            </TableCell>
                            <TableCell className="font-mono text-sm tabular-nums">{fmtTime(row.checked_in_at)}</TableCell>
                            <TableCell className="font-mono text-sm tabular-nums">{fmtTime(row.checked_out_at)}</TableCell>
                            <TableCell className="capitalize text-muted-foreground">{row.source || '—'}</TableCell>
                            <TableCell>
                              {canOverride ? (
                                <Button size="sm" variant="secondary" className="min-h-9" onClick={() => openOverride(row)}>
                                  Override
                                </Button>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        ))}
                        {!filteredRows.length && (
                          <TableRow>
                            <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                              No attendance rows match this search or filter.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {filteredRows.length > 0 ? (
                    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Attendance pagination">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-10 gap-1"
                        disabled={safePage <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft aria-hidden />
                        Previous
                      </Button>
                      <p className="text-sm font-medium text-muted-foreground">
                        Page <span className="font-mono tabular-nums text-foreground">{safePage}</span> of{' '}
                        <span className="font-mono tabular-nums text-foreground">{totalPages}</span>
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-10 gap-1"
                        disabled={safePage >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Next
                        <ChevronRight aria-hidden />
                      </Button>
                    </nav>
                  ) : null}
                </CardContent>
              </Card>
            </>
          )}
        </>
      ) : null}

      <Dialog open={Boolean(override)} onOpenChange={(open) => !open && setOverride(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Override attendance</DialogTitle>
            <DialogDescription>
              {override?.name} · {override?.cell.date}
              {override?.cell.status ? ` · current: ${override.cell.status}` : ' · no record'}
            </DialogDescription>
          </DialogHeader>
          {override ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <div className="flex flex-wrap gap-2">
                  {['present', 'late', 'absent'].map((status) => (
                    <Button
                      key={status}
                      type="button"
                      variant={override.status === status ? 'default' : 'outline'}
                      className="min-h-10 capitalize"
                      onClick={() => setOverride((o) => ({ ...o, status }))}
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ov-in">Time in</Label>
                  <Input
                    id="ov-in"
                    type="time"
                    className="min-h-11"
                    value={override.timeIn}
                    disabled={override.status === 'absent'}
                    onChange={(e) => setOverride((o) => ({ ...o, timeIn: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ov-out">Time out</Label>
                  <Input
                    id="ov-out"
                    type="time"
                    className="min-h-11"
                    value={override.timeOut}
                    onChange={(e) => setOverride((o) => ({ ...o, timeOut: e.target.value }))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave a time blank to clear that clock. Absent clears time in.
              </p>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setOverride(null)}>
              Cancel
            </Button>
            <Button type="button" className="min-h-11" disabled={busy === 'override'} onClick={saveOverride}>
              {busy === 'override' ? 'Saving…' : 'Save override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function CrewSettingsPanel({ profile }) {
  const canEdit = canEditAttendanceSettings(profile)
  const canRoles = canEditAttendanceRoles(profile)
  const canPayRules = isAdmin(profile)
  const [slug, setSlug] = useState(profile?.branch_slug || '')
  const [form, setForm] = useState({ geofence_radius_m: 20, shift_start: '08:00', shift_end: '18:00' })
  const [meta, setMeta] = useState(null)
  const [saving, setSaving] = useState(false)
  const [roleDraft, setRoleDraft] = useState([...DEFAULT_ATTENDANCE_ROLES])
  const [rolesLoading, setRolesLoading] = useState(false)
  const [rolesSaving, setRolesSaving] = useState(false)
  const [payRules, setPayRules] = useState(DEFAULT_COMPENSATION_RULES)
  const [paySaving, setPaySaving] = useState(false)

  const load = useCallback(async (nextSlug) => {
    if (!nextSlug) return
    const row = await fetchBranchAttendanceSettings(nextSlug)
    setMeta(row)
    setForm({
      geofence_radius_m: row?.geofence_radius_m ?? 20,
      shift_start: shiftTimeToLabel(row?.shift_start) || '08:00',
      shift_end: shiftTimeToLabel(row?.shift_end) || '18:00',
    })
  }, [])

  const loadRoles = useCallback(async () => {
    if (!canRoles) return
    setRolesLoading(true)
    try {
      const roles = await fetchAttendanceRoleSettings()
      setRoleDraft(roles)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setRolesLoading(false)
    }
  }, [canRoles])

  const loadPayRules = useCallback(async () => {
    if (!canPayRules) return
    const { data, error } = await supabase.from('compensation_settings').select('*').eq('id', 1).maybeSingle()
    if (error) toast.error(error.message)
    else setPayRules(normalizeCompensationSettings(data))
  }, [canPayRules])

  useEffect(() => {
    fetchBranches()
      .then((rows) => {
        const scoped = filterBranchesForProfile(rows || [], profile)
        const first = pickDefaultBranchSlug(profile, scoped)
        setSlug((s) => s || first)
      })
      .catch((err) => toast.error(err.message))
  }, [profile])

  useEffect(() => {
    if (slug && canEdit) load(slug).catch((err) => toast.error(err.message))
  }, [slug, load, canEdit])

  useEffect(() => {
    loadRoles()
  }, [loadRoles])

  useEffect(() => {
    loadPayRules()
  }, [loadPayRules])

  if (!canEdit && !canRoles && !canPayRules) {
    return (
      <Card className="border-border/80 shadow-sm">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Only Super Admin can set network geofence, shifts, roles, and pay weights. Branch Admin can override rows on
          the Register tab.
        </CardContent>
      </Card>
    )
  }

  const toggleRole = (value) => {
    setRoleDraft((prev) => (prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]))
  }

  const saveRoles = async () => {
    setRolesSaving(true)
    try {
      const next = await updateAttendanceRoleSettings(roleDraft, profile)
      setRoleDraft(next)
      toast.success('Attendance roles saved')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setRolesSaving(false)
    }
  }

  const resetRoles = async () => {
    setRolesSaving(true)
    try {
      const next = await resetAttendanceRoleSettings(profile)
      setRoleDraft(next)
      toast.success('Attendance roles reset to defaults')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setRolesSaving(false)
    }
  }

  const savePayRules = async (e) => {
    e.preventDefault()
    if (!canPayRules) return
    setPaySaving(true)
    const lateWeight = latePayWeightFromPercent(latePaySharePercent(payRules))
    const row = toCompensationSettingsRow({
      ...payRules,
      attendance_present_weight: 1,
      attendance_late_weight: lateWeight,
    })
    const { error } = await supabase.from('compensation_settings').upsert(row, { onConflict: 'id' })
    setPaySaving(false)
    if (error) toast.error(error.message)
    else {
      setPayRules((r) => ({ ...r, attendance_present_weight: 1, attendance_late_weight: lateWeight }))
      toast.success('Late pay policy saved')
    }
  }

  const latePercent = latePaySharePercent(payRules)
  const payDemo = demoWashPoolSplit({
    poolMinor: 1_000_000,
    onTimeCount: 2,
    lateCount: 1,
    lateWeight: latePayWeightFromPercent(latePercent),
  })

  const setLatePercent = (percent) => {
    setPayRules((r) => ({
      ...r,
      attendance_present_weight: 1,
      attendance_late_weight: latePayWeightFromPercent(percent),
    }))
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const result = await applyNetworkAttendanceSettings(
        {
          geofence_radius_m: Number(form.geofence_radius_m),
          shift_start: form.shift_start,
          shift_end: form.shift_end,
        },
        profile,
      )
      toast.success(`Applied to ${result.updated} branches (same geofence and shifts network-wide)`)
      if (slug) await load(slug)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {canPayRules ? (
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle>Late arrival pay</CardTitle>
            <CardDescription>
              Controls how much of the daily wash pool a late crew member receives. They still get paid and can still be
              assigned — only absent or no clock-in earns nothing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={savePayRules} className="flex max-w-2xl flex-col gap-5">
              <fieldset className="grid gap-2 sm:grid-cols-2">
                <legend className="mb-2 text-sm font-medium">If a crew member clocks in late, they receive…</legend>
                {LATE_PAY_SHARE_PRESETS.map((preset) => {
                  const active = latePercent === preset.percent
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setLatePercent(preset.percent)}
                      className={`flex min-h-11 flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-left text-sm transition active:scale-[0.99] ${
                        active
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-border bg-card hover:bg-muted/40'
                      }`}
                    >
                      <span className="font-semibold text-foreground">{preset.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {preset.percent}% of on-time share · {preset.hint}
                      </span>
                    </button>
                  )
                })}
              </fieldset>

              <div className="flex flex-col gap-2">
                <Label htmlFor="late-custom">Custom late share (%)</Label>
                <Input
                  id="late-custom"
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  className="max-w-[8rem] min-h-11 font-mono tabular-nums"
                  value={latePercent}
                  onChange={(e) => setLatePercent(Number(e.target.value))}
                />
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm">
                <p className="font-medium text-foreground">Example with {formatMoney(payDemo.poolMinor)} wash pool</p>
                <p className="mt-1 text-muted-foreground">2 on time + 1 late at {latePercent}%:</p>
                <ul className="mt-2 flex flex-col gap-1 font-mono text-sm tabular-nums">
                  <li>On time → {formatMoney(payDemo.perOnTimeMinor)} each</li>
                  <li>Late → {formatMoney(payDemo.perLateMinor)}</li>
                </ul>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  On-time crew always receive 100% of their fair share. Pool % and ceramic splits live under Payroll.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" className="min-h-11" disabled={paySaving}>
                  {paySaving ? 'Saving…' : 'Save late pay policy'}
                </Button>
                <Button type="button" variant="outline" className="min-h-11" asChild>
                  <Link to="/operations/settings/payroll">More payroll settings</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {canRoles ? (
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle>Attendance roles</CardTitle>
            <CardDescription>
              Choose which employee roles appear on the register and heatmap. Defaults: Staff, Team Lead, Branch Admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid max-w-xl gap-4">
            {rolesLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-11 rounded-xl" />
                <Skeleton className="h-11 rounded-xl" />
                <Skeleton className="h-11 rounded-xl" />
              </div>
            ) : (
              <fieldset className="grid gap-2">
                <legend className="sr-only">Employee roles for attendance</legend>
                {ATTENDANCE_ROLE_OPTIONS.map((opt) => {
                  const checked = roleDraft.includes(opt.value)
                  return (
                    <label
                      key={opt.value}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium transition hover:bg-muted/30"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={checked}
                        onChange={() => toggleRole(opt.value)}
                      />
                      <span>{opt.label}</span>
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground">{opt.value}</span>
                    </label>
                  )
                })}
              </fieldset>
            )}
            <p className="text-xs text-muted-foreground">Selected: {roleDraft.length || 0}. At least one role required.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="min-h-11" disabled={rolesSaving || rolesLoading} onClick={saveRoles}>
                {rolesSaving ? 'Saving…' : 'Save roles'}
              </Button>
              <Button type="button" variant="outline" className="min-h-11" disabled={rolesSaving || rolesLoading} onClick={resetRoles}>
                Reset defaults
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canEdit ? (
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle>Network geofence and shifts</CardTitle>
            <CardDescription>
              Same radius and shift hours for every branch. Map pins stay per branch under Branches. Crew must time in
              inside the radius before queue assignment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="grid max-w-xl gap-4">
              {slug && meta ? (
                <p className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  Preview from {meta.name || slug}: pin{' '}
                  {meta.latitude != null ? `${meta.latitude}, ${meta.longitude}` : 'missing — set in Branches first'}
                </p>
              ) : null}
              <div className="flex flex-col gap-2">
                <Label htmlFor="geo-radius">Geofence radius (meters)</Label>
                <Input
                  id="geo-radius"
                  type="number"
                  min={20}
                  max={5000}
                  required
                  className="min-h-11 font-mono tabular-nums"
                  value={form.geofence_radius_m}
                  onChange={(e) => setForm((f) => ({ ...f, geofence_radius_m: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Shop floor default is 20m. Saving applies to all branches.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="shift-start">Shift start</Label>
                  <Input
                    id="shift-start"
                    type="time"
                    required
                    className="min-h-11"
                    value={form.shift_start}
                    onChange={(e) => setForm((f) => ({ ...f, shift_start: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="shift-end">Shift end</Label>
                  <Input
                    id="shift-end"
                    type="time"
                    required
                    className="min-h-11"
                    value={form.shift_end}
                    onChange={(e) => setForm((f) => ({ ...f, shift_end: e.target.value }))}
                  />
                </div>
              </div>
              <Button type="submit" disabled={saving} className="min-h-11 w-fit">
                {saving ? 'Saving…' : 'Apply to all branches'}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
