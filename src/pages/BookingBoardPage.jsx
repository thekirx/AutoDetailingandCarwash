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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createCoalescedReload } from '@/lib/coalesceReload'

const BOOKING_TABS = ['board', 'table', 'calendar']
const COLUMNS = [
  { id: 'pending', label: 'New', tone: 'border-l-blue-500' },
  { id: 'confirmed', label: 'Confirmed', tone: 'border-l-emerald-500' },
  { id: 'in_progress', label: 'In Progress', tone: 'border-l-amber-500' },
  { id: 'waiting', label: 'Waiting', tone: 'border-l-violet-500' },
  { id: 'completed', label: 'Done', tone: 'border-l-slate-400' },
  { id: 'cancelled', label: 'Cancelled', tone: 'border-l-red-500' },
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

function vehicleLine(booking) {
  const car = [booking.vehicle_make, booking.vehicle_model].filter(Boolean).join(' ')
  if (booking.vehicle_plate && car) return `${booking.vehicle_plate} · ${car}`
  return booking.vehicle_plate || car || 'No vehicle details'
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
    const loadRef = { current: load }
    loadRef.current = load
    const scheduleReload = createCoalescedReload(() => loadRef.current(), 450)
    const filter =
      typeof branchScope === 'string' && branchScope && branchScope !== 'all'
        ? `branch=eq.${branchScope}`
        : undefined
    const channel = supabase
      .channel(`booking-board-${JSON.stringify(branchScope)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', ...(filter ? { filter } : {}) },
        scheduleReload,
      )
      .subscribe()
    return () => {
      scheduleReload.cancel()
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
      <section className="rounded-2xl border border-amber-600/30 bg-amber-500/10 p-6 text-amber-950 dark:text-amber-100" role="alert">
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
    <section className="flex min-h-0 flex-col gap-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="floor-compact-header">
          <p className="mb-1 text-[10px] font-bold tracking-[0.22em] text-primary uppercase">Operations</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Bookings</h1>
          <p className="floor-desc mt-1 text-sm text-muted-foreground">
            Board, table, and calendar · {range.start} → {range.end}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(canSeeAllBranches(profile) || branchOptions.length > 1) && (
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="min-h-11 w-44 cursor-pointer" aria-label="Filter by branch">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                {branchOptions.map((b) => <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={datePreset} onValueChange={setDatePreset}>
            <SelectTrigger className="min-h-11 w-40 cursor-pointer" aria-label="Date range">
              <SelectValue />
            </SelectTrigger>
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
              <Input type="date" className="min-h-11 w-36" aria-label="Start date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              <Input type="date" className="min-h-11 w-36" aria-label="End date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </>
          )}
          {canCreate && (
            <Button type="button" className="min-h-11 cursor-pointer" onClick={openCreate}>New booking</Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(next) => setSearchParams(next === 'board' ? {} : { tab: next }, { replace: true })}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
          <TabsTrigger value="board" className="cursor-pointer">Board</TabsTrigger>
          <TabsTrigger value="table" className="cursor-pointer">Table</TabsTrigger>
          <TabsTrigger value="calendar" className="cursor-pointer">Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4">
          <div className="floor-lane-board" role="region" aria-label="Booking columns">
            {COLUMNS.map((col) => (
              <section key={col.id} className="floor-lane" aria-label={`${col.label} column`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">{col.label}</h2>
                  <Badge variant="secondary" className="tabular-nums">{grouped[col.id].length}</Badge>
                </div>
                <div className="floor-lane-body">
                  {grouped[col.id].map((booking) => (
                    <article
                      key={booking.id}
                      className={cn('floor-ticket !cursor-default border-l-4', col.tone)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-foreground">{booking.customer_name}</p>
                        {canEdit && (
                          <Button size="sm" variant="ghost" className="h-8 shrink-0 cursor-pointer px-2" onClick={() => openEdit(booking)}>
                            Edit
                          </Button>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-foreground/80">{vehicleLine(booking)}</p>
                      <p className="mt-1 text-xs font-medium capitalize text-muted-foreground">
                        {booking.branch}
                        {' · '}
                        {new Date(booking.scheduled_start).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {canEdit && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {COLUMNS.filter((c) => c.id !== booking.status).slice(0, 3).map((c) => (
                            <Button
                              key={c.id}
                              size="sm"
                              variant="outline"
                              className="min-h-10 cursor-pointer"
                              onClick={() => move(booking, c.id)}
                            >
                              {c.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                  {!grouped[col.id].length && (
                    <p className="rounded-2xl border border-dashed border-border bg-background/50 p-5 text-center text-sm text-muted-foreground">
                      No {col.label.toLowerCase()} bookings
                    </p>
                  )}
                </div>
              </section>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="table" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{bookings.length} bookings</CardTitle>
              <CardDescription>Flat list for the selected branch and date range.</CardDescription>
            </CardHeader>
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
                      <TableCell className="whitespace-nowrap text-sm text-foreground">{new Date(b.scheduled_start).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{b.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{b.customer_phone || '—'}</div>
                      </TableCell>
                      <TableCell className="capitalize text-foreground">{b.branch}</TableCell>
                      <TableCell className="text-foreground">{b.vehicle_plate || [b.vehicle_make, b.vehicle_model].filter(Boolean).join(' ') || '—'}</TableCell>
                      <TableCell><Badge variant="secondary">{b.status}</Badge></TableCell>
                      <TableCell className="flex flex-wrap gap-1">
                        {canEdit && <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => openEdit(b)}>Edit</Button>}
                        {canEdit && <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => archiveBooking(b)}>Archive</Button>}
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
          <Card className="overflow-hidden">
            <CardContent className="p-3 sm:p-4">
              <div className="booking-calendar min-h-[28rem] text-foreground [&_.rbc-toolbar]:mb-3 [&_.rbc-toolbar_button]:min-h-10 [&_.rbc-toolbar_button]:cursor-pointer [&_.rbc-toolbar_button]:rounded-md [&_.rbc-toolbar_button]:border [&_.rbc-toolbar_button]:border-border [&_.rbc-toolbar_button]:bg-background [&_.rbc-toolbar_button]:px-3 [&_.rbc-toolbar_button]:text-foreground [&_.rbc-month-view]:rounded-xl [&_.rbc-month-view]:border [&_.rbc-month-view]:border-border [&_.rbc-header]:border-border [&_.rbc-header]:bg-muted/50 [&_.rbc-header]:py-2 [&_.rbc-header]:text-xs [&_.rbc-header]:font-semibold [&_.rbc-header]:text-muted-foreground [&_.rbc-off-range-bg]:bg-muted/30 [&_.rbc-today]:bg-primary/5 [&_.rbc-event]:border-0 [&_.rbc-event]:bg-primary [&_.rbc-event]:text-primary-foreground [&_.rbc-time-content]:border-border [&_.rbc-timeslot-group]:border-border [&_.rbc-day-bg]:border-border [&_.rbc-month-row]:border-border">
                <BigCalendar
                  localizer={localizer}
                  events={calendarEvents}
                  defaultView={Views.WEEK}
                  views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
                  style={{ minHeight: 420 }}
                  onSelectEvent={(ev) => canEdit && openEdit(ev.resource)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit booking' : 'New booking'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveBooking} className="grid gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="bk-name">Customer name</Label>
              <Input id="bk-name" required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bk-phone">Phone</Label>
              <Input id="bk-phone" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Branch</Label>
              <Select value={form.branch} onValueChange={(branch) => setForm({ ...form, branch })}>
                <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Branch" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bk-start">Scheduled start</Label>
              <Input id="bk-start" type="datetime-local" required value={form.scheduled_start} onChange={(e) => setForm({ ...form, scheduled_start: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="bk-plate">Plate</Label>
                <Input id="bk-plate" value={form.vehicle_plate} onChange={(e) => setForm({ ...form, vehicle_plate: e.target.value.toUpperCase() })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="bk-make">Make</Label>
                <Input id="bk-make" value={form.vehicle_make} onChange={(e) => setForm({ ...form, vehicle_make: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="bk-model">Model</Label>
                <Input id="bk-model" value={form.vehicle_model} onChange={(e) => setForm({ ...form, vehicle_model: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(status) => setForm({ ...form, status })}>
                <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLUMNS.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bk-notes">Notes</Label>
              <Textarea id="bk-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" className="cursor-pointer" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
