import { useCallback, useEffect, useState } from 'react'
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
import { canAccessPos, canOverrideQueueStatus, canViewRedoLane } from '../auth/permissions'
import { finalCheckActionLabel, sendToPaymentActionLabel, showQueueRedoAction, showQueueTicketEditActions } from '../lib/uiDeadControls'
import { supabase } from '../lib/supabase'
import {
  formatQueueNumber,
  getAdminOverrideTargets,
  getQueueTicketActionFlags,
  isSuspiciousTiming,
  parsePesoInputToMinor,
  STATUS_LABELS,
} from '../queue/queueLogic'
import {
  addServiceToVisit,
  adminOverrideTicketStatus,
  assignStaff,
  fetchServices,
  fetchTicket,
  fetchVisitLines,
  formatMoney,
  markTicketRedo,
  sendTicketToPayment,
  updateTicketPrice,
  updateTicketStatus,
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

function ActionButton({ children, loading, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className="floor-touch-btn inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
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

/**
 * Shared queue ticket editor for full page + board modal.
 * @param {'page' | 'modal'} variant
 */
export default function QueueTicketEditor({ bookingId, variant = 'page', onUpdated, onClose }) {
  const { user, profile, canManageQueue, canViewQueueOperations } = useAuth()
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
  const actions = getQueueTicketActionFlags(ticket.status, {
    canManageQueue,
    canViewRedoLane: showRedoBtn,
  })
  const overrideTargets = canOverrideQueueStatus(profile) ? getAdminOverrideTargets(ticket.status) : []
  const canAddService = showEditActions && ['waiting', 'in_progress'].includes(ticket.status)
  const visitTotalMinor = visitLines.reduce(
    (sum, line) => sum + Number(line.final_price_minor ?? line.base_price_minor ?? 0),
    0,
  )
  const timingWarn = isSuspiciousTiming(ticket)
  const parsedPrice = Number(String(price).replace(/,/g, '').trim())
  const showLowPriceWarning = Number.isFinite(parsedPrice) && parsedPrice > 0 && parsedPrice < 50
  const qLabel = formatQueueNumber(ticket.queue_number, ticket.service_pay_category)

  const savePrice = () => {
    const amountMinor = parsePesoInputToMinor(price)
    if (amountMinor < 5000 && !window.confirm('Please confirm this amount is correct. Did you mean a higher peso amount?')) {
      return Promise.resolve()
    }
    return updateTicketPrice(ticket, amountMinor, priceReason, user.id)
  }
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
        <div className="mb-3 min-w-0 pr-8">
          <p className="text-[10px] font-bold tracking-[0.18em] text-primary uppercase">
            {STATUS_LABELS[ticket.status] || ticket.status}
            {ticket.branch ? ` · ${ticket.branch}` : ''}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            {qLabel} · {ticket.customer_name}
          </h2>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {ticket.vehicle_plate || 'No plate'} · {ticket.service_name || 'Service'}
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

      <div className={`grid gap-3 ${variant === 'modal' ? '' : 'xl:grid-cols-[1fr_360px] sm:gap-5'}`}>
        {showEditActions ? (
          <div className={variant === 'modal' ? 'floor-actions-sticky order-first' : 'order-2 xl:order-2'}>
            <Panel title="Status Actions" icon={ArrowRight} className={variant === 'modal' ? 'shadow-none' : ''}>
              <div className="grid gap-2.5">
                <ActionButton
                  disabled={!actions.canStart}
                  loading={saving === 'start'}
                  onClick={() => runAction('start', () => updateTicketStatus(ticket, 'in_progress'))}
                >
                  Start Service
                </ActionButton>
                <ActionButton
                  disabled={!actions.canFinalCheck}
                  loading={saving === 'check'}
                  onClick={() => runAction('check', () => updateTicketStatus(ticket, 'final_checking'))}
                >
                  {finalCheckActionLabel(canOpenPos)}
                </ActionButton>
                <ActionButton
                  disabled={!actions.canSendToPayment}
                  loading={saving === 'payment'}
                  onClick={() => runAction('payment', () => sendTicketToPayment(ticket.booking_id))}
                >
                  <Send size={17} aria-hidden />
                  {sendToPaymentActionLabel(canOpenPos)}
                </ActionButton>
                {showRedoBtn ? (
                  <ActionButton disabled={!actions.canMarkRedo} loading={saving === 'redo'} onClick={() => runAction('redo', runRedo)}>
                    <ShieldAlert size={17} aria-hidden />
                    Mark redo
                  </ActionButton>
                ) : null}
              </div>
              {!canOpenPos ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Branch Admin or ASA opens POS to collect payment after you send the handoff.
                </p>
              ) : null}
            </Panel>
          </div>
        ) : null}

        <Panel title="Ticket Details" icon={CarFront} className={variant === 'modal' ? '' : 'order-1'}>
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
        </Panel>

        {showEditActions ? (
          <Panel title="Edit Price" icon={BadgeCheck}>
            <div className="grid gap-3">
              <label className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                Final Price in Pesos
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
                Reason
                <input
                  value={priceReason}
                  onChange={(event) => setPriceReason(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground outline-none focus:border-primary/60"
                />
              </label>
              <ActionButton loading={saving === 'price'} onClick={() => runAction('price', savePrice)}>
                Save Price
              </ActionButton>
            </div>
          </Panel>
        ) : null}
      </div>

      <Panel title="Visit Services" icon={Layers} className="mt-3 sm:mt-4">
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

      <Panel title="Staff Assignment" icon={UserPlus} className="mt-3 sm:mt-4">
        <div className={`grid gap-4 ${variant === 'modal' ? '' : 'lg:grid-cols-[1fr_280px]'}`}>
          <div className="grid gap-3 sm:grid-cols-2">
            {staff.map((member) => {
              const active = selectedStaff.includes(member.id)
              return (
                <label
                  key={member.id}
                  className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl border p-4 transition ${showEditActions ? 'cursor-pointer' : ''} ${active ? 'border-primary/40 bg-primary/10' : 'border-border bg-muted/20'}`}
                >
                  <span>
                    <span className="block font-medium text-foreground">{member.full_name}</span>
                    <span className="text-xs text-muted-foreground">{member.branch_slug || 'All branches'}</span>
                  </span>
                  <input
                    type="checkbox"
                    className="size-5 accent-blue-500"
                    checked={active}
                    disabled={!showEditActions}
                    onChange={(event) =>
                      setSelectedStaff((current) =>
                        event.target.checked ? [...current, member.id] : current.filter((idValue) => idValue !== member.id),
                      )
                    }
                  />
                </label>
              )
            })}
            {!staff.length && <p className="text-sm text-muted-foreground">No staff available for this branch.</p>}
          </div>
          <div>
            {showEditActions ? (
              <ActionButton loading={saving === 'assign'} onClick={() => runAction('assign', () => assignStaff(ticket, selectedStaff))}>
                Save Assignments
              </ActionButton>
            ) : null}
            <div className={`grid gap-2 text-sm text-muted-foreground ${showEditActions ? 'mt-4' : ''}`}>
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
      </Panel>

      {variant === 'modal' && showEditActions ? (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          <Link to={`/operations/queue/${ticket.booking_id}`} className="font-semibold text-primary underline-offset-2 hover:underline">
            Open full ticket page
          </Link>
        </p>
      ) : null}
    </div>
  )
}
