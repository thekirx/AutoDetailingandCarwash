import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  CarFront,
  CheckCircle2,
  ClipboardList,
  Clock3,
  LoaderCircle,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  UserPlus,
  Users,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import {
  ACTIVE_QUEUE_STATUSES,
  QUEUE_PERMISSION_ERROR,
  STATUS_LABELS,
  formatQueueNumber,
  getBranchScope,
  getPlateLookupStatus,
  getQueueCounts,
  normalizeVehicleType,
  parsePesoInputToMinor,
  requiresTeamLeadBranchSetup,
} from '../queue/queueLogic'
import {
  addStaffMember,
  assignStaff,
  createQueueTicket,
  deactivateCrewStaffMember,
  fetchBranches,
  fetchOperationsSnapshot,
  fetchServices,
  fetchTicket,
  formatMoney,
  lookupPlate,
  sendTicketToPayment,
  setStaffAttendance,
  updateCrewStaffMember,
  updateTicketPrice,
  updateTicketStatus,
} from '../queue/queueApi'

const statusTone = {
  waiting: 'border-blue-300/20 bg-blue-500/10 text-blue-100',
  in_progress: 'border-emerald-300/20 bg-emerald-500/10 text-emerald-100',
  final_checking: 'border-amber-300/20 bg-amber-500/10 text-amber-100',
  for_payment: 'border-violet-300/20 bg-violet-500/10 text-violet-100',
  completed: 'border-slate-300/20 bg-slate-500/10 text-slate-100',
}

const vehicleTypeOptions = [
  { label: 'Sedan', value: 'sedan' },
  { label: 'SUV', value: 'suv' },
  { label: 'Van', value: 'van' },
  { label: 'Pickup', value: 'pickup' },
  { label: 'Motorcycle', value: 'motorcycle' },
]

function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
      <div>
        <p className="mb-2 text-xs font-bold tracking-[0.22em] text-blue-300 uppercase">{eyebrow}</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-slate-400">{description}</p>}
      </div>
      {action}
    </div>
  )
}

function MetricCard({ label, value, icon: Icon, tone = 'blue' }) {
  const colors = tone === 'green' ? 'text-emerald-200 bg-emerald-400/10' : tone === 'amber' ? 'text-amber-200 bg-amber-400/10' : 'text-blue-200 bg-blue-400/10'
  return (
    <article className="rounded-3xl border border-white/10 bg-[#0d1726] p-5 shadow-xl shadow-black/10">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">{label}</p>
        <span className={`grid size-10 place-items-center rounded-2xl ${colors}`}><Icon size={18} /></span>
      </div>
      <p className="mt-5 text-3xl font-semibold tabular-nums">{value}</p>
    </article>
  )
}

function TicketCard({ ticket }) {
  return (
    <Link to={`/operations/queue/${ticket.booking_id}`} className="block rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-slate-100 no-underline transition hover:border-blue-300/30 hover:bg-white/[0.07]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-black tabular-nums">{formatQueueNumber(ticket.queue_number)}</p>
          <p className="mt-1 text-sm font-medium">{ticket.customer_name}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase ${statusTone[ticket.status] || statusTone.completed}`}>{STATUS_LABELS[ticket.status] || ticket.status}</span>
      </div>
      <div className="mt-4 grid gap-1 text-xs text-slate-400">
        <span>{[ticket.vehicle_year, ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(' ') || 'Vehicle'}</span>
        <span>{ticket.vehicle_plate || 'No plate'} · {ticket.service_name || 'Service'}</span>
        <span>{ticket.assigned_staff_name || 'No staff assigned'}</span>
      </div>
    </Link>
  )
}

function useOperationsSnapshot() {
  const { profile } = useAuth()
  const [snapshot, setSnapshot] = useState({ queue: [], activeQueue: [], staffPool: [], availableStaff: [], busyStaff: [], events: [], handoffs: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      setSnapshot(await fetchOperationsSnapshot(profile))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('operations-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_assignments' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_handoffs' }, load)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  return { ...snapshot, loading, error, reload: load }
}

export function OperationsDashboardPage() {
  const { profile, canViewQueueOperations } = useAuth()
  const { activeQueue, availableStaff, busyStaff, events, handoffs, loading, error, reload } = useOperationsSnapshot()
  const counts = useMemo(() => getQueueCounts(activeQueue), [activeQueue])
  if (!canViewQueueOperations) return <Navigate to="/operations/access-denied" replace />
  if (requiresTeamLeadBranchSetup(profile)) return <BranchSetupError />

  if (error) return <ErrorState error={error} onRetry={reload} />

  return (
    <section>
      <PageHeader eyebrow="Team Lead Dashboard" title="Active floor control" description="Track queue volume, crew availability, and handoffs ready for the future POS module." action={<RefreshButton loading={loading} onClick={reload} />} />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Waiting" value={counts.waiting} icon={Clock3} />
        <MetricCard label="In Progress" value={counts.in_progress} icon={CarFront} tone="green" />
        <MetricCard label="Final Checking" value={counts.final_checking} icon={BadgeCheck} tone="amber" />
        <MetricCard label="Total Active" value={counts.total} icon={ClipboardList} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <Panel title="Crew Availability" icon={Users}>
          <div className="grid gap-4 sm:grid-cols-2">
            <CrewList title="Available" rows={availableStaff} empty="No available staff" />
            <CrewList title="Busy" rows={busyStaff} empty="No busy staff" busy />
          </div>
        </Panel>
        <Panel title="Recently Sent To Payment" icon={Send}>
          <div className="grid gap-3">
            {handoffs.length ? handoffs.map((handoff) => (
              <div key={handoff.id} className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
                <p className="font-semibold">{handoff.branch} · {formatMoney(handoff.amount_minor)}</p>
                <p className="mt-1 text-xs text-slate-500">{handoff.status} · {handoff.handed_off_at ? new Date(handoff.handed_off_at).toLocaleString() : 'Pending'}</p>
              </div>
            )) : <EmptyLine text="No payment handoffs yet." />}
          </div>
        </Panel>
      </div>
      <Panel title="Queue Activity Logs" icon={ClipboardList} className="mt-6">
        <div className="grid gap-3">
          {events.length ? events.map((event) => (
            <div key={event.id} className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
              <p className="text-sm">{event.old_status || 'created'} to {event.new_status}</p>
              <p className="mt-1 text-xs text-slate-500">{event.branch} · {event.notes || 'Status update'} · {new Date(event.created_at).toLocaleString()}</p>
            </div>
          )) : <EmptyLine text="No queue activity yet." />}
        </div>
      </Panel>
    </section>
  )
}

export function OperationsQueuePage() {
  const { profile, canManageQueue, canViewQueueOperations } = useAuth()
  const { activeQueue, loading, error, reload } = useOperationsSnapshot()
  const grouped = useMemo(() => Object.fromEntries(ACTIVE_QUEUE_STATUSES.map((status) => [status, activeQueue.filter((ticket) => ticket.status === status)])), [activeQueue])
  if (!canViewQueueOperations) return <Navigate to="/operations/access-denied" replace />
  if (requiresTeamLeadBranchSetup(profile)) return <BranchSetupError />
  if (error) return <ErrorState error={error} onRetry={reload} />

  return (
    <section>
      <PageHeader
        eyebrow="Queue Board"
        title="Today on the floor"
        description="Manage active tickets until they are sent to payment. For Payment tickets leave this board by design."
        action={<div className="flex gap-3"><RefreshButton loading={loading} onClick={reload} />{canManageQueue && <Link to="/operations/queue/new" className="inline-flex items-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 font-semibold text-white no-underline transition hover:bg-blue-400"><Plus size={18} />New ticket</Link>}</div>}
      />
      <div className="mt-8 grid gap-5 xl:grid-cols-3">
        {ACTIVE_QUEUE_STATUSES.map((status) => (
          <section key={status} className="min-h-96 rounded-3xl border border-white/10 bg-[#0d1726] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-[0.14em] text-slate-300 uppercase">{STATUS_LABELS[status]}</h2>
              <span className="rounded-full bg-white/8 px-3 py-1 text-xs tabular-nums">{grouped[status].length}</span>
            </div>
            <div className="grid gap-3">
              {loading ? Array.from({ length: 3 }, (_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-white/5" />) : grouped[status].length ? grouped[status].map((ticket) => <TicketCard key={ticket.booking_id} ticket={ticket} />) : <EmptyLine text="No tickets in this lane." />}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}

export function QueueTicketPage() {
  const { id } = useParams()
  const { user, profile, canManageQueue, canViewQueueOperations } = useAuth()
  const [ticket, setTicket] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [staff, setStaff] = useState([])
  const [selectedStaff, setSelectedStaff] = useState([])
  const [price, setPrice] = useState('')
  const [priceReason, setPriceReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const data = await fetchTicket(id, profile)
      setTicket(data.ticket)
      setAssignments(data.assignments)
      setStaff(data.staff)
      setSelectedStaff(data.assignments.filter((assignment) => assignment.status === 'active').map((assignment) => assignment.staff_id))
      setPrice(String(((data.ticket?.final_price_minor ?? data.ticket?.base_price_minor ?? 0) / 100) || ''))
      setPriceReason('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id, profile])

  useEffect(() => {
    load()
  }, [load])

  const runAction = async (label, action) => {
    setSaving(label)
    setError('')
    try {
      await action()
      await load()
    } catch (err) {
      console.error('Queue action failed', err)
      setError(err.message)
    } finally {
      setSaving('')
    }
  }

  if (!canViewQueueOperations) return <Navigate to="/operations/access-denied" replace />
  if (requiresTeamLeadBranchSetup(profile)) return <BranchSetupError />
  if (loading) return <LoadingPanel />
  if (error) return <ErrorState error={error} onRetry={load} />
  if (!ticket) return <Navigate to="/operations/queue" replace />

  const staffById = new Map(staff.map((item) => [item.id, item]))
  const canSendToPayment = canManageQueue && ticket.status === 'final_checking'
  const parsedPrice = Number(String(price).replace(/,/g, '').trim())
  const showLowPriceWarning = Number.isFinite(parsedPrice) && parsedPrice > 0 && parsedPrice < 50
  const savePrice = () => {
    const amountMinor = parsePesoInputToMinor(price)
    if (amountMinor < 5000 && !window.confirm('Please confirm this amount is correct. Did you mean a higher peso amount?')) return Promise.resolve()
    return updateTicketPrice(ticket, amountMinor, priceReason, user.id)
  }

  return (
    <section>
      <PageHeader eyebrow="Queue Ticket" title={`${formatQueueNumber(ticket.queue_number)} · ${ticket.customer_name}`} description={`${ticket.branch} · ${STATUS_LABELS[ticket.status] || ticket.status}`} action={<Link to="/operations/queue" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-200 no-underline">Back to queue</Link>} />
      {error && <p className="mt-5 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">{error}</p>}
      {!canManageQueue && <p className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-100">{QUEUE_PERMISSION_ERROR}</p>}
      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_380px]">
        <Panel title="Ticket Details" icon={CarFront}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Info label="Customer" value={ticket.customer_name} />
            <Info label="Contact" value={ticket.customer_phone || 'No contact'} />
            <Info label="Plate" value={ticket.vehicle_plate || 'No plate'} />
            <Info label="Vehicle" value={[ticket.vehicle_year, ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(' ')} />
            <Info label="Service" value={ticket.service_name || 'Service'} />
            <Info label="Price" value={formatMoney(ticket.final_price_minor ?? ticket.base_price_minor)} />
            <Info label="Created" value={new Date(ticket.created_at).toLocaleString()} />
            <Info label="Notes" value={ticket.notes || 'No internal notes'} />
          </div>
        </Panel>

        <div className="grid gap-6">
          <Panel title="Status Actions" icon={ArrowRight}>
            <div className="grid gap-3">
              <ActionButton disabled={!canManageQueue || ticket.status !== 'waiting'} loading={saving === 'start'} onClick={() => runAction('start', () => updateTicketStatus(ticket, 'in_progress'))}>Start Service</ActionButton>
              <ActionButton disabled={!canManageQueue || ticket.status !== 'in_progress'} loading={saving === 'check'} onClick={() => runAction('check', () => updateTicketStatus(ticket, 'final_checking'))}>Send To Final Checking</ActionButton>
              <ActionButton disabled={!canSendToPayment} loading={saving === 'payment'} onClick={() => runAction('payment', () => sendTicketToPayment(ticket.booking_id))}><Send size={17} />Send To Payment</ActionButton>
            </div>
          </Panel>

          <Panel title="Edit Price" icon={BadgeCheck}>
            <div className="grid gap-3">
              <label className="text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">Final Price in Pesos<input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} disabled={!canManageQueue} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-blue-300/60" /></label>
              {showLowPriceWarning && <p className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">Please confirm this amount is correct. Did you mean a higher peso amount?</p>}
              <label className="text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">Reason<input value={priceReason} onChange={(event) => setPriceReason(event.target.value)} disabled={!canManageQueue} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-blue-300/60" /></label>
              <ActionButton disabled={!canManageQueue} loading={saving === 'price'} onClick={() => runAction('price', savePrice)}>Save Price</ActionButton>
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Staff Assignment" icon={UserPlus} className="mt-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {staff.map((member) => {
              const active = selectedStaff.includes(member.id)
              return (
                <label key={member.id} className={`flex items-center justify-between gap-3 rounded-2xl border p-4 transition ${active ? 'border-blue-300/40 bg-blue-500/10' : 'border-white/10 bg-white/[0.035]'}`}>
                  <span><span className="block font-medium">{member.full_name}</span><span className="text-xs text-slate-500">{member.branch_slug || 'All branches'}</span></span>
                  <input type="checkbox" checked={active} disabled={!canManageQueue} onChange={(event) => setSelectedStaff((current) => event.target.checked ? [...current, member.id] : current.filter((idValue) => idValue !== member.id))} />
                </label>
              )
            })}
          </div>
          <div>
            <ActionButton disabled={!canManageQueue} loading={saving === 'assign'} onClick={() => runAction('assign', () => assignStaff(ticket, selectedStaff, user.id))}>Save Assignments</ActionButton>
            <div className="mt-4 grid gap-2 text-sm text-slate-400">
              {assignments.length ? assignments.map((assignment) => (
                <p key={assignment.id}>{staffById.get(assignment.staff_id)?.full_name || assignment.staff_id}: <span className="capitalize text-slate-200">{assignment.status}</span></p>
              )) : <p>No assignment history yet.</p>}
            </div>
          </div>
        </div>
      </Panel>
    </section>
  )
}

export function NewQueueTicketPage() {
  const navigate = useNavigate()
  const { user, profile, canManageQueue } = useAuth()
  const assignedBranch = getBranchScope(profile)
  const canChooseBranch = profile?.role === 'BossMich'
  const [services, setServices] = useState([])
  const [branches, setBranches] = useState([])
  const [plateMatch, setPlateMatch] = useState(null)
  const [plateLookupState, setPlateLookupState] = useState('idle')
  const [form, setForm] = useState({
    customer_id: '',
    vehicle_id: '',
    customer_first_name: '',
    customer_last_name: '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    vehicle_plate: '',
    vehicle_make: '',
    vehicle_model: '',
    vehicle_year: '',
    vehicle_color: '',
    vehicle_type: 'sedan',
    service_id: '',
    branch: assignedBranch || '',
    final_price: '',
    notes: '',
    services: [],
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([fetchServices(), canChooseBranch ? fetchBranches() : Promise.resolve([])])
      .then(([serviceRows, branchRows]) => {
        const firstService = serviceRows[0]
        setServices(serviceRows)
        setBranches(branchRows)
        setForm((current) => ({
          ...current,
          branch: assignedBranch || current.branch || branchRows[0]?.slug || '',
          services: serviceRows,
          service_id: firstService?.id || current.service_id,
          final_price: firstService ? String(firstService.price_minor / 100) : current.final_price,
        }))
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [assignedBranch, canChooseBranch])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const plate = form.vehicle_plate.trim()
      if (plate.length < 2) {
        setPlateMatch(null)
        setPlateLookupState('idle')
        return
      }

      setPlateLookupState('loading')
      lookupPlate(plate, profile)
        .then((match) => {
          setPlateMatch(match)
          if (!match) {
            setPlateLookupState('not_found')
            setForm((current) => ({ ...current, customer_id: '', vehicle_id: '' }))
            return
          }

          setPlateLookupState('found')
          setForm((current) => ({
            ...current,
            customer_id: match.customer_id || '',
            vehicle_id: match.vehicle_id || '',
            customer_name: match.customer_name || current.customer_name,
            customer_phone: match.customer_phone || current.customer_phone,
            vehicle_plate: match.plate_number || current.vehicle_plate,
            vehicle_make: match.vehicle_make || current.vehicle_make,
            vehicle_model: match.vehicle_model || current.vehicle_model,
            vehicle_type: normalizeVehicleType(match.vehicle_type || current.vehicle_type),
          }))
        })
        .catch((err) => setError(err.message))
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [form.vehicle_plate, profile])

  const update = (key) => (event) => {
    const value = event.target.value
    setForm((current) => {
      const next = { ...current, [key]: value }
      if (key === 'customer_first_name' || key === 'customer_last_name') {
        next.customer_name = `${key === 'customer_first_name' ? value : current.customer_first_name} ${key === 'customer_last_name' ? value : current.customer_last_name}`.trim()
      }
      return next
    })
  }
  const updateVehicleType = (event) => setForm((current) => ({ ...current, vehicle_type: normalizeVehicleType(event.target.value) }))
  const updateService = (event) => {
    const serviceId = event.target.value
    const service = services.find((item) => item.id === serviceId)
    setForm((current) => ({
      ...current,
      service_id: serviceId,
      final_price: service ? String(service.price_minor / 100) : current.final_price,
    }))
  }

  const parsedFormPrice = Number(String(form.final_price).replace(/,/g, '').trim())
  const showFormLowPriceWarning = Number.isFinite(parsedFormPrice) && parsedFormPrice > 0 && parsedFormPrice < 50

  const submit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      if (showFormLowPriceWarning && !window.confirm('Please confirm this amount is correct. Did you mean a higher peso amount?')) {
        setSubmitting(false)
        return
      }
      const ticket = await createQueueTicket({
        ...form,
        branch: canChooseBranch ? form.branch : assignedBranch,
        vehicle_type: normalizeVehicleType(form.vehicle_type),
        services,
        created_by: user.id,
      })
      navigate(`/operations/queue/${ticket.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!canManageQueue) return <Navigate to="/operations/access-denied" replace />
  if (requiresTeamLeadBranchSetup(profile)) return <BranchSetupError />
  if (loading) return <LoadingPanel />

  return (
    <section>
      <PageHeader eyebrow="Create Queue Ticket" title="Add vehicle to queue" description="Search existing customer and vehicle records, or create a walk-in ticket without building the full CRM yet." />
      {error && <p className="mt-5 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">{error}</p>}
      <div className="mt-8">
        <Panel title="Ticket Form" icon={Plus}>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2 text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">Plate Number<input value={form.vehicle_plate} onChange={update('vehicle_plate')} required autoFocus placeholder="ABC 1234" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-blue-300/60" /></label>
            {form.vehicle_plate.trim().length >= 2 && plateLookupState !== 'idle' && (
              <p className={`sm:col-span-2 rounded-2xl border px-4 py-3 text-sm ${plateLookupState === 'found' ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100' : 'border-amber-300/20 bg-amber-400/10 text-amber-100'}`}>
                {plateLookupState === 'loading' ? 'Checking plate number...' : getPlateLookupStatus(form.vehicle_plate, Boolean(plateMatch))}
              </p>
            )}
            <FormField label="First name" value={form.customer_first_name} onChange={update('customer_first_name')} required />
            <FormField label="Last name" value={form.customer_last_name} onChange={update('customer_last_name')} required />
            <FormField label="Phone number" value={form.customer_phone} onChange={update('customer_phone')} required />
            <FormField label="Email (optional)" value={form.customer_email} onChange={update('customer_email')} type="email" />
            <FormField label="Vehicle make" value={form.vehicle_make} onChange={update('vehicle_make')} required />
            <FormField label="Vehicle model" value={form.vehicle_model} onChange={update('vehicle_model')} required />
            <FormField label="Year" value={form.vehicle_year} onChange={update('vehicle_year')} type="number" min="1886" max="2200" />
            <FormField label="Color" value={form.vehicle_color} onChange={update('vehicle_color')} />
            <label className="text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">Vehicle type<select value={form.vehicle_type} onChange={updateVehicleType} className="mt-2 w-full rounded-xl border border-white/10 bg-[#101a2a] px-4 py-3 text-sm text-white outline-none">{vehicleTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">Service<select value={form.service_id} onChange={updateService} required className="mt-2 w-full rounded-xl border border-white/10 bg-[#101a2a] px-4 py-3 text-sm text-white outline-none">{services.map((service) => <option key={service.id} value={service.id}>{service.name} · {formatMoney(service.price_minor)}</option>)}</select></label>
            {canChooseBranch && <label className="text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">Branch<select value={form.branch} onChange={update('branch')} required className="mt-2 w-full rounded-xl border border-white/10 bg-[#101a2a] px-4 py-3 text-sm text-white outline-none">{branches.map((branch) => <option key={branch.slug} value={branch.slug}>{branch.name}</option>)}</select></label>}
            <FormField label="Final Price in Pesos" value={form.final_price} onChange={update('final_price')} type="number" min="0" step="0.01" required />
            {showFormLowPriceWarning && <p className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">Please confirm this amount is correct. Did you mean a higher peso amount?</p>}
            <label className="sm:col-span-2 text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">Notes<textarea value={form.notes} onChange={update('notes')} className="mt-2 min-h-28 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-blue-300/60" /></label>
            <button disabled={submitting} className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 font-semibold text-white transition hover:bg-blue-400 disabled:cursor-wait disabled:opacity-60">{submitting ? <LoaderCircle className="animate-spin" size={18} /> : <Plus size={18} />}Create Queue Ticket</button>
          </form>
        </Panel>
      </div>
    </section>
  )
}

export function CrewPage() {
  const { profile, canManageQueue, canViewQueueOperations } = useAuth()
  const { staffPool, availableStaff, busyStaff, loading, error, reload } = useOperationsSnapshot()
  const [form, setForm] = useState({ full_name: '', phone: '', branch_slug: getBranchScope(profile) || '', present_today: true })
  const [branches, setBranches] = useState([])
  const [saving, setSaving] = useState('')
  const [actionError, setActionError] = useState('')
  const presentCount = staffPool.filter((member) => member.is_present_today).length

  useEffect(() => {
    if (profile?.role !== 'BossMich') return
    fetchBranches()
      .then((rows) => {
        setBranches(rows)
        setForm((current) => ({ ...current, branch_slug: current.branch_slug || rows[0]?.slug || '' }))
      })
      .catch((err) => setActionError(err.message))
  }, [profile?.role])

  const runCrewAction = async (label, action) => {
    setSaving(label)
    setActionError('')
    try {
      await action()
      await reload()
    } catch (err) {
      console.error('Crew action failed', err)
      setActionError(err.message)
    } finally {
      setSaving('')
    }
  }

  const submitStaff = (event) => {
    event.preventDefault()
    runCrewAction('add-staff', async () => {
      await addStaffMember(form, profile)
      setForm((current) => ({ ...current, full_name: '', phone: '' }))
    })
  }

  if (!canViewQueueOperations) return <Navigate to="/operations/access-denied" replace />
  if (requiresTeamLeadBranchSetup(profile)) return <BranchSetupError />
  if (error) return <ErrorState error={error} onRetry={reload} />
  return (
    <section>
      <PageHeader eyebrow="Crew" title="Staff pool and attendance" description="Add staff once, mark who attended today, then deploy only present staff into queue tickets." action={<RefreshButton loading={loading} onClick={reload} />} />
      {actionError && <p className="mt-5 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">{actionError}</p>}
      <div className="mt-8 grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
        <Panel title="Staff Pool" icon={UserPlus}>
          {canManageQueue && (
            <form onSubmit={submitStaff} className="mb-5 grid gap-3 md:grid-cols-[1fr_160px_auto]">
              <input value={form.full_name} onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))} required placeholder="Staff name" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-blue-300/60" />
              <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-blue-300/60" />
              <button disabled={saving === 'add-staff'} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-wait disabled:opacity-60">{saving === 'add-staff' ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />}Add</button>
              {profile?.role === 'BossMich' && <select value={form.branch_slug} onChange={(event) => setForm((current) => ({ ...current, branch_slug: event.target.value }))} required className="md:col-span-3 rounded-xl border border-white/10 bg-[#101a2a] px-4 py-3 text-sm text-white outline-none">{branches.map((branch) => <option key={branch.slug} value={branch.slug}>{branch.name}</option>)}</select>}
              <label className="md:col-span-3 flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.035] px-4 py-3 text-sm text-slate-300">
                <input type="checkbox" checked={form.present_today} onChange={(event) => setForm((current) => ({ ...current, present_today: event.target.checked }))} />
                Mark as attended today
              </label>
            </form>
          )}
          <div className="mb-4 grid grid-cols-3 gap-3 text-center text-xs text-slate-400">
            <span className="rounded-xl bg-white/[0.035] px-3 py-2"><strong className="block text-lg text-white">{staffPool.length}</strong>Pool</span>
            <span className="rounded-xl bg-white/[0.035] px-3 py-2"><strong className="block text-lg text-white">{presentCount}</strong>Present</span>
            <span className="rounded-xl bg-white/[0.035] px-3 py-2"><strong className="block text-lg text-white">{availableStaff.length}</strong>Deployable</span>
          </div>
          <StaffPoolList
            rows={staffPool}
            canManage={canManageQueue}
            saving={saving}
            onAttendance={(member, status) => runCrewAction(`${member.id}-${status}`, () => setStaffAttendance(member, status, profile))}
            onEdit={(member, patch) => runCrewAction(`${member.id}-edit`, () => updateCrewStaffMember(member.id, patch))}
            onDeactivate={(member) => {
              if (!window.confirm(`Remove ${member.full_name} from the active crew pool?`)) return
              return runCrewAction(`${member.id}-off`, () => deactivateCrewStaffMember(member.id))
            }}
          />
        </Panel>
        <Panel title="Available Today" icon={CheckCircle2}><CrewList rows={availableStaff} empty="No attended staff available" /></Panel>
      </div>
      <div className="mt-6 grid gap-6">
        <Panel title="Busy Staff" icon={Users}><CrewList rows={busyStaff} empty="No busy staff" busy /></Panel>
      </div>
    </section>
  )
}

export function KpiPage() {
  const { profile, canViewQueueOperations } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    if (requiresTeamLeadBranchSetup(profile)) {
      setRows([])
      setLoading(false)
      return
    }
    const branchScope = getBranchScope(profile)
    try {
      let query = supabase
        .from('crew_kpi_summary')
        .select('staff_id, staff_name, branch, total_assigned, total_completed, average_service_minutes, active_jobs, completed_today')
      if (branchScope) query = query.eq('branch', branchScope)
      const { data, error: viewError } = await query.order('staff_name')
      if (!viewError) {
        setRows(data || [])
        setLoading(false)
        return
      }
      // Fallback when view grant is missing — security definer RPC already granted
      if (!/permission denied|42501/i.test(viewError.message)) throw viewError

      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
      const { data: rpcRows, error: rpcError } = await supabase.rpc('get_crew_kpi', {
        input_start_date: '2024-01-01',
        input_end_date: today,
        input_branch_slug: branchScope || null,
      })
      if (rpcError) throw rpcError
      setRows(
        (rpcRows || []).map((row) => ({
          staff_id: row.staff_id,
          staff_name: row.staff_name,
          branch: row.branch_slug || row.branch_name,
          total_assigned: Number(row.cars_handled || 0) + Number(row.active_jobs || 0),
          total_completed: Number(row.cars_handled || 0),
          average_service_minutes: Number(row.average_completed_seconds || 0) / 60,
          active_jobs: Number(row.active_jobs || 0),
          completed_today: 0,
        })),
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [profile])
  useEffect(() => { load() }, [load])
  if (!canViewQueueOperations) return <Navigate to="/operations/access-denied" replace />
  if (requiresTeamLeadBranchSetup(profile)) return <BranchSetupError />
  if (error) return <ErrorState error={error} onRetry={load} />
  return (
    <section>
      <PageHeader eyebrow="Queue KPI" title="Crew performance" description="Queue-only KPI. Staff receive credit when assignments are released at payment handoff." action={<RefreshButton loading={loading} onClick={load} />} />
      <Panel title="Crew KPI Summary" icon={BarChartIcon} className="mt-8">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs tracking-[0.14em] text-slate-500 uppercase"><tr><th className="px-4 py-3">Staff</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3 text-right">Assigned</th><th className="px-4 py-3 text-right">Released</th><th className="px-4 py-3 text-right">Active</th><th className="px-4 py-3 text-right">Avg Minutes</th><th className="px-4 py-3 text-right">Today</th></tr></thead>
            <tbody className="divide-y divide-white/8">
              {rows.length ? rows.map((row) => <tr key={row.staff_id}><td className="px-4 py-4 font-medium">{row.staff_name}</td><td className="px-4 py-4 text-slate-400">{row.branch || 'All'}</td><td className="px-4 py-4 text-right tabular-nums">{row.total_assigned}</td><td className="px-4 py-4 text-right tabular-nums">{row.total_completed}</td><td className="px-4 py-4 text-right tabular-nums">{row.active_jobs}</td><td className="px-4 py-4 text-right tabular-nums">{Math.round(row.average_service_minutes || 0)}</td><td className="px-4 py-4 text-right tabular-nums">{row.completed_today}</td></tr>) : <tr><td colSpan="7" className="px-4 py-14 text-center text-slate-500">No KPI records yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </section>
  )
}

export function MyTasksPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setError('')
    const { data, error } = await supabase
      .from('queue_assignments')
      .select('id, booking_id, task_name, task_notes, status, started_at, completed_at, released_at, created_at')
      .eq('staff_id', user.id)
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setRows(data || [])
    setLoading(false)
  }, [user.id])
  useEffect(() => { load() }, [load])

  const markInProgress = async (assignment) => {
    const { error } = await supabase.from('queue_assignments').update({ status: 'active', started_at: assignment.started_at || new Date().toISOString() }).eq('id', assignment.id)
    if (error) setError(error.message)
    else load()
  }

  if (error) return <ErrorState error={error} onRetry={load} />
  return (
    <section>
      <PageHeader eyebrow="My Tasks" title="Assigned work" description="Staff task view. Staff can see their own assignments but cannot manage the full queue or send tickets to payment." action={<RefreshButton loading={loading} onClick={load} />} />
      <div className="mt-8 grid gap-4">
        {rows.length ? rows.map((row) => (
          <article key={row.id} className="rounded-3xl border border-white/10 bg-[#0d1726] p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{row.task_name || 'Queue service task'}</p>
                <p className="mt-1 text-xs text-slate-500">Ticket {row.booking_id} · <span className="capitalize">{row.status}</span></p>
              </div>
              <button disabled={row.status !== 'active'} onClick={() => markInProgress(row)} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-40">Acknowledge</button>
            </div>
            {row.task_notes && <p className="mt-4 text-sm text-slate-400">{row.task_notes}</p>}
          </article>
        )) : <EmptyLine text="No assigned tasks." />}
      </div>
    </section>
  )
}

export function AccessDeniedPage() {
  return (
    <section className="grid min-h-[60vh] place-items-center">
      <div className="max-w-md rounded-3xl border border-amber-300/20 bg-amber-400/10 p-8 text-center">
        <ShieldAlert className="mx-auto text-amber-200" size={42} />
        <h1 className="mt-5 text-3xl font-semibold">Access denied</h1>
        <p className="mt-3 text-slate-400">Your account does not have access to this queue operations area.</p>
        <Link to="/operations/login" className="mt-6 inline-flex rounded-2xl bg-blue-500 px-5 py-3 font-semibold text-white no-underline">Back to login</Link>
      </div>
    </section>
  )
}

function Panel({ title, icon: Icon, children, className = '' }) {
  return <article className={`rounded-3xl border border-white/10 bg-[#0d1726] p-5 shadow-xl shadow-black/10 sm:p-6 ${className}`}><div className="mb-5 flex items-center gap-3"><Icon className="text-blue-300" size={20} /><h2 className="font-semibold">{title}</h2></div>{children}</article>
}

function CrewList({ title, rows, empty, busy = false }) {
  return (
    <div>
      {title && <h3 className="mb-3 text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">{title}</h3>}
      <div className="grid gap-3">
        {rows.length ? rows.map((row) => <div key={`${row.staff_id}-${row.booking_id || 'free'}`} className="rounded-2xl border border-white/8 bg-white/[0.035] p-4"><p className="font-medium">{row.full_name}</p><p className="mt-1 text-xs text-slate-500">{row.branch_slug || 'All branches'}{busy && row.queue_number ? ` · ${formatQueueNumber(row.queue_number)}` : ''}</p></div>) : <EmptyLine text={empty} />}
      </div>
    </div>
  )
}

function StaffPoolList({ rows, canManage, saving, onAttendance, onEdit, onDeactivate }) {
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ full_name: '', phone: '' })

  if (!rows.length) return <EmptyLine text="No staff in this branch pool yet." />

  return (
    <div className="grid gap-3">
      {rows.map((member) => {
        const present = member.is_present_today
        const busy = member.is_busy_today
        const isEditing = editingId === member.id
        return (
          <div key={member.id} className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{member.full_name}</p>
                <p className="mt-1 text-xs text-slate-500">{member.branch_slug || 'No branch'}{member.phone ? ` · ${member.phone}` : ''}</p>
              </div>
              <span className={`w-fit rounded-full border px-3 py-1 text-[10px] font-bold uppercase ${present ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100' : 'border-slate-300/20 bg-slate-400/10 text-slate-300'}`}>
                {present ? (busy ? 'Deployed' : 'Present') : 'Not attended'}
              </span>
            </div>
            {canManage && isEditing && (
              <form
                className="mt-4 grid gap-2 sm:grid-cols-[1fr_140px_auto_auto]"
                onSubmit={async (event) => {
                  event.preventDefault()
                  await onEdit(member, editForm)
                  setEditingId(null)
                }}
              >
                <input
                  required
                  value={editForm.full_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                />
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="Phone"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                />
                <button type="submit" disabled={saving === `${member.id}-edit`} className="rounded-xl bg-blue-500 px-3 py-2 text-sm font-semibold text-white">Save</button>
                <button type="button" onClick={() => setEditingId(null)} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200">Cancel</button>
              </form>
            )}
            {canManage && !isEditing && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <button type="button" disabled={present || saving === `${member.id}-present`} onClick={() => onAttendance(member, 'present')} className="rounded-xl border border-emerald-300/20 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-40">Mark present</button>
                <button type="button" disabled={!present || saving === `${member.id}-absent`} onClick={() => onAttendance(member, 'absent')} className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40">Mark absent</button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(member.id)
                    setEditForm({ full_name: member.full_name || '', phone: member.phone || '' })
                  }}
                  className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
                >
                  Edit
                </button>
                <button type="button" disabled={saving === `${member.id}-off`} onClick={() => onDeactivate(member)} className="rounded-xl border border-red-300/20 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-400/10 disabled:opacity-40">Remove</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function EmptyLine({ text }) {
  return <p className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">{text}</p>
}

function ErrorState({ error, onRetry }) {
  return <section className="rounded-3xl border border-red-300/20 bg-red-500/10 p-8 text-red-100"><p>{error}</p><button onClick={onRetry} className="mt-4 font-semibold text-white">Try again</button></section>
}

function LoadingPanel() {
  return <div className="grid min-h-72 place-items-center"><LoaderCircle className="animate-spin text-blue-300" /></div>
}

function BranchSetupError() {
  return (
    <section className="grid min-h-[60vh] place-items-center">
      <div className="max-w-md rounded-3xl border border-amber-300/20 bg-amber-400/10 p-8 text-center">
        <ShieldAlert className="mx-auto text-amber-200" size={42} />
        <h1 className="mt-5 text-3xl font-semibold">Branch setup required</h1>
        <p className="mt-3 text-slate-300">Your Team Lead account has no assigned branch. Please contact an admin.</p>
      </div>
    </section>
  )
}

function RefreshButton({ loading, onClick }) {
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5"><RefreshCw className={loading ? 'animate-spin' : ''} size={17} />Refresh</button>
}

function ActionButton({ children, loading, disabled, onClick }) {
  return <button type="button" disabled={disabled || loading} onClick={onClick} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40">{loading ? <LoaderCircle className="animate-spin" size={17} /> : null}{children}</button>
}

function Info({ label, value }) {
  return <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4"><p className="text-[10px] font-bold tracking-[0.16em] text-slate-500 uppercase">{label}</p><p className="mt-2 text-sm text-slate-100">{value || '-'}</p></div>
}

function FormField({ label, value, onChange, type = 'text', required = false, min, step }) {
  return <label className="text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">{label}<input type={type} value={value} onChange={onChange} required={required} min={min} step={step} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-blue-300/60" /></label>
}

function BarChartIcon(props) {
  return <ClipboardList {...props} />
}
