import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  CarFront,
  Layers,
  LoaderCircle,
  Send,
  ShieldAlert,
  Undo2,
  UserPlus,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { canAccessPos, canMarkFailedQa, canModifyBookingServicePrice, canOverrideQueueStatus, canSeeForPaymentLane, canViewRedoLane } from '../auth/permissions'
import { finalCheckActionLabel, sendToPaymentActionLabel, showQueueRedoAction, showQueueTicketEditActions } from '../lib/uiDeadControls'
import { PRICING_SIZES } from '../lib/servicePricing'
import { serviceKindFromPayCategory } from '../lib/serviceKinds'
import CancellationReasonDialog from './CancellationReasonDialog'
import { supabase } from '../lib/supabase'
import {
  formatQueueNumber,
  getAdminOverrideTargets,
  getQueueTicketActionFlags,
  isSuspiciousTiming,
  normalizeVehicleType,
  parsePesoInputToMinor,
  STATUS_LABELS,
  crewRequiredForPayCategory,
} from '../queue/queueLogic'
import {
  addServiceToVisit,
  adminOverrideTicketStatus,
  assignStaff,
  cancelQueueTicket,
  fetchServices,
  fetchTicket,
  fetchVisitLines,
  formatMoney,
  markTicketRedo,
  sendTicketToPayment,
  updateTicketPrice,
  updateTicketStatus,
  updateTicketVehicleType,
} from '../queue/queueApi'

function Panel({ title, icon: Icon, children, className = '' }) {
  return (
    <article className={`rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5 ${className}`}>
      <div className="mb-3 flex items-center gap-3">
        <Icon className="text-primary" size={18} aria-hidden />
        <h2 className="font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </article>
  )
}

function ActionButton({ children, loading, disabled, onClick, tone = 'primary' }) {
  const look =
    tone === 'secondary'
      ? 'border border-primary/25 bg-primary/10 text-foreground hover:bg-primary/15'
      : 'bg-primary text-primary-foreground hover:opacity-90'
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className={`floor-touch-btn inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98] ${look}`}
    >
      {loading ? <LoaderCircle className="animate-spin" size={17} aria-hidden /> : null}
      {children}
    </button>
  )
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-3.5 sm:p-4">
      <p className="text-[10px] font-bold tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 text-sm text-foreground">{value || '-'}</p>
    </div>
  )
}

function Fact({ label, value }) {
  return (
    <div className="queue-ticket-fact">
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  )
}

function CrewPicker({
  staff,
  selectedStaff,
  setSelectedStaff,
  assignments,
  staffById,
  saving,
  onSave,
  compact = false,
}) {
  return (
    <div className={`grid gap-4 ${compact ? '' : 'lg:grid-cols-[1fr_280px]'}`}>
      <div className={`grid gap-3 ${compact ? '' : 'sm:grid-cols-2'}`}>
        {staff.map((member) => {
          const active = selectedStaff.includes(member.id)
          const busy = Boolean(member.is_busy_today)
          return (
            <label
              key={member.id}
              className={`flex min-h-11 items-center justify-between gap-3 rounded-2xl border p-3 transition ${!busy ? 'cursor-pointer' : ''} ${active ? 'border-primary/40 bg-primary/10' : 'border-border bg-muted/20'} ${busy ? 'opacity-55' : ''}`}
            >
              <span>
                <span className="block font-medium text-foreground">{member.full_name}</span>
                <span className="text-xs text-muted-foreground">
                  {busy ? 'Busy on another job' : member.branch_slug || 'Timed in'}
                </span>
              </span>
              <input
                type="checkbox"
                className="size-5 accent-primary"
                checked={active}
                disabled={busy}
                onChange={(event) =>
                  setSelectedStaff((current) =>
                    event.target.checked ? [...current, member.id] : current.filter((idValue) => idValue !== member.id),
                  )
                }
              />
            </label>
          )
        })}
        {!staff.length && (
          <p className="text-sm text-muted-foreground">
            No present crew for this branch. Have staff time in inside the 20m geofence first.
          </p>
        )}
      </div>
      <div>
        <ActionButton tone={compact ? 'secondary' : 'primary'} loading={saving === 'assign'} onClick={onSave}>
          Save crew
        </ActionButton>
        <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
          {assignments.length ? (
            assignments.map((assignment) => (
              <p key={assignment.id}>
                {staffById.get(assignment.staff_id)?.full_name || assignment.staff_id}:{' '}
                <span className="capitalize text-foreground">{assignment.status}</span>
              </p>
            ))
          ) : (
            <p>No assignment history yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Shared queue ticket editor for full page + board modal.
 * @param {'page' | 'modal'} variant
 */
export default function QueueTicketEditor({ bookingId, variant = 'page', onUpdated, onClose }) {
  const { user, profile, canManageQueue, canViewQueueOperations } = useAuth()
  const canEditServicePrice = canModifyBookingServicePrice(profile)
  const [ticket, setTicket] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [staff, setStaff] = useState([])
  const [selectedStaff, setSelectedStaff] = useState([])
  const [price, setPrice] = useState('')
  const [priceReason, setPriceReason] = useState('')
  const [visitLines, setVisitLines] = useState([])
  const [services, setServices] = useState([])
  const [addServiceId, setAddServiceId] = useState('')
  const [addServicePrice, setAddServicePrice] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [vehicleTypeDraft, setVehicleTypeDraft] = useState('medium')
  const [priceOpen, setPriceOpen] = useState(false)
  const crewPanelRef = useRef(null)

  const load = useCallback(async () => {
    if (!bookingId) return
    setLoadError('')
    try {
      const data = await fetchTicket(bookingId, profile)
      setTicket(data.ticket)
      setAssignments(data.assignments)
      setStaff(data.staff)
      setSelectedStaff(data.assignments.filter((a) => a.status === 'active').map((a) => a.staff_id))
      setPrice(String(((data.ticket?.final_price_minor ?? data.ticket?.base_price_minor ?? 0) / 100) || ''))
      setPriceReason('')
      setVehicleTypeDraft(normalizeVehicleType(data.ticket?.vehicle_type || 'medium'))
      if (data.ticket) {
        const lines = await fetchVisitLines(data.ticket).catch(() => [])
        setVisitLines(lines)
      } else {
        setVisitLines([])
      }
    } catch (err) {
      setLoadError(err.message)
      setTicket(null)
    } finally {
      setLoading(false)
    }
  }, [bookingId, profile])

  useEffect(() => {
    if (!canManageQueue) return undefined
    let cancelled = false
    fetchServices()
      .then((rows) => {
        if (!cancelled) setServices(rows)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [canManageQueue])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  useEffect(() => {
    if (!bookingId) return undefined
    const channel = supabase
      .channel(`queue-ticket-editor-${bookingId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `id=eq.${bookingId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_assignments', filter: `booking_id=eq.${bookingId}` }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [bookingId, load])

  const runAction = async (label, action) => {
    setSaving(label)
    setActionError('')
    try {
      await action()
      await load()
      onUpdated?.()
    } catch (err) {
      console.error('Queue action failed', err)
      setActionError(err.message)
    } finally {
      setSaving('')
    }
  }

  if (!canViewQueueOperations) {
    return <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">You cannot view this ticket.</p>
  }

  if (loading) {
    return (
      <div className="grid min-h-48 place-items-center">
        <LoaderCircle className="animate-spin text-primary" aria-label="Loading ticket" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100" role="alert">
        <p>{loadError}</p>
        <button type="button" onClick={load} className="mt-3 font-semibold text-foreground underline">
          Try again
        </button>
      </div>
    )
  }

  if (!ticket) {
    return <p className="text-sm text-muted-foreground">Ticket not found.</p>
  }

  const staffById = new Map(staff.map((item) => [item.id, item]))
  const showEditActions = showQueueTicketEditActions(canManageQueue)
  const showRedoBtn = showQueueRedoAction(canViewRedoLane(profile))
  const canOpenPos = canAccessPos(profile)
  const canSeePayment = canSeeForPaymentLane(profile)
  const ticketKind = serviceKindFromPayCategory(ticket.service_pay_category || ticket.pay_category)
  const showFailedQa = canMarkFailedQa(profile) && ticketKind !== 'detailing'
  const actions = getQueueTicketActionFlags(ticket.status, {
    canManageQueue,
    canViewRedoLane: showRedoBtn,
    canSeePayment,
    canFailQa: showFailedQa,
  })
  const overrideTargets = canOverrideQueueStatus(profile) ? getAdminOverrideTargets(ticket.status) : []
  const canAddService =
    showEditActions && canEditServicePrice && ['waiting', 'in_progress'].includes(ticket.status)
  const visitTotalMinor = visitLines.reduce(
    (sum, line) => sum + Number(line.final_price_minor ?? line.base_price_minor ?? 0),
    0,
  )
  const timingWarn = isSuspiciousTiming(ticket)
  const parsedPrice = Number(String(price).replace(/,/g, '').trim())
  const showLowPriceWarning = Number.isFinite(parsedPrice) && parsedPrice > 0 && parsedPrice < 50
  const qLabel = formatQueueNumber(ticket.queue_number, ticket.service_pay_category)
  const needCrewToStart = crewRequiredForPayCategory(ticket.service_pay_category || ticket.pay_category)
  const freeSelectedCrew = selectedStaff.filter((id) => {
    const row = staff.find((m) => m.id === id)
    return row && !row.is_busy_today
  })
  const startBlockedByCrew = Boolean(actions.canStart && needCrewToStart && !freeSelectedCrew.length)

  const savePrice = () => {
    const amountMinor = parsePesoInputToMinor(price)
    if (amountMinor < 5000 && !window.confirm('Please confirm this amount is correct. Did you mean a higher peso amount?')) {
      return Promise.resolve()
    }
    return updateTicketPrice(ticket, amountMinor, priceReason, user.id)
  }
  const saveVehicleType = () =>
    updateTicketVehicleType(ticket, vehicleTypeDraft, { servicesCatalog: services })
  const runRedo = () => {
    const reason = window.prompt('Redo reason (visible to owner in audit)', ticket.redo_reason || '')
    if (reason === null) return Promise.resolve()
    return markTicketRedo(ticket, reason)
  }
  const runAddService = async () => {
    const service = services.find((item) => item.id === addServiceId)
    if (!service) throw new Error('Pick a service to add.')
    const override = addServicePrice.trim() ? parsePesoInputToMinor(addServicePrice) : null
    await addServiceToVisit(ticket, service, { priceMinor: override })
    setAddServiceId('')
    setAddServicePrice('')
  }
  const runOverride = (target) => {
    const reason = window.prompt(`Move this ticket back to ${STATUS_LABELS[target]}? Reason (visible in audit):`, '')
    if (reason === null) return Promise.resolve()
    return adminOverrideTicketStatus(ticket, target, reason)
  }
  const runStart = async () => {
    if (startBlockedByCrew) {
      crewPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      throw new Error('Assign present crew first (checkboxes above), then tap Start Service.')
    }
    if (freeSelectedCrew.length) {
      await assignStaff(ticket, freeSelectedCrew)
      if (ticket.status !== 'waiting') {
        await updateTicketStatus({ ...ticket, status: ticket.status }, 'in_progress')
      }
    } else {
      await updateTicketStatus(ticket, 'in_progress')
    }
  }

  return (
    <div className={variant === 'modal' ? 'queue-ticket-editor-modal' : 'queue-ticket-editor-page'}>
      {variant === 'page' ? (
        <div className="floor-compact-header mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.22em] text-primary uppercase">Queue Ticket</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {qLabel} · {ticket.customer_name}
            </h1>
            <p className="floor-desc mt-2 text-sm text-muted-foreground">
              {ticket.branch} · {STATUS_LABELS[ticket.status] || ticket.status}
              {ticket.service_pay_category === 'detailing' ? ' · Multi-day detailing' : ''}
            </p>
          </div>
          {onClose ? (
            <button type="button" onClick={onClose} className="floor-touch-btn inline-flex items-center rounded-2xl border border-border px-4 py-2.5 text-sm font-semibold">
              Back to queue
            </button>
          ) : (
            <Link to="/operations/queue" className="floor-touch-btn inline-flex items-center rounded-2xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground no-underline">
              Back to queue
            </Link>
          )}
        </div>
      ) : (
        <div className="queue-ticket-identity">
          <p className="queue-ticket-bay-kicker">
            {STATUS_LABELS[ticket.status] || ticket.status}
            {ticket.branch ? ` · ${ticket.branch}` : ''}
          </p>
          <p className="queue-ticket-bay-plate">{ticket.vehicle_plate || 'No plate'}</p>
          <h2 className="queue-ticket-bay-title">
            {qLabel} · {ticket.customer_name}
          </h2>
          <p className="queue-ticket-bay-meta">
            {ticket.service_name || 'Service'} · {formatMoney(ticket.final_price_minor ?? ticket.base_price_minor)}
          </p>
          <p className="queue-ticket-bay-meta">
            {[ticket.vehicle_year, ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(' ') || 'Vehicle'}
          </p>
        </div>
      )}

      {actionError && (
        <p className="mb-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-950 dark:text-red-100" role="alert">
          {actionError}
        </p>
      )}
      {!showEditActions && (
        <p className="mb-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-100">
          View only. Team Lead runs floor status. Use POS to take payment after final check.
        </p>
      )}
      {timingWarn && (
        <p className="mb-3 flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-100">
          <ShieldAlert size={16} aria-hidden />
          Suspicious timing: in progress → final check was under the configured threshold.
        </p>
      )}

      {overrideTargets.length ? (
        <Panel title="Admin Override" icon={Undo2} className="mb-3">
          <p className="text-sm text-muted-foreground">
            Move this ticket back to an earlier lane. Leaving For Payment cancels the pending POS handoff.
          </p>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
            {overrideTargets.map((target) => (
              <button
                key={target}
                type="button"
                disabled={Boolean(saving)}
                onClick={() => runAction(`override-${target}`, () => runOverride(target))}
                className="floor-touch-btn inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm font-semibold text-foreground transition hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving === `override-${target}` ? <LoaderCircle className="animate-spin" size={16} aria-hidden /> : null}
                Back to {STATUS_LABELS[target]}
              </button>
            ))}
          </div>
        </Panel>
      ) : null}

      <div className={variant === 'modal' ? 'queue-ticket-grid' : 'grid gap-3'}>
        {showEditActions ? (
          <div ref={crewPanelRef} className={variant === 'modal' ? 'queue-ticket-crew' : 'order-1'}>
            {variant === 'modal' ? (
              <details
                className="queue-ticket-crew-fold rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm"
                defaultOpen={startBlockedByCrew}
              >
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 font-semibold text-foreground">
                  <UserPlus className="text-primary" size={18} aria-hidden />
                  1 · Assign crew
                </summary>
                <p className="mb-3 mt-3 text-sm text-muted-foreground">
                  {needCrewToStart
                    ? 'Open this list, tick a present crew member, then Start.'
                    : 'Optional for packages. Only staff timed in today (present or late).'}
                </p>
                <CrewPicker
                  staff={staff}
                  selectedStaff={selectedStaff}
                  setSelectedStaff={setSelectedStaff}
                  assignments={assignments}
                  staffById={staffById}
                  saving={saving}
                  onSave={() => runAction('assign', () => assignStaff(ticket, selectedStaff))}
                  compact
                />
              </details>
            ) : (
              <Panel title="1 · Assign crew" icon={UserPlus}>
                <p className="mb-3 text-sm text-muted-foreground">
                  {needCrewToStart
                    ? 'Required before Start Service. Only staff timed in today (present or late). Busy crew stay locked.'
                    : 'Optional for packages. Only staff timed in today (present or late).'}
                </p>
                <CrewPicker
                  staff={staff}
                  selectedStaff={selectedStaff}
                  setSelectedStaff={setSelectedStaff}
                  assignments={assignments}
                  staffById={staffById}
                  saving={saving}
                  onSave={() => runAction('assign', () => assignStaff(ticket, selectedStaff))}
                />
              </Panel>
            )}
          </div>
        ) : null}

        {showEditActions ? (
          <div className={variant === 'modal' ? 'queue-ticket-actions' : 'order-2'}>
            <Panel title="2 · Status actions" icon={ArrowRight} className={variant === 'modal' ? 'shadow-none' : ''}>
              <div className={variant === 'modal' ? 'queue-action-stack' : 'grid gap-2.5'}>
                <ActionButton
                  disabled={!actions.canStart}
                  loading={saving === 'start'}
                  onClick={() => runAction('start', runStart)}
                >
                  {startBlockedByCrew ? 'Select crew above, then Start' : 'Start Service'}
                </ActionButton>
                {startBlockedByCrew ? (
                  <p className="text-xs text-amber-800 dark:text-amber-100">
                    Tick at least one present crew member in Assign crew, then Start.
                  </p>
                ) : null}
                <div className={variant === 'modal' ? 'queue-action-secondary' : 'contents'}>
                  <ActionButton
                    tone="secondary"
                    disabled={!actions.canFinalCheck}
                    loading={saving === 'check'}
                    onClick={() => runAction('check', () => updateTicketStatus(ticket, 'final_checking'))}
                  >
                    {finalCheckActionLabel(canOpenPos)}
                  </ActionButton>
                  {canSeePayment ? (
                    <ActionButton
                      tone="secondary"
                      disabled={!actions.canSendToPayment}
                      loading={saving === 'payment'}
                      onClick={() => runAction('payment', () => sendTicketToPayment(ticket.booking_id))}
                    >
                      <Send size={17} aria-hidden />
                      {sendToPaymentActionLabel(canOpenPos)}
                    </ActionButton>
                  ) : null}
                  {showRedoBtn ? (
                    <ActionButton
                      tone="secondary"
                      disabled={!actions.canMarkRedo}
                      loading={saving === 'redo'}
                      onClick={() => runAction('redo', runRedo)}
                    >
                      <ShieldAlert size={17} aria-hidden />
                      Mark redo
                    </ActionButton>
                  ) : null}
                  {showFailedQa && actions.canMarkFailedQa ? (
                    <ActionButton
                      tone="secondary"
                      loading={saving === 'failqa'}
                      onClick={() => runAction('failqa', () => {
                        const reason = window.prompt('Failed QA reason (visible in audit):', '')
                        if (reason === null) return Promise.resolve()
                        return markTicketRedo(ticket, reason || 'Failed QA')
                      })}
                    >
                      <Undo2 size={17} aria-hidden />
                      Failed QA
                    </ActionButton>
                  ) : null}
                </div>
                {actions.canCancel ? (
                  <button
                    type="button"
                    className="floor-touch-btn inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-5 py-3 font-semibold text-destructive transition disabled:opacity-40 active:scale-[0.98]"
                    disabled={saving === 'cancel'}
                    onClick={() => setCancelOpen(true)}
                  >
                    Cancel ticket
                  </button>
                ) : null}
              </div>
              {canSeePayment ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Payment collection stays on POS after Send to payment.
                </p>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  Final check keeps the car on your board. Branch Admin sends it to payment / POS.
                </p>
              )}
            </Panel>
          </div>
        ) : null}

        <Panel title="Ticket details" icon={CarFront} className={variant === 'modal' ? 'queue-ticket-identity-details' : 'order-3'}>
          {variant === 'modal' ? (
            <dl className="queue-ticket-facts">
              <Fact label="Customer" value={ticket.customer_name} />
              <Fact label="Contact" value={ticket.customer_phone || 'No contact'} />
              <Fact label="Plate" value={ticket.vehicle_plate || 'No plate'} />
              <Fact label="Vehicle" value={[ticket.vehicle_year, ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(' ')} />
              <Fact label="Service" value={ticket.service_name || 'Service'} />
              <Fact label="Price" value={formatMoney(ticket.final_price_minor ?? ticket.base_price_minor)} />
              <Fact label="Created" value={new Date(ticket.created_at).toLocaleString()} />
              <Fact label="Notes" value={ticket.notes || 'No internal notes'} />
              {ticket.redo_reason ? <Fact label="Redo reason" value={ticket.redo_reason} /> : null}
            </dl>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Customer" value={ticket.customer_name} />
              <Info label="Contact" value={ticket.customer_phone || 'No contact'} />
              <Info label="Plate" value={ticket.vehicle_plate || 'No plate'} />
              <Info label="Vehicle" value={[ticket.vehicle_year, ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(' ')} />
              <Info label="Service" value={ticket.service_name || 'Service'} />
              <Info label="Price" value={formatMoney(ticket.final_price_minor ?? ticket.base_price_minor)} />
              <Info label="Created" value={new Date(ticket.created_at).toLocaleString()} />
              <Info label="Notes" value={ticket.notes || 'No internal notes'} />
              {ticket.redo_reason && <Info label="Redo reason" value={ticket.redo_reason} />}
            </div>
          )}
          {showEditActions && canEditServicePrice ? (
            <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-muted/20 p-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                Car size (pricing)
                <select
                  value={vehicleTypeDraft}
                  onChange={(event) => setVehicleTypeDraft(normalizeVehicleType(event.target.value))}
                  className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-3 py-3 text-base text-foreground outline-none focus:border-primary/60"
                >
                  {PRICING_SIZES.map((size) => (
                    <option key={size.slug} value={size.slug}>
                      {size.label}
                    </option>
                  ))}
                </select>
              </label>
              <ActionButton
                loading={saving === 'size'}
                disabled={vehicleTypeDraft === normalizeVehicleType(ticket.vehicle_type || 'medium')}
                onClick={() => runAction('size', saveVehicleType)}
              >
                Save car size
              </ActionButton>
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                Changes Small / Medium / Large / Extra Large for size-based pricing (e.g. Fortuner → Large).
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Car size:{' '}
              <span className="font-semibold capitalize text-foreground">
                {String(ticket.vehicle_type || 'medium').replace(/_/g, ' ')}
              </span>
              {showEditActions && !canEditServicePrice ? (
                <span className="mt-1 block text-xs">Service and price changes go through Sales.</span>
              ) : null}
            </p>
          )}
        </Panel>

        <Panel title="Services on this visit" icon={Layers} className={variant === 'modal' ? 'queue-ticket-services' : 'order-4'}>
          <p className="mb-3 text-sm text-muted-foreground">
            Line items billed for this car today.
            {canEditServicePrice
              ? ' Add another service here if the customer upsels on the floor.'
              : ' Additional services must be added by Sales.'}
          </p>
          <div className="grid gap-2">
            {visitLines.map((line) => (
              <div
                key={line.booking_id}
                className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-border bg-muted/20 px-4 py-3"
              >
                <span className="min-w-0 truncate text-sm font-medium text-foreground">
                  {line.service_name || 'Service'}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {formatMoney(line.final_price_minor ?? line.base_price_minor ?? 0)}
                </span>
              </div>
            ))}
            {!visitLines.length && <p className="text-sm text-muted-foreground">No service lines found for this visit.</p>}
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
              <span className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">Visit total</span>
              <span className="text-base font-semibold tabular-nums text-foreground">{formatMoney(visitTotalMinor)}</span>
            </div>
          </div>
          {canAddService ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
              <label className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                Add service
                <select
                  value={addServiceId}
                  onChange={(event) => setAddServiceId(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-3 py-3 text-base text-foreground outline-none focus:border-primary/60"
                >
                  <option value="">Pick a service…</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                Price (optional)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={addServicePrice}
                  onChange={(event) => setAddServicePrice(event.target.value)}
                  placeholder="Auto by size"
                  className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-3 py-3 text-base text-foreground outline-none focus:border-primary/60"
                />
              </label>
              <ActionButton loading={saving === 'add-service'} onClick={() => runAction('add-service', runAddService)}>
                Add to visit
              </ActionButton>
            </div>
          ) : showEditActions ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Services can be added while the ticket is waiting or in progress.
            </p>
          ) : null}
        </Panel>

        {showEditActions && canEditServicePrice ? (
          <details
            className={
              variant === 'modal'
                ? 'queue-ticket-price rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5'
                : 'order-5 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5'
            }
            open={priceOpen}
            onToggle={(event) => setPriceOpen(event.currentTarget.open)}
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 font-semibold text-foreground">
              <BadgeCheck className="text-primary" size={18} aria-hidden />
              Adjust price (optional)
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">
              Price is already set when you create the ticket. Only open this to override — reason is optional.
            </p>
            <div className="mt-3 grid gap-3">
              <label className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                Final price in pesos
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground outline-none focus:border-primary/60"
                />
              </label>
              {showLowPriceWarning && (
                <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
                  Please confirm this amount is correct. Did you mean a higher peso amount?
                </p>
              )}
              <label className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                Reason (optional)
                <input
                  value={priceReason}
                  onChange={(event) => setPriceReason(event.target.value)}
                  placeholder="Why the price changed"
                  className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground outline-none focus:border-primary/60"
                />
              </label>
              <ActionButton loading={saving === 'price'} onClick={() => runAction('price', savePrice)}>
                Save price
              </ActionButton>
            </div>
          </details>
        ) : null}
      </div>

      {variant === 'modal' && showEditActions ? (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          <Link to={`/operations/queue/${ticket.booking_id}`} className="font-semibold text-primary underline-offset-2 hover:underline">
            Open full ticket page
          </Link>
        </p>
      ) : null}

      <CancellationReasonDialog
        open={cancelOpen}
        title="Cancel ticket"
        loading={saving === 'cancel'}
        onClose={() => setCancelOpen(false)}
        onConfirm={(reason) => {
          runAction('cancel', async () => {
            await cancelQueueTicket(ticket, reason)
            setCancelOpen(false)
          })
        }}
      />
    </div>
  )
}
