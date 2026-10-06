import { useCallback, useEffect, useMemo, useState } from 'react'
import { BellRing, ChevronDown, ChevronUp, LoaderCircle, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { maintenanceRequest, processMaintenanceArrival } from '@/lib/maintenanceSchedulesClient'
import {
  daysUntilDue,
  maintenanceNeedsOpsAttention,
  maintenanceUrgency,
  matchesMaintenanceSearch,
  openMaintenanceBookingForPlate,
} from '@/lib/paintMaintenance'
import { detailingBoardStatusLabel } from '@/lib/detailingBoardStatuses'
import { bookingDetailingTypeText } from '@/lib/bookingTable'
import { formatQueueNumberForKind } from '@/lib/serviceKinds'
import { formatMoney } from '@/queue/queueApi'
import { BOOKING_PRIMARY_ACTION_LABELS } from '@/queue/queueLogic'
import StatusBadge from '@/components/ops/StatusBadge'
import { cn } from '@/lib/utils'

const MAINTENANCE_STAGE = 'maintenance'

/** Stage the floor board opens on when none is picked: first lane with cars, TL-relevant lanes first. */
const DEFAULT_STAGE_ORDER = ['confirmed', 'waiting', 'in_progress', 'final_checking', 'for_releasing']

const URGENCY_LABEL = { overdue: 'Overdue', due_soon: 'Due soon', upcoming: 'Upcoming', none: 'No date' }

function whenLabel(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function BookingCarCard({ booking, tone, branchName, expanded, onToggle, next, onAdvance, onOpen, readOnlyHint }) {
  const plate = String(booking.vehicle_plate || '').trim().toUpperCase() || 'NO PLATE'
  const vehicle = [booking.vehicle_make, booking.vehicle_model].filter(Boolean).join(' ') || 'Vehicle'
  const size = booking.vehicle_type ? String(booking.vehicle_type).replace(/_/g, ' ') : ''
  const service = bookingDetailingTypeText(booking) || 'Detailing'
  const stage = detailingBoardStatusLabel(booking.status) || booking.status
  const price = Number(booking.final_price_minor ?? booking.price_minor ?? 0)
  const bodyId = `bk-car-${booking.id}`

  return (
    <article className={cn('qmgr-card bk-floor-card', tone)}>
      <button type="button" className="qmgr-card-head" onClick={onToggle} aria-expanded={expanded} aria-controls={bodyId}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="qmgr-plate">{plate}</span>
            <span className={cn('bk-status-pill', tone)}>{stage}</span>
          </div>
          <p className="mt-2 truncate text-base font-semibold text-foreground capitalize">
            {vehicle}
            {size ? <span className="ml-1.5 font-normal text-muted-foreground normal-case">({size})</span> : null}
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-primary">{service}</p>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {whenLabel(booking.scheduled_start)}
            {booking.queue_number != null ? ` · ${formatQueueNumberForKind(booking.queue_number, 'detailing')}` : ''}
          </p>
        </div>
        <span className="qmgr-chevron" aria-hidden>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </button>

      {expanded ? (
        <div className="qmgr-card-body" id={bodyId}>
          <div className="qmgr-meta-grid">
            <div>
              <p className="qmgr-meta-label">Customer</p>
              <p className="qmgr-meta-value">{booking.customer_name || '—'}</p>
            </div>
            <div>
              <p className="qmgr-meta-label">Phone</p>
              <p className="qmgr-meta-value tabular-nums">{booking.customer_phone || 'N/A'}</p>
            </div>
            <div>
              <p className="qmgr-meta-label">Branch</p>
              <p className="qmgr-meta-value capitalize">{branchName || booking.branch || '—'}</p>
            </div>
            <div>
              <p className="qmgr-meta-label">Price</p>
              <p className="qmgr-meta-value qmgr-meta-money">{formatMoney(price)}</p>
            </div>
          </div>
          {booking.notes ? (
            <div>
              <p className="qmgr-meta-label">Notes</p>
              <p className="qmgr-notes">{booking.notes}</p>
            </div>
          ) : null}
          <div className="bk-floor-actions">
            {next ? (
              <button type="button" className="qmgr-open-btn qmgr-open-btn-primary" onClick={() => onAdvance(booking, next)}>
                {BOOKING_PRIMARY_ACTION_LABELS[next] || 'Advance'}
              </button>
            ) : null}
            {onOpen ? (
              <button type="button" className="qmgr-open-btn" onClick={() => onOpen(booking)}>
                Open booking
              </button>
            ) : null}
            {!next && !onOpen && readOnlyHint && !['completed', 'cancelled'].includes(booking.status) ? (
              <p className="text-xs text-muted-foreground">{readOnlyHint}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  )
}

function MaintenanceDueCard({ row, onBoard, canArrive, canWrite, busy, onArrive, onNotify, onShowStage }) {
  const urgency = maintenanceUrgency(row.next_due_at)
  const days = daysUntilDue(row.next_due_at)
  const dueText = days == null ? '' : days < 0 ? ` · ${Math.abs(days)}d late` : ` · ${days}d`
  const badge = urgency === 'overdue' ? 'overdue' : urgency === 'due_soon' ? 'late' : urgency === 'upcoming' ? 'scheduled' : 'queued'
  const service = String(row.service_slug || 'paint maintenance').replace(/-/g, ' ')

  return (
    <article
      className={cn(
        'qmgr-card bk-floor-card bk-floor-maint',
        urgency === 'overdue' && 'is-overdue',
        urgency === 'due_soon' && 'is-due-soon',
      )}
    >
      <div className="qmgr-card-head cursor-default">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="qmgr-plate">{row.plate_number || 'NO PLATE'}</span>
            <StatusBadge status={badge} label={`${URGENCY_LABEL[urgency]}${dueText}`} />
          </div>
          <p className="mt-2 truncate text-base font-semibold text-foreground">{row.customer_name || 'Customer'}</p>
          <p className="mt-0.5 truncate text-sm font-medium capitalize text-primary">{service}</p>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            Due {String(row.next_due_at || '').slice(0, 10) || '—'}
            {row.branch_slug ? ` · ${row.branch_slug}` : ''}
            {row.customer_phone ? ` · ${row.customer_phone}` : ''}
          </p>
          {row.last_notified_at ? (
            <p className="mt-0.5 text-xs text-muted-foreground">Reminded {whenLabel(row.last_notified_at)}</p>
          ) : null}
        </div>
      </div>
      <div className="qmgr-card-body">
        <div className="bk-floor-actions">
          {onBoard ? (
            <button type="button" className="qmgr-open-btn" onClick={() => onShowStage(onBoard.status)}>
              On board · {detailingBoardStatusLabel(onBoard.status) || onBoard.status}
            </button>
          ) : canArrive ? (
            <button type="button" className="qmgr-open-btn qmgr-open-btn-primary gap-2" disabled={busy} onClick={() => onArrive(row)}>
              {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Wrench className="size-4" aria-hidden />}
              Car arrived · Start intake
            </button>
          ) : null}
          {!onBoard && canWrite && (urgency === 'overdue' || urgency === 'due_soon') ? (
            <button type="button" className="qmgr-open-btn gap-2" disabled={busy} onClick={() => onNotify(row)}>
              <BellRing className="size-4" aria-hidden />
              {row.last_notified_at ? 'Remind again' : 'Notify client'}
            </button>
          ) : null}
          {!onBoard && !canArrive && !canWrite ? (
            <p className="text-xs text-muted-foreground">View only</p>
          ) : null}
        </div>
      </div>
    </article>
  )
}

/**
 * Queue-style Bookings board for floor roles (TL / Branch Admin): status cards on top, car cards below.
 * The Maintenance card lists paint-maintenance cars due back; "Car arrived" puts them on Vehicle intake.
 */
export default function BookingFloorBoard({
  columns,
  grouped,
  bookings,
  stage,
  onStageChange,
  searchQuery,
  branchFilter,
  branchNameBySlug,
  nextActionFor,
  onAdvance,
  onOpen,
  onArrived,
  readOnlyHint,
}) {
  const [expandedId, setExpandedId] = useState(null)
  const [maint, setMaint] = useState({ loading: true, schedules: [], canWrite: false, canArrive: false, error: '' })
  const [busyId, setBusyId] = useState(null)

  const loadMaintenance = useCallback(async () => {
    try {
      const query = { status: 'active' }
      if (branchFilter && branchFilter !== 'all') query.branch = branchFilter
      const data = await maintenanceRequest('GET', { query })
      setMaint({
        loading: false,
        schedules: data.schedules || [],
        canWrite: Boolean(data.canWrite),
        canArrive: Boolean(data.canArrive),
        error: '',
      })
    } catch (err) {
      setMaint((m) => ({ ...m, loading: false, error: err.message }))
    }
  }, [branchFilter])

  useEffect(() => {
    loadMaintenance()
  }, [loadMaintenance])

  const maintRows = useMemo(() => {
    const q = String(searchQuery || '').trim()
    if (q) return maint.schedules.filter((row) => matchesMaintenanceSearch(row, q))
    return maint.schedules.filter((row) => maintenanceNeedsOpsAttention(row))
  }, [maint.schedules, searchQuery])

  const activeStage = useMemo(() => {
    if (stage === MAINTENANCE_STAGE || columns.some((c) => c.id === stage)) return stage
    const visible = new Set(columns.map((c) => c.id))
    const busy = DEFAULT_STAGE_ORDER.find((id) => visible.has(id) && grouped[id]?.length)
      || columns.find((c) => grouped[c.id]?.length)?.id
    if (busy) return busy
    if (maintRows.length) return MAINTENANCE_STAGE
    return visible.has('waiting') ? 'waiting' : columns[0]?.id
  }, [stage, columns, grouped, maintRows.length])

  async function arrive(row) {
    setBusyId(row.id)
    try {
      const done = await processMaintenanceArrival(row)
      if (!done) return
      await Promise.all([loadMaintenance(), onArrived?.()])
      onStageChange('waiting')
    } catch (err) {
      toast.error(err.message)
      loadMaintenance()
    } finally {
      setBusyId(null)
    }
  }

  async function notify(row) {
    setBusyId(row.id)
    try {
      const data = await maintenanceRequest('POST', { body: { id: row.id, force: row.status !== 'scheduled' } })
      const sms = data.notify?.sms?.ok ? ' · SMS sent' : ''
      const push = data.notify?.push?.sent ? ' · Push sent' : ''
      toast.success(`Client reminded${sms}${push}`)
      loadMaintenance()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const cards = [
    ...columns.map((c) => ({ id: c.id, label: c.shortLabel || c.label, count: grouped[c.id]?.length || 0, tone: c.tone })),
    {
      id: MAINTENANCE_STAGE,
      label: 'Maintenance',
      count: maint.loading ? null : maintRows.length,
      urgent: maintRows.some((r) => maintenanceUrgency(r.next_due_at) === 'overdue'),
    },
  ]
  const isMaint = activeStage === MAINTENANCE_STAGE
  const list = isMaint ? [] : grouped[activeStage] || []
  const activeColumn = columns.find((c) => c.id === activeStage)

  return (
    <div className="bk-floor">
      <div
        className="bk-floor-status-grid"
        style={{ '--bk-stage-count': cards.length }}
        role="toolbar"
        aria-label="Filter bookings by stage"
      >
        {cards.map((card) => {
          const active = card.id === activeStage
          return (
            <button
              key={card.id}
              type="button"
              className={cn('qmgr-status-card bk-floor-status-card', active && 'qmgr-status-card-active')}
              data-urgent={card.urgent ? 'true' : undefined}
              aria-pressed={active}
              aria-label={`${card.label}: ${card.count ?? 'loading'}`}
              onClick={() => {
                setExpandedId(null)
                onStageChange(card.id)
              }}
            >
              <span className="qmgr-status-card-label bk-floor-status-card-label">{card.label}</span>
              <span className="qmgr-status-card-value">{card.count ?? '…'}</span>
            </button>
          )
        })}
      </div>

      <div className="bk-floor-head">
        <h2 className="bk-floor-title">
          {isMaint ? 'Maintenance due' : activeColumn?.label || 'Bookings'}
        </h2>
        <p className="bk-floor-hint">
          {isMaint
            ? 'Paint-maintenance cars due back. Branch Admin reminds the client; when the car arrives, tap Car arrived to put it on Vehicle intake.'
            : activeColumn?.hint || ''}
        </p>
      </div>

      {isMaint ? (
        <div className="bk-floor-list" aria-live="polite">
          {maint.loading ? (
            Array.from({ length: 2 }, (_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-muted/40" />)
          ) : maint.error ? (
            <p className="qmgr-error" role="alert">{maint.error}</p>
          ) : maintRows.length ? (
            maintRows.map((row) => (
              <MaintenanceDueCard
                key={row.id}
                row={row}
                onBoard={openMaintenanceBookingForPlate(bookings, row.plate_number)}
                canArrive={maint.canArrive}
                canWrite={maint.canWrite}
                busy={busyId === row.id}
                onArrive={arrive}
                onNotify={notify}
                onShowStage={onStageChange}
              />
            ))
          ) : (
            <div className="qmgr-empty bk-floor-empty">
              <p>{String(searchQuery || '').trim() ? 'No maintenance schedule matches that search.' : 'No maintenance cars due right now.'}</p>
              <p className="text-xs">Search a plate above to find cars already reminded.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bk-floor-list" aria-live="polite">
          {list.length ? (
            list.map((booking) => (
              <BookingCarCard
                key={booking.id}
                booking={booking}
                tone={activeColumn?.tone}
                branchName={branchNameBySlug?.[booking.branch]}
                expanded={expandedId === booking.id}
                onToggle={() => setExpandedId((id) => (id === booking.id ? null : booking.id))}
                next={nextActionFor(booking)}
                onAdvance={onAdvance}
                onOpen={onOpen}
                readOnlyHint={readOnlyHint}
              />
            ))
          ) : (
            <div className="qmgr-empty bk-floor-empty">
              <p>No cars in {activeColumn?.label || 'this stage'}.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
