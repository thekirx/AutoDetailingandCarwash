import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from 'react-big-calendar'
import { format, getDay, parse, startOfWeek } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { CalendarDays, CarFront, Clock3, LoaderCircle, UserRound, X } from 'lucide-react'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { supabase } from '../lib/supabase'

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { 'en-US': enUS },
})

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No show' },
]

const statusColors = {
  pending: { backgroundColor: '#facc15', color: '#1c1917', borderColor: '#fde047' },
  confirmed: { backgroundColor: '#2563eb', color: '#eff6ff', borderColor: '#60a5fa' },
  in_progress: { backgroundColor: '#a855f7', color: '#faf5ff', borderColor: '#c084fc' },
  completed: { backgroundColor: '#16a34a', color: '#f0fdf4', borderColor: '#4ade80' },
  cancelled: { backgroundColor: '#475569', color: '#f8fafc', borderColor: '#64748b' },
  no_show: { backgroundColor: '#dc2626', color: '#fef2f2', borderColor: '#f87171' },
}

function formatBranch(branch) {
  return branch === 'batangas' ? 'Batangas' : 'Bacoor'
}

function toCalendarEvent(booking) {
  const start = new Date(booking.scheduled_start)
  const fallbackMinutes = booking.service?.duration_minutes || 60
  const end = booking.scheduled_end
    ? new Date(booking.scheduled_end)
    : new Date(start.getTime() + fallbackMinutes * 60_000)

  return {
    id: booking.id,
    title: `${booking.customer_name} · ${booking.vehicle_model}`,
    start,
    end,
    resource: booking,
  }
}

function CalendarEvent({ event }) {
  return (
    <div className="min-w-0 leading-tight">
      <p className="truncate text-xs font-bold">{event.resource.customer_name}</p>
      <p className="mt-0.5 truncate text-[10px] opacity-90">
        {event.resource.vehicle_model} · {event.resource.service?.name || 'Service'} · {formatBranch(event.resource.branch)}
      </p>
    </div>
  )
}

function BookingModal({ event, onClose, onUpdated }) {
  const booking = event.resource
  const [status, setStatus] = useState(booking.status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleKeyDown = (keyEvent) => {
      if (keyEvent.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const saveStatus = async () => {
    if (status === booking.status) return onClose()
    setSaving(true)
    setError('')

    const { data, error: updateError } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', booking.id)
      .select('id, status, updated_at')
      .single()

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    onUpdated(data)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(mouseEvent) => mouseEvent.target === mouseEvent.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="booking-dialog-title" className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#111820] p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-[0.2em] text-lime-400 uppercase">Booking details</p>
            <h2 id="booking-dialog-title" className="mt-2 text-2xl font-semibold">{booking.customer_name}</h2>
          </div>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-xl border border-white/10 text-slate-400 transition hover:bg-white/5 hover:text-white" aria-label="Close booking details"><X size={19} /></button>
        </div>

        <div className="mt-7 grid gap-4 rounded-2xl border border-white/8 bg-white/[0.025] p-5 text-sm sm:grid-cols-2">
          <div className="flex gap-3"><CarFront size={18} className="mt-0.5 shrink-0 text-lime-400" /><div><p className="text-xs text-slate-500">Vehicle</p><p className="mt-1 text-slate-200">{[booking.vehicle_year, booking.vehicle_make, booking.vehicle_model].filter(Boolean).join(' ')}</p></div></div>
          <div className="flex gap-3"><CalendarDays size={18} className="mt-0.5 shrink-0 text-lime-400" /><div><p className="text-xs text-slate-500">Service</p><p className="mt-1 text-slate-200">{booking.service?.name || 'Not specified'}</p></div></div>
          <div className="flex gap-3"><Clock3 size={18} className="mt-0.5 shrink-0 text-lime-400" /><div><p className="text-xs text-slate-500">Schedule</p><p className="mt-1 text-slate-200">{format(event.start, 'MMM d, yyyy · h:mm a')}–{format(event.end, 'h:mm a')}</p></div></div>
          <div className="flex gap-3"><UserRound size={18} className="mt-0.5 shrink-0 text-lime-400" /><div><p className="text-xs text-slate-500">Contact</p><p className="mt-1 text-slate-200">{booking.customer_phone || booking.customer_email || '—'}</p></div></div>
          <div className="flex gap-3"><CalendarDays size={18} className="mt-0.5 shrink-0 text-lime-400" /><div><p className="text-xs text-slate-500">Branch</p><p className="mt-1 text-slate-200">{formatBranch(booking.branch)}</p></div></div>
        </div>

        <label className="mt-6 block">
          <span className="mb-2 block text-xs font-medium tracking-wide text-slate-400 uppercase">Booking status</span>
          <select value={status} onChange={(changeEvent) => setStatus(changeEvent.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0b1118] px-4 py-3.5 text-sm outline-none transition focus:border-lime-400/60 focus:ring-2 focus:ring-lime-400/10">
            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>

        {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-400/8 px-4 py-3 text-sm text-red-200">{error}</p>}

        <div className="mt-7 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5">Cancel</button>
          <button type="button" onClick={saveStatus} disabled={saving} className="flex min-w-32 items-center justify-center gap-2 rounded-xl bg-lime-400 px-5 py-3 text-sm font-semibold text-[#090d12] transition hover:bg-lime-300 disabled:cursor-wait disabled:opacity-60">
            {saving && <LoaderCircle size={17} className="animate-spin" />}{saving ? 'Saving…' : 'Save status'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CalendarPage() {
  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [view, setView] = useState(Views.MONTH)
  const [date, setDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadBookings = useCallback(async () => {
    setLoading(true)
    setError('')

    const { data, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        customer_name,
        customer_email,
        customer_phone,
        vehicle_make,
        vehicle_model,
        vehicle_year,
        vehicle_plate,
        scheduled_start,
        scheduled_end,
        branch,
        status,
        notes,
        service:services!bookings_service_id_fkey (id, name, duration_minutes)
      `)
      .eq('is_archived', false)
      .order('scheduled_start')

    if (bookingsError) {
      setError(bookingsError.message)
      setLoading(false)
      return
    }

    setEvents(data.map(toCalendarEvent))
    setLoading(false)
  }, [])

  useEffect(() => {
    loadBookings()
  }, [loadBookings])

  const components = useMemo(() => ({ event: CalendarEvent }), [])
  const eventStyleGetter = useCallback((event) => ({
    style: {
      ...statusColors[event.resource.status],
      borderWidth: 1,
      borderStyle: 'solid',
      borderRadius: 7,
      padding: '3px 5px',
    },
  }), [])

  const handleUpdated = (updatedBooking) => {
    setEvents((currentEvents) => currentEvents.map((event) => event.id === updatedBooking.id
      ? { ...event, resource: { ...event.resource, status: updatedBooking.status } }
      : event))
    setSelectedEvent(null)
  }

  return (
    <section>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="mb-2 text-xs tracking-[0.22em] text-lime-400 uppercase">Shop operations</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Booking Calendar</h1><p className="mt-3 text-slate-400">Coordinate appointments and update their live status.</p></div>
        <div className="flex flex-wrap gap-3 text-xs">
          {[['Pending', 'bg-yellow-400'], ['Confirmed', 'bg-blue-600'], ['Completed', 'bg-green-600']].map(([label, color]) => <span key={label} className="flex items-center gap-2 text-slate-400"><span className={`size-2.5 rounded-full ${color}`} />{label}</span>)}
        </div>
      </div>

      <div className="relative mt-8 min-h-[680px] rounded-2xl border border-white/8 bg-[#10161e] p-3 shadow-xl shadow-black/10 sm:p-5">
        {loading && <div className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-[#10161e]/80 backdrop-blur-sm"><div className="flex items-center gap-3 text-sm text-slate-400"><LoaderCircle className="animate-spin text-lime-400" />Loading bookings…</div></div>}
        {error ? <div className="grid min-h-[620px] place-items-center text-center"><div><p className="text-sm text-red-300">{error}</p><button onClick={loadBookings} className="mt-4 text-sm font-medium text-lime-400">Try again</button></div></div> : (
          <BigCalendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            date={date}
            onNavigate={setDate}
            view={view}
            onView={setView}
            views={[Views.MONTH, Views.WEEK]}
            onSelectEvent={setSelectedEvent}
            eventPropGetter={eventStyleGetter}
            components={components}
            popup
            showMultiDayTimes
            min={new Date(1970, 1, 1, 7, 0)}
            max={new Date(1970, 1, 1, 21, 0)}
            style={{ height: 630 }}
          />
        )}
      </div>

      {selectedEvent && <BookingModal event={selectedEvent} onClose={() => setSelectedEvent(null)} onUpdated={handleUpdated} />}
    </section>
  )
}
