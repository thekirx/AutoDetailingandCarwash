import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AttendanceHeatmap } from '@/components/ui/attendance-heatmap'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { canEditAttendanceSettings, canOverrideAttendance, getBranchScopeList, isSuperAdmin } from '@/auth/permissions'
import {
  buildAttendanceHeatmap,
  buildAttendanceTableRows,
  combineLocalDateAndTime,
  isoToLocalHhmm,
  shiftTimeToLabel,
} from '@/lib/attendanceGeo'
import { supabase } from '@/lib/supabase'
import {
  adminOverrideAttendance,
  fetchAttendanceMatrix,
  fetchBranchAttendanceSettings,
  geoTimeIn,
  geoTimeOut,
  readBrowserPosition,
  updateBranchAttendanceSettings,
} from '@/queue/attendanceApi'
import { fetchBranches } from '@/queue/queueApi'

function fmtTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

function statusBadge(status) {
  if (status === 'present') return 'text-emerald-700 dark:text-emerald-300'
  if (status === 'late') return 'text-amber-700 dark:text-amber-300'
  if (status === 'absent') return 'text-red-700 dark:text-red-300'
  return 'text-muted-foreground'
}

export function CrewAttendancePanel({ profile, canManage }) {
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
  const canOverride = canOverrideAttendance(profile)
  const scope = getBranchScopeList(profile)

  const load = useCallback(async () => {
    if (!branchSlug) return
    setLoading(true)
    try {
      const { staff: staffRows, attendance: attRows, range } = await fetchAttendanceMatrix({ branchSlug, period })
      setStaff(staffRows)
      setAttendance(attRows)
      setDates(range.dates)
      if (profile?.id) {
        const today = new Date().toISOString().slice(0, 10)
        setMyToday(attRows.find((r) => r.staff_id === profile.id && r.attendance_date === today) || null)
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [branchSlug, period, profile?.id])

  useEffect(() => {
    fetchBranches()
      .then((rows) => {
        setBranches(rows || [])
        setBranchSlug((cur) => {
          if (cur) return cur
          if (scope === null) return rows[0]?.slug || ''
          return scope?.[0] || profile?.branch_slug || rows[0]?.slug || ''
        })
      })
      .catch((err) => toast.error(err.message))
  }, [profile?.branch_slug, scope])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!branchSlug) return undefined
    const channel = supabase
      .channel(`attendance-table:${branchSlug}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_attendance' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [branchSlug, load])

  const matrix = useMemo(() => buildAttendanceHeatmap(staff, attendance, dates), [staff, attendance, dates])
  const tableRows = useMemo(() => buildAttendanceTableRows(staff, attendance, dates), [staff, attendance, dates])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tableRows.filter((r) => {
      if (statusFilter === 'recorded' && !r.status) return false
      if (statusFilter === 'empty' && r.status) return false
      if (statusFilter !== 'all' && statusFilter !== 'recorded' && statusFilter !== 'empty' && r.status !== statusFilter) {
        return false
      }
      if (!q) return true
      return r.name.toLowerCase().includes(q) || r.username.toLowerCase().includes(q) || r.date.includes(q)
    })
  }, [tableRows, search, statusFilter])

  const branchOptions = useMemo(() => {
    if (scope === null) return branches
    const allowed = new Set(scope || [])
    return branches.filter((b) => allowed.has(b.slug))
  }, [branches, scope])

  const runGeo = async (kind) => {
    setBusy(kind)
    try {
      const coords = await readBrowserPosition()
      if (kind === 'in') {
        const res = await geoTimeIn({ profile, coords })
        toast.success(`Timed in (${res.status}) · ${res.distanceM}m from branch`)
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
    const cell = payload.cell || {
      date: payload.date,
      status: payload.status,
      row: payload.row,
    }
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
    <div className="mt-5 flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Geofenced time clock</CardTitle>
            <CardDescription>
              Time in inside the branch radius. Late is flagged vs shift start. Live for Team Lead and floor.
            </CardDescription>
            {myToday && (
              <p className={`mt-2 text-sm font-medium capitalize ${statusBadge(myToday.status)}`}>
                Today: {myToday.status}
                {myToday.checked_in_at ? ` · in ${fmtTime(myToday.checked_in_at)}` : ''}
                {myToday.checked_out_at ? ` · out ${fmtTime(myToday.checked_out_at)}` : ''}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!!busy} onClick={() => runGeo('in')}>
              {busy === 'in' ? 'Locating…' : 'Time in'}
            </Button>
            <Button type="button" variant="outline" disabled={!!busy} onClick={() => runGeo('out')}>
              {busy === 'out' ? 'Saving…' : 'Time out'}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle>Attendance register</CardTitle>
              <CardDescription>
                Table view for the selected period. Team Lead sees their branch live.
                {canOverride ? ' Click Override to correct a cell.' : ''}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {(canManage || isSuperAdmin(profile) || scope === null) && (
                <select
                  value={branchSlug}
                  onChange={(e) => setBranchSlug(e.target.value)}
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {branchOptions.map((b) => (
                    <option key={b.slug} value={b.slug}>{b.name}</option>
                  ))}
                </select>
              )}
              {['daily', 'weekly', 'monthly'].map((key) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={period === key ? 'default' : 'outline'}
                  className="capitalize"
                  onClick={() => setPeriod(key)}
                >
                  {key}
                </Button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="att-search">Search</Label>
              <Input
                id="att-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Staff name, username, or date…"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="att-status">Status</Label>
              <select
                id="att-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex h-9 min-w-[9rem] rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="all">All rows</option>
                <option value="recorded">Recorded only</option>
                <option value="empty">Missing only</option>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
              </select>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowHeatmap((v) => !v)}>
              {showHeatmap ? 'Hide heatmap' : 'Show heatmap'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {showHeatmap && !loading && (
            <AttendanceHeatmap
              matrix={matrix}
              dates={dates}
              period={period}
              canOverride={canOverride}
              onCellClick={(payload) => openOverride(payload)}
            />
          )}

          <div>
            <p className="mb-3 text-sm font-medium text-muted-foreground">
              {loading ? 'Loading…' : `${filteredRows.length} row${filteredRows.length === 1 ? '' : 's'}`}
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check in</TableHead>
                  <TableHead>Check out</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {!loading && filteredRows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      {row.username ? <div className="text-xs text-muted-foreground">@{row.username}</div> : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{row.date}</TableCell>
                    <TableCell className={`capitalize font-medium ${statusBadge(row.status)}`}>
                      {row.status || '—'}
                    </TableCell>
                    <TableCell>{fmtTime(row.checked_in_at)}</TableCell>
                    <TableCell>{fmtTime(row.checked_out_at)}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{row.source || '—'}</TableCell>
                    <TableCell>
                      {canOverride ? (
                        <Button size="sm" variant="secondary" onClick={() => openOverride(row)}>
                          Override
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && !filteredRows.length && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      No attendance rows match this search/filter.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {override && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader>
              <CardTitle>Override attendance</CardTitle>
              <CardDescription>
                {override.name} · {override.cell.date}
                {override.cell.status ? ` · current: ${override.cell.status}` : ' · no record'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <div className="flex flex-wrap gap-2">
                  {['present', 'late', 'absent'].map((status) => (
                    <Button
                      key={status}
                      type="button"
                      variant={override.status === status ? 'default' : 'outline'}
                      className="capitalize"
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
                    value={override.timeOut}
                    onChange={(e) => setOverride((o) => ({ ...o, timeOut: e.target.value }))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave a time blank to clear that clock. Absent clears time in.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={busy === 'override'} onClick={saveOverride}>
                  {busy === 'override' ? 'Saving…' : 'Save override'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setOverride(null)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export function CrewSettingsPanel({ profile }) {
  const canEdit = canEditAttendanceSettings(profile)
  const [branches, setBranches] = useState([])
  const [slug, setSlug] = useState(profile?.branch_slug || '')
  const [form, setForm] = useState({ geofence_radius_m: 150, shift_start: '08:00', shift_end: '18:00' })
  const [meta, setMeta] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (nextSlug) => {
    if (!nextSlug) return
    const row = await fetchBranchAttendanceSettings(nextSlug)
    setMeta(row)
    setForm({
      geofence_radius_m: row?.geofence_radius_m ?? 150,
      shift_start: shiftTimeToLabel(row?.shift_start) || '08:00',
      shift_end: shiftTimeToLabel(row?.shift_end) || '18:00',
    })
  }, [])

  useEffect(() => {
    fetchBranches()
      .then((rows) => {
        setBranches(rows || [])
        const first = profile?.branch_slug || rows[0]?.slug || ''
        setSlug((s) => s || first)
      })
      .catch((err) => toast.error(err.message))
  }, [profile?.branch_slug])

  useEffect(() => {
    if (slug) load(slug).catch((err) => toast.error(err.message))
  }, [slug, load])

  if (!canEdit) {
    return (
      <Card className="mt-5">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Only Admin / Super Admin / Assistant Super Admin (branches grant) can edit geofence and shifts.
          Team Lead can view attendance on the Attendance tab.
        </CardContent>
      </Card>
    )
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateBranchAttendanceSettings(slug, {
        geofence_radius_m: Number(form.geofence_radius_m),
        shift_start: form.shift_start,
        shift_end: form.shift_end,
      })
      toast.success('Attendance settings saved')
      await load(slug)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="mt-5">
      <CardHeader>
        <CardTitle>Attendance settings</CardTitle>
        <CardDescription>Geofence radius and shift window per branch. Staff time-in uses the branch map pin.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid max-w-xl gap-4">
          <div className="grid gap-2">
            <Label>Branch</Label>
            <select value={slug} onChange={(e) => setSlug(e.target.value)} className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm">
              {branches.map((b) => (
                <option key={b.slug} value={b.slug}>{b.name}</option>
              ))}
            </select>
          </div>
          {meta && (
            <p className="text-xs text-muted-foreground">
              Pin: {meta.latitude != null ? `${meta.latitude}, ${meta.longitude}` : 'missing — set in Branches first'}
            </p>
          )}
          <div className="grid gap-2">
            <Label>Geofence radius (meters)</Label>
            <Input
              type="number"
              min={30}
              max={5000}
              required
              value={form.geofence_radius_m}
              onChange={(e) => setForm((f) => ({ ...f, geofence_radius_m: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Shift start</Label>
              <Input type="time" required value={form.shift_start} onChange={(e) => setForm((f) => ({ ...f, shift_start: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Shift end</Label>
              <Input type="time" required value={form.shift_end} onChange={(e) => setForm((f) => ({ ...f, shift_end: e.target.value }))} />
            </div>
          </div>
          <Button type="submit" disabled={saving} className="w-fit">
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
