import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from 'react-big-calendar'
import { format, getDay, parse, startOfWeek } from 'date-fns'
import { enUS } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { useAuth } from '@/auth/AuthProvider'
import {
  canAccessBookingBoard,
  canCreateBookings,
  canEditBookings,
  canSeeAllBranches,
  getBranchScopeList,
} from '@/auth/permissions'
import { listBranches } from '@/lib/adminApi'
import { getAccessTokenFresh } from '@/lib/authToken'
import { applyBranchScope } from '@/lib/crmInsights'
import { supabase } from '@/lib/supabase'
import { getDashboardDateRange, requiresTeamLeadBranchSetup, resolveBranchFilter } from '@/queue/queueLogic'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

const BOOKING_TABS = ['board', 'table', 'calendar']
const COLUMNS = [
  { id: 'pending', label: 'New' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'completed', label: 'Done' },
  { id: 'cancelled', label: 'Cancelled' },
]

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { 'en-US': enUS },
})

const emptyBooking = {
  customer_name: '',
  customer_phone: '',
  branch: '',
  scheduled_start: '',
  vehicle_plate: '',
  vehicle_make: '',
  vehicle_model: '',
  notes: '',
  status: 'pending',
}

function todayISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
}

export default function BookingBoardPage() {
  const { profile } = useAuth()
  const canEdit = canEditBookings(profile)
  const canCreate = canCreateBookings(profile)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = BOOKING_TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'board'
  const [bookings, setBookings] = useState([])
  const [branches, setBranches] = useState([])
  const [branchFilter, setBranchFilter] = useState(canSeeAllBranches(profile) ? 'all' : (getBranchScopeList(profile)?.[0] || 'all'))
  const [datePreset, setDatePreset] = useState('week')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyBooking)
  const [saving, setSaving] = useState(false)

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

  const branchScope = useMemo(() => resolveBranchFilter(profile, branchFilter), [profile, branchFilter])

  const load = useCallback(async () => {
    const startIso = `${range.start}T00:00:00+08:00`
    const endIso = `${range.end}T23:59:59.999+08:00`
    let query = supabase
      .from('bookings')
      .select('id, customer_name, customer_phone, branch, status, scheduled_start, scheduled_end, assigned_staff_id, notes, vehicle_make, vehicle_model, vehicle_plate, service_id')
      .eq('is_archived', false)
      .gte('scheduled_start', startIso)
      .lte('scheduled_start', endIso)
      .order('scheduled_start', { ascending: true })
      .limit(400)
    query = applyBranchScope(query, branchScope)
    const { data, error } = await query
    if (error) toast.error(error.message)
    setBookings(data || [])
  }, [branchScope, range.start, range.end])

  useEffect(() => {
    listBranches().then((rows) => {
      setBranches(rows || [])
      setForm((f) => ({ ...f, branch: f.branch || rows?.[0]?.slug || profile?.branch_slug || '' }))
    }).catch(() => {})
  }, [profile?.branch_slug])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel(`booking-board-${JSON.stringify(branchScope)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [load, branchScope])

  const grouped = useMemo(() => {
    const map = Object.fromEntries(COLUMNS.map((c) => [c.id, []]))
    for (const booking of bookings) {
      const key = map[booking.status] ? booking.status : 'pending'
      map[key].push(booking)
    }
    return map
  }, [bookings])

  const calendarEvents = useMemo(
    () =>
      bookings.map((b) => {
        const start = new Date(b.scheduled_start)
        const end = b.scheduled_end ? new Date(b.scheduled_end) : new Date(start.getTime() + 60 * 60_000)
        return {
          id: b.id,
          title: `${b.customer_name} · ${b.vehicle_plate || b.branch}`,
          start,
          end,
          resource: b,
        }
      }),
    [bookings],
  )

  async function move(booking, status) {
    if (!canEdit) return
    const token = await getAccessTokenFresh()
    if (!token) {
      toast.error('Sign in required')
      return
    }
    const res = await fetch('/api/booking-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ booking_id: booking.id, status }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(body.error || 'Unable to update booking')
      return
    }
    toast.success(`Moved to ${status}${body.notify?.sms?.ok ? ' · SMS sent' : ''}`)
    load()
  }

  function openCreate() {
    setEditing(null)
    setForm({
      ...emptyBooking,
      branch: branchFilter !== 'all' ? branchFilter : (branches[0]?.slug || profile?.branch_slug || ''),
      scheduled_start: `${todayISO()}T10:00`,
    })
    setFormOpen(true)
  }

  function openEdit(booking) {
    setEditing(booking)
    setForm({
      customer_name: booking.customer_name || '',
      customer_phone: booking.customer_phone || '',
      branch: booking.branch || '',
      scheduled_start: booking.scheduled_start ? booking.scheduled_start.slice(0, 16) : '',
      vehicle_plate: booking.vehicle_plate || '',
      vehicle_make: booking.vehicle_make || '',
      vehicle_model: booking.vehicle_model || '',
      notes: booking.notes || '',
      status: booking.status || 'pending',
    })
    setFormOpen(true)
  }

  async function saveBooking(event) {
    event.preventDefault()
    if (editing ? !canEdit : !canCreate) return
    setSaving(true)
    const payload = {
      customer_name: form.customer_name.trim(),
      customer_phone: form.customer_phone.trim() || null,
      branch: form.branch,
      scheduled_start: new Date(form.scheduled_start).toISOString(),
      vehicle_plate: form.vehicle_plate.trim().toUpperCase() || null,
      vehicle_make: form.vehicle_make.trim() || null,
      vehicle_model: form.vehicle_model.trim() || null,
      notes: form.notes.trim() || null,
      status: form.status,
    }
    const { error } = editing
      ? await supabase.from('bookings').update(payload).eq('id', editing.id).select('id').single()
      : await supabase.from('bookings').insert(payload).select('id').single()
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(editing ? 'Booking updated' : 'Booking created')
    setFormOpen(false)
    load()
  }

  async function archiveBooking(booking) {
    if (!canEdit || !window.confirm('Archive this booking?')) return
    const { error } = await supabase.from('bookings').update({ is_archived: true }).eq('id', booking.id).select('id').single()
    if (error) toast.error(error.message)
    else {
      toast.success('Booking archived')
      load()
    }
  }

  if (!canAccessBookingBoard(profile)) return <Navigate to="/operations/access-denied" replace />
  if (requiresTeamLeadBranchSetup(profile)) {
    return (
      <section className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-6 text-amber-100">
        Branch setup required before viewing bookings.
      </section>
    )
  }

  const branchOptions = canSeeAllBranches(profile)
    ? [{ slug: 'all', name: 'All branches' }, ...branches]
    : (getBranchScopeList(profile) || []).map((slug) => ({
        slug,
        name: branches.find((b) => b.slug === slug)?.name || slug,
      }))

  return (
    <section className="flex min-h-0 flex-col gap-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="floor-compact-header">
          <p className="mb-1 text-[10px] font-bold tracking-[0.22em] text-primary uppercase">Bookings</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Bookings</h1>
          <p className="floor-desc mt-1 text-sm text-muted-foreground">
            Board, table, and calendar · {range.start} → {range.end}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(canSeeAllBranches(profile) || branchOptions.length > 1) && (
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="min-h-11 w-40"><SelectValue placeholder="Branch" /></SelectTrigger>
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
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          {datePreset === 'custom' && (
            <>
              <Input type="date" className="min-h-11 w-36" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              <Input type="date" className="min-h-11 w-36" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </>
          )}
          {canCreate && (
            <Button type="button" onClick={openCreate}>New booking</Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(next) => setSearchParams(next === 'board' ? {} : { tab: next }, { replace: true })}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="table">Table</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4">
          <div className="floor-lane-board" role="region" aria-label="Booking columns">
            {COLUMNS.map((col) => (
              <section key={col.id} className="floor-lane" aria-label={col.label}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-xs font-bold tracking-[0.14em] text-slate-300 uppercase">{col.label}</h2>
                  <Badge variant="secondary">{grouped[col.id].length}</Badge>
                </div>
                <div className="floor-lane-body">
                  {grouped[col.id].map((booking) => (
                    <article key={booking.id} className="floor-ticket !cursor-default">
                      <p className="font-medium">{booking.customer_name}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {booking.vehicle_plate ? `${booking.vehicle_plate} · ` : ''}
                        {booking.branch} · {[booking.vehicle_make, booking.vehicle_model].filter(Boolean).join(' ')}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{new Date(booking.scheduled_start).toLocaleString()}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {canEdit && COLUMNS.filter((c) => c.id !== booking.status).slice(0, 3).map((c) => (
                          <Button key={c.id} size="sm" variant="outline" className="min-h-10 cursor-pointer" onClick={() => move(booking, c.id)}>
                            {c.label}
                          </Button>
                        ))}
                        {canEdit && (
                          <Button size="sm" variant="ghost" onClick={() => openEdit(booking)}>Edit</Button>
                        )}
                      </div>
                    </article>
                  ))}
                  {!grouped[col.id].length && (
                    <p className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-sm text-slate-500">Empty</p>
                  )}
                </div>
              </section>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="table" className="mt-4">
          <Card>
            <CardHeader><CardTitle>{bookings.length} bookings</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="whitespace-nowrap text-sm">{new Date(b.scheduled_start).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="font-medium">{b.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{b.customer_phone || '—'}</div>
                      </TableCell>
                      <TableCell className="capitalize">{b.branch}</TableCell>
                      <TableCell>{b.vehicle_plate || [b.vehicle_make, b.vehicle_model].filter(Boolean).join(' ') || '—'}</TableCell>
                      <TableCell><Badge variant="secondary">{b.status}</Badge></TableCell>
                      <TableCell className="flex flex-wrap gap-1">
                        {canEdit && <Button size="sm" variant="outline" onClick={() => openEdit(b)}>Edit</Button>}
                        {canEdit && <Button size="sm" variant="ghost" onClick={() => archiveBooking(b)}>Archive</Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!bookings.length && (
                    <TableRow><TableCell colSpan={6} className="text-muted-foreground">No bookings in this range.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <div className="min-h-[28rem] rounded-2xl border border-white/10 bg-[#0d1726] p-3 sm:p-4 [&_.rbc-calendar]:text-slate-200">
            <BigCalendar
              localizer={localizer}
              events={calendarEvents}
              defaultView={Views.WEEK}
              views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
              style={{ minHeight: 420 }}
              onSelectEvent={(ev) => canEdit && openEdit(ev.resource)}
            />
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit booking' : 'New booking'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveBooking} className="grid gap-3">
            <div className="flex flex-col gap-2">
              <Label>Customer name</Label>
              <Input required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Phone</Label>
              <Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Branch</Label>
              <Select value={form.branch} onValueChange={(branch) => setForm({ ...form, branch })}>
                <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Scheduled start</Label>
              <Input type="datetime-local" required value={form.scheduled_start} onChange={(e) => setForm({ ...form, scheduled_start: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label>Plate</Label>
                <Input value={form.vehicle_plate} onChange={(e) => setForm({ ...form, vehicle_plate: e.target.value.toUpperCase() })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Make</Label>
                <Input value={form.vehicle_make} onChange={(e) => setForm({ ...form, vehicle_make: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Model</Label>
                <Input value={form.vehicle_model} onChange={(e) => setForm({ ...form, vehicle_model: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(status) => setForm({ ...form, status })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLUMNS.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
