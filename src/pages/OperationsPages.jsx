import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
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
  Wallet,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { listVehicleSizes } from '../lib/adminApi'
import { resolveServicePriceMinor } from '../lib/servicePricing'
import VehicleMakeModelFields from '../components/VehicleMakeModelFields'
import ServiceKindPicker from '../components/ServiceKindPicker'
import { serviceKindFromPayCategory } from '../lib/serviceKinds'
import { CrewAttendancePanel, CrewSettingsPanel } from './crew/CrewAttendancePanels'
import { splitCustomerName } from '../lib/phVehicles'
import { canAccessPos, canEditAttendanceRoles, canEditAttendanceSettings, canSeeAllBranches, canViewRedoLane, redirectForRole, ROLES } from '../auth/permissions'
import QueueTicketEditModal from '../components/QueueTicketEditModal'
import QueueTicketEditor from '../components/QueueTicketEditor'
import TeamLeadQueuePage from './TeamLeadQueuePage'
import {
  formatQueueNumber,
  getBranchScope,
  getBranchScopeList,
  getDashboardDateRange,
  getOpsBoardStatuses,
  getPlateLookupStatus,
  getQueueCounts,
  groupVisitTickets,
  isSuspiciousTiming,
  normalizeVehicleType,
  operationsQueueHref,
  parseQueueLaneParam,
  queueByBranchCounts,
  requiresTeamLeadBranchSetup,
  canOverrideQueueBranches,
  DASHBOARD_DATE_PRESETS,
  STATUS_LABELS,
} from '../queue/queueLogic'
import { getLocalCalendarDate } from '../lib/localCalendarDate'
import {
  addStaffMember,
  acknowledgeQueueAssignment,
  completeQueueAssignment,
  createQueueTicket,
  deactivateCrewStaffMember,
  fetchBranches,
  fetchBranchSalesBoard,
  fetchOperationsSnapshot,
  fetchServices,
  formatMoney,
  lookupPlate,
  setStaffAttendance,
  updateCrewStaffMember,
} from '../queue/queueApi'
import { geoTimeIn, geoTimeOut, readBrowserPosition } from '../queue/attendanceApi'
import { allowedStaffPlanAssigneePatch } from '../queue/staffTaskLogic'
import { createCoalescedReload } from '../lib/coalesceReload'
import { toast } from 'sonner'

const statusTone = {
  waiting: 'queue-status-pill queue-status-waiting',
  in_progress: 'queue-status-pill queue-status-progress',
  final_checking: 'queue-status-pill queue-status-check',
  for_payment: 'queue-status-pill queue-status-pay',
  redo: 'queue-status-pill queue-status-redo',
  completed: 'queue-status-pill queue-status-done',
}

const LANE_META = {
  waiting: { icon: Clock3, hint: 'Ready to start' },
  in_progress: { icon: CarFront, hint: 'On the bay' },
  final_checking: { icon: BadgeCheck, hint: 'QC before payment' },
  for_payment: { icon: Send, hint: 'Collect at POS' },
  redo: { icon: ShieldAlert, hint: 'Owner QC fail lane' },
}

const FALLBACK_VEHICLE_TYPES = [
  { label: 'Small', value: 'small' },
  { label: 'Medium', value: 'medium' },
  { label: 'Large', value: 'large' },
  { label: 'Extra Large', value: 'extra_large' },
]

function PageHeader({ eyebrow, title, description, action, live = false }) {
  return (
    <div className="floor-compact-header flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-bold tracking-[0.22em] text-primary uppercase">{eyebrow}</p>
          {live ? (
            <span className="floor-live-pill" aria-live="polite">
              <span className="floor-live-dot" aria-hidden />
              Live
            </span>
          ) : null}
      </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        {description && <p className="floor-desc mt-2 max-w-2xl text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  )
}

function MetricCard({ label, value, icon: Icon, tone = 'blue', to, hint }) {
  const colors = tone === 'green' ? 'text-emerald-700 bg-emerald-500/15 dark:text-emerald-200 dark:bg-emerald-400/10' : tone === 'amber' ? 'text-amber-800 bg-amber-500/15 dark:text-amber-200 dark:bg-amber-400/10' : 'text-primary bg-primary/10'
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${colors}`}><Icon size={16} aria-hidden /></span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground sm:mt-4 sm:text-3xl">{value}</p>
      {to ? (
        <p className="mt-2 text-[11px] font-medium text-primary">
          {hint || 'Open queue'}
        </p>
      ) : null}
    </>
  )
  if (to) {
    return (
      <Link
        to={to}
        className="floor-metric-card floor-metric-card-link rounded-2xl border border-border bg-card p-4 shadow-sm no-underline transition hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-5"
        aria-label={`${label}: ${value}. ${hint || 'Open queue'}`}
      >
        {body}
      </Link>
    )
  }
  return (
    <article className="floor-metric-card rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      {body}
    </article>
  )
}

function TicketCard({ ticket, timingWarnings, onOpen }) {
  const warn = isSuspiciousTiming(ticket, timingWarnings)
  const linked = (ticket.linked_booking_ids?.length || 1) > 1
  const kind = serviceKindFromPayCategory(ticket.service_pay_category)
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xl font-black tabular-nums text-foreground sm:text-2xl">{formatQueueNumber(ticket.queue_number, ticket.service_pay_category)}</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">{ticket.customer_name}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${statusTone[ticket.status] || statusTone.completed}`}>{STATUS_LABELS[ticket.status] || ticket.status}</span>
      </div>
      <div className="mt-3 grid gap-0.5 text-xs text-muted-foreground">
        <span className="truncate font-medium text-foreground/80">{ticket.branch || '—'}</span>
        <span className="truncate capitalize">{kind === 'detailing' ? 'Detailing · multi-day' : kind}</span>
        <span className="truncate">{[ticket.vehicle_year, ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(' ') || 'Vehicle'}</span>
        <span className="truncate">{ticket.vehicle_plate || 'No plate'} · {ticket.service_name || 'Service'}</span>
        <span className="truncate">{ticket.assigned_staff_name || 'No staff assigned'}</span>
        {linked && <span className="font-medium text-primary">{ticket.linked_booking_ids.length} services · one visit</span>}
        {warn && <span className="flex items-center gap-1 font-medium text-amber-700 dark:text-amber-200"><ShieldAlert size={12} aria-hidden />Fast in-progress → check</span>}
      </div>
    </>
  )
  if (onOpen) {
    return (
      <button
        type="button"
        onClick={() => onOpen(ticket.booking_id)}
        className="floor-ticket queue-ticket-card w-full text-left"
      >
        {body}
      </button>
    )
  }
  return (
    <Link to={`/operations/queue/${ticket.booking_id}`} className="floor-ticket queue-ticket-card">
      {body}
    </Link>
  )
}

function useOperationsSnapshot(branchFilter = 'all') {
  const { profile } = useAuth()
  const [snapshot, setSnapshot] = useState({ queue: [], activeQueue: [], staffPool: [], availableStaff: [], busyStaff: [], events: [], handoffs: [], timingWarnings: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [live, setLive] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      setSnapshot(await fetchOperationsSnapshot(profile, { branchFilter }))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [profile, branchFilter])

  const loadRef = useRef(load)
  loadRef.current = load
  const scheduleReload = useMemo(
    () => createCoalescedReload(() => loadRef.current(), branchFilter === 'all' ? 600 : 350),
    [branchFilter],
  )

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const bookingFilter =
      branchFilter && branchFilter !== 'all' && typeof branchFilter === 'string'
        ? `branch=eq.${branchFilter}`
        : undefined
    const channel = supabase.channel(`operations-queue-${branchFilter}`)
    const opts = (table, filter) => ({
      event: '*',
      schema: 'public',
      table,
      ...(filter ? { filter } : {}),
    })
    channel
      .on('postgres_changes', opts('bookings', bookingFilter), scheduleReload)
      .on('postgres_changes', opts('queue_assignments'), scheduleReload)
      .on('postgres_changes', opts('pos_handoffs', bookingFilter), scheduleReload)
      .on('postgres_changes', opts('staff_attendance'), scheduleReload)
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED')
      })

    return () => {
      setLive(false)
      scheduleReload.cancel()
      supabase.removeChannel(channel)
    }
  }, [scheduleReload, branchFilter])

  return { ...snapshot, loading, error, live, reload: load }
}

export function OperationsDashboardPage() {
  const { profile, canViewQueueOperations } = useAuth()
  const seeAll = canSeeAllBranches(profile)
  const seeRedo = canViewRedoLane(profile)
  const canOpenPos = canAccessPos(profile)
  const scopeList = getBranchScopeList(profile)
  const [branchFilter, setBranchFilter] = useState(() => {
    if (seeAll) return 'all'
    if (Array.isArray(scopeList) && scopeList.length > 1) return 'all'
    if (Array.isArray(scopeList) && scopeList[0]) return scopeList[0]
    return getBranchScope(profile) || 'all'
  })
  const [datePreset, setDatePreset] = useState('today')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [branches, setBranches] = useState([])
  const [salesBoard, setSalesBoard] = useState({ summary: null, recentSales: [] })
  const [salesError, setSalesError] = useState('')
  const [salesLoading, setSalesLoading] = useState(true)
  const { activeQueue, availableStaff, busyStaff, events, handoffs, timingWarnings, loading, error, live, reload } = useOperationsSnapshot(branchFilter)
  const boardStatuses = useMemo(() => getOpsBoardStatuses(profile), [profile])
  const visibleQueue = useMemo(
    () => (activeQueue || []).filter((ticket) => boardStatuses.includes(ticket.status)),
    [activeQueue, boardStatuses],
  )
  const counts = useMemo(() => getQueueCounts(visibleQueue, { statuses: boardStatuses }), [visibleQueue, boardStatuses])
  const range = useMemo(() => getDashboardDateRange(datePreset, customStart, customEnd), [datePreset, customStart, customEnd])
  const rangeStartDate = useMemo(() => getLocalCalendarDate(range.start), [range.start])
  const rangeEndDate = useMemo(() => getLocalCalendarDate(range.end), [range.end])
  const filteredEvents = useMemo(
    () => (events || []).filter((e) => {
      const t = new Date(e.created_at).getTime()
      return t >= range.start.getTime() && t <= range.end.getTime()
    }),
    [events, range],
  )
  const filteredHandoffs = useMemo(
    () => (handoffs || []).filter((h) => {
      if (!h.handed_off_at) return true
      const t = new Date(h.handed_off_at).getTime()
      return t >= range.start.getTime() && t <= range.end.getTime()
    }),
    [handoffs, range],
  )
  const branchCompare = useMemo(() => queueByBranchCounts(visibleQueue), [visibleQueue])
  const timingFlags = useMemo(
    () => visibleQueue.filter((t) => isSuspiciousTiming(t, timingWarnings)),
    [visibleQueue, timingWarnings],
  )
  const salesSummary = salesBoard.summary || {
    total_sales_minor: 0,
    cash_sales_minor: 0,
    online_sales_minor: 0,
    paid_count: 0,
    average_ticket_minor: 0,
  }

  const loadSales = useCallback(async () => {
    setSalesError('')
    setSalesLoading(true)
    try {
      const data = await fetchBranchSalesBoard(profile, {
        branchFilter,
        startDate: rangeStartDate,
        endDate: rangeEndDate,
      })
      setSalesBoard(data)
    } catch (err) {
      setSalesError(err.message || 'Unable to load sales')
      setSalesBoard({ summary: null, recentSales: [] })
    } finally {
      setSalesLoading(false)
    }
  }, [profile, branchFilter, rangeStartDate, rangeEndDate])

  useEffect(() => {
    loadSales()
  }, [loadSales])

  useEffect(() => {
    if (!seeAll && !(Array.isArray(scopeList) && scopeList.length > 1)) return
    fetchBranches().then(setBranches).catch(() => setBranches([]))
  }, [seeAll, scopeList])

  const refreshAll = useCallback(() => {
    reload()
    loadSales()
  }, [reload, loadSales])

  if (!canViewQueueOperations) return <Navigate to="/operations/access-denied" replace />
  if (requiresTeamLeadBranchSetup(profile)) return <BranchSetupError />
  if (error) return <ErrorState error={error} onRetry={refreshAll} />

  const scopedBranchRows = Array.isArray(scopeList)
    ? branches.filter((b) => scopeList.includes(b.slug))
    : []
  const branchOptions = seeAll
    ? [{ slug: 'all', name: 'All branches' }, ...branches]
    : Array.isArray(scopeList) && scopeList.length > 1
      ? [
          { slug: 'all', name: 'All my branches' },
          ...(scopedBranchRows.length
            ? scopedBranchRows
            : scopeList.map((slug) => ({ slug, name: slug }))),
        ]
      : (Array.isArray(scopeList) ? scopeList : []).map((slug) => ({ slug, name: slug }))

  const branchLabel = !seeAll && branchOptions.length <= 1
    ? (getBranchScope(profile) || 'unassigned')
    : branchFilter === 'all'
      ? (seeAll ? 'All branches' : 'All my branches')
      : branchFilter

  return (
    <section>
      <PageHeader
        eyebrow={profile?.role === 'admin' ? 'Branch Admin' : 'Team Lead'}
        title={profile?.role === 'admin' ? 'Queue View' : 'Queue View'}
        description={
          profile?.role === 'admin'
            ? 'High-level floor summary — waiting cars, detailing, and tickets ready for POS.'
            : 'Branch summary of queue volume, detailing jobs, crew, and handoffs. Open Queue for the full detail board.'
        }
        live={live}
        action={<RefreshButton loading={loading || salesLoading} onClick={refreshAll} />}
      />
      <div className="mt-4 flex flex-col gap-3 sm:mt-5 sm:flex-row sm:flex-wrap sm:items-end">
        {(seeAll || branchOptions.length > 1) && (
          <label className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
            Branch
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="mt-2 block min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground sm:w-48">
              {branchOptions.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
            </select>
          </label>
        )}
        {!seeAll && branchOptions.length <= 1 && (
          <p className="rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground">Branch · {branchLabel}</p>
        )}
        <label className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
          Date range
          <select value={datePreset} onChange={(e) => setDatePreset(e.target.value)} className="mt-2 block min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground sm:w-40">
            {DASHBOARD_DATE_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </label>
        {datePreset === 'custom' && (
          <>
            <label className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">From<input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="mt-2 block min-h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground" /></label>
            <label className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">To<input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="mt-2 block min-h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground" /></label>
          </>
        )}
      </div>
      <div className={`mt-4 grid gap-3 grid-cols-2 sm:mt-6 sm:gap-4 ${seeRedo ? 'xl:grid-cols-6' : 'xl:grid-cols-5'}`}>
        <MetricCard
          label="Waiting"
          value={counts.waiting}
          icon={Clock3}
          to={operationsQueueHref({ lane: 'waiting', branch: branchFilter })}
          hint="Jump to waiting lane"
        />
        <MetricCard
          label="In Progress"
          value={counts.in_progress}
          icon={CarFront}
          tone="green"
          to={operationsQueueHref({ lane: 'in_progress', branch: branchFilter })}
          hint="Jump to in progress"
        />
        <MetricCard
          label="Final Checking"
          value={counts.final_checking}
          icon={BadgeCheck}
          tone="amber"
          to={operationsQueueHref({ lane: 'final_checking', branch: branchFilter })}
          hint="Jump to final check"
        />
        <MetricCard
          label="For Payment"
          value={filteredHandoffs.filter((h) => h.status === 'pending').length}
          icon={Send}
          tone="amber"
          to={canOpenPos ? '/operations/pos' : operationsQueueHref({ branch: branchFilter })}
          hint={canOpenPos ? 'Open POS checkout' : 'Open queue board'}
        />
        {seeRedo ? (
          <MetricCard
            label="Redo"
            value={counts.redo}
            icon={ShieldAlert}
            tone="amber"
            to={operationsQueueHref({ lane: 'redo', branch: branchFilter })}
            hint="Jump to redo lane"
          />
        ) : null}
        <MetricCard
          label="Total Active"
          value={counts.total}
          icon={ClipboardList}
          to={operationsQueueHref({ branch: branchFilter })}
          hint="Open full board"
        />
      </div>
      <div className="mt-3 grid gap-3 grid-cols-2 sm:mt-4 sm:gap-4 xl:grid-cols-4">
        <MetricCard
          label="Sales total"
          value={salesLoading && !salesBoard.summary ? '…' : formatMoney(salesSummary.total_sales_minor)}
          icon={Wallet}
          tone="green"
        />
        <MetricCard label="Paid sales" value={salesSummary.paid_count} icon={CheckCircle2} />
        <MetricCard
          label="Cash"
          value={formatMoney(salesSummary.cash_sales_minor)}
          icon={Wallet}
        />
        <MetricCard
          label="Online / card"
          value={formatMoney(salesSummary.online_sales_minor)}
          icon={Wallet}
          tone="amber"
        />
      </div>
      {salesError ? (
        <p className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-950 dark:text-red-100" role="alert">
          {salesError}
        </p>
      ) : null}
      {timingFlags.length > 0 && (
        <p className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          <ShieldAlert size={16} aria-hidden />
          {timingFlags.length} ticket(s) reached final check faster than {timingWarnings?.min_seconds_in_progress ?? 120}s — review for QC shortcuts.
        </p>
      )}
      {seeAll && (
        <Panel title="Branch comparison" icon={ClipboardList} className="mt-4 sm:mt-5">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Object.keys(branchCompare).length ? Object.entries(branchCompare).map(([slug, c]) => (
              <div key={slug} className="rounded-2xl border border-border bg-card p-4">
                <p className="font-semibold capitalize text-foreground">{slug}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  W {c.waiting} · IP {c.in_progress} · FC {c.final_checking}
                  {seeRedo ? ` · Redo ${c.redo}` : ''} · Total {c.total}
                </p>
              </div>
            )) : <EmptyLine text="No active tickets across branches." />}
          </div>
        </Panel>
      )}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_.9fr] sm:mt-5 sm:gap-5">
        <Panel title="Crew Availability" icon={Users}>
          <div className="grid gap-4 sm:grid-cols-2">
            <CrewList title="Available" rows={availableStaff} empty="No available staff" />
            <CrewList title="Busy" rows={busyStaff} empty="No busy staff" busy />
          </div>
        </Panel>
        <Panel title="Recently Sent To Payment" icon={Send}>
          <div className="grid gap-3">
            {filteredHandoffs.length ? filteredHandoffs.slice(0, 8).map((handoff) => {
              const body = (
                <>
                  <p className="font-semibold text-foreground">{handoff.branch} · {formatMoney(handoff.amount_minor)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {handoff.status}
                    {' · '}
                    {handoff.handed_off_at ? new Date(handoff.handed_off_at).toLocaleString() : 'Pending'}
                    {canOpenPos ? ' · Open POS' : ' · Waiting for Admin / ASA at POS'}
                  </p>
                </>
              )
              return canOpenPos ? (
                <Link key={handoff.id} to="/operations/pos" className="rounded-2xl border border-border bg-card p-4 no-underline transition hover:border-blue-300/40">
                  {body}
                </Link>
              ) : (
                <div key={handoff.id} className="rounded-2xl border border-border bg-card p-4">
                  {body}
              </div>
              )
            }) : <EmptyLine text="No payment handoffs in this range." />}
          </div>
        </Panel>
      </div>
      <Panel title={`Paid sales · ${branchLabel}`} icon={Wallet} className="mt-4 sm:mt-5">
        <p className="mb-3 text-sm text-muted-foreground">
          {formatMoney(salesSummary.total_sales_minor)} across {salesSummary.paid_count} paid sale
          {salesSummary.paid_count === 1 ? '' : 's'}
          {salesSummary.paid_count > 0 ? ` · avg ${formatMoney(salesSummary.average_ticket_minor)}` : ''}
          {' · '}
          {rangeStartDate === rangeEndDate ? rangeStartDate : `${rangeStartDate} → ${rangeEndDate}`}
        </p>
        <div className="grid max-h-72 gap-3 overflow-y-auto sm:max-h-96">
          {salesLoading && !salesBoard.recentSales?.length ? (
            Array.from({ length: 3 }, (_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)
          ) : salesBoard.recentSales?.length ? (
            salesBoard.recentSales.map((sale) => {
              const booking = sale.bookings || {}
              const customer = sale.customers || {}
              const name = booking.customer_name || customer.full_name || 'Customer'
              const plate = booking.vehicle_plate || '—'
              const service = booking.services?.name || sale.notes || 'Sale'
              const qNum = booking.queue_number != null ? `Q-${String(booking.queue_number).padStart(3, '0')}` : null
              return (
                <div key={sale.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {name}
                        {qNum ? ` · ${qNum}` : ''}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {sale.branch} · {plate} · {service}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {(sale.payment_method || 'paid').replace(/_/g, ' ')}
                        {' · '}
                        {sale.occurred_at ? new Date(sale.occurred_at).toLocaleString() : '—'}
                      </p>
            </div>
                    <p className="shrink-0 text-base font-semibold tabular-nums text-foreground sm:text-lg">
                      {formatMoney(sale.total_minor)}
                    </p>
                  </div>
                </div>
              )
            })
          ) : (
            <EmptyLine text="No paid sales in this range for your branch." />
          )}
        </div>
      </Panel>
      <Panel title="Queue Activity Logs" icon={ClipboardList} className="mt-4 sm:mt-5">
        <div className="grid max-h-64 gap-3 overflow-y-auto sm:max-h-80">
          {filteredEvents.length ? filteredEvents.slice(0, 20).map((event) => (
            <div key={event.id} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm text-foreground">{event.old_status || 'created'} to {event.new_status}</p>
              <p className="mt-1 text-xs text-muted-foreground">{event.branch} · {event.notes || 'Status update'} · {new Date(event.created_at).toLocaleString()}</p>
            </div>
          )) : <EmptyLine text="No queue activity in this range." />}
        </div>
      </Panel>
    </section>
  )
}

export function OperationsQueuePage() {
  const { profile } = useAuth()
  // Team Lead gets the dedicated mobile-first Queue Manager (legacy port).
  if (profile?.role === 'team_lead') return <TeamLeadQueuePage />
  return <OperationsQueueBoardPage />
}

function OperationsQueueBoardPage() {
  const { profile, canManageQueue, canViewQueueOperations } = useAuth()
  const seeAll = canSeeAllBranches(profile)
  const seeRedo = canViewRedoLane(profile)
  const scopeList = getBranchScopeList(profile)
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedLane = parseQueueLaneParam(searchParams.get('lane'))
  const branchFromUrl = String(searchParams.get('branch') || '').trim()
  const [branchFilter, setBranchFilter] = useState(() => {
    if (branchFromUrl) return branchFromUrl
    if (seeAll) return 'all'
    if (Array.isArray(scopeList) && scopeList.length > 1) return 'all'
    if (Array.isArray(scopeList) && scopeList[0]) return scopeList[0]
    return getBranchScope(profile) || 'all'
  })
  const [branches, setBranches] = useState([])
  const [editBookingId, setEditBookingId] = useState(null)
  const { activeQueue, timingWarnings, loading, error, live, reload } = useOperationsSnapshot(branchFilter)
  const boardStatuses = useMemo(() => getOpsBoardStatuses(profile), [profile])
  const visibleQueue = useMemo(
    () => (activeQueue || []).filter((ticket) => boardStatuses.includes(ticket.status)),
    [activeQueue, boardStatuses],
  )
  const boardTickets = useMemo(() => groupVisitTickets(visibleQueue), [visibleQueue])
  const grouped = useMemo(
    () => Object.fromEntries(boardStatuses.map((status) => [status, boardTickets.filter((ticket) => ticket.status === status)])),
    [boardTickets, boardStatuses],
  )
  const counts = useMemo(() => getQueueCounts(visibleQueue, { statuses: boardStatuses }), [visibleQueue, boardStatuses])
  const focusLane = requestedLane && boardStatuses.includes(requestedLane) ? requestedLane : null

  useEffect(() => {
    if (!branchFromUrl || branchFromUrl === branchFilter) return
    setBranchFilter(branchFromUrl)
  }, [branchFromUrl, branchFilter])

  useEffect(() => {
    if (!focusLane) return undefined
    const id = window.requestAnimationFrame(() => {
      const el = document.querySelector(`[data-status="${focusLane}"]`)
      el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    })
    return () => window.cancelAnimationFrame(id)
  }, [focusLane, loading, boardTickets.length])

  const setLaneFilter = useCallback((lane) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (!lane) next.delete('lane')
      else next.set('lane', lane)
      if (branchFilter && branchFilter !== 'all') next.set('branch', branchFilter)
      else next.delete('branch')
      return next
    }, { replace: true })
  }, [branchFilter, setSearchParams])

  const onBranchChange = useCallback((slug) => {
    setBranchFilter(slug)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (slug && slug !== 'all') next.set('branch', slug)
      else next.delete('branch')
      return next
    }, { replace: true })
  }, [setSearchParams])

  useEffect(() => {
    if (!seeAll && !(Array.isArray(scopeList) && scopeList.length > 1)) return
    fetchBranches().then(setBranches).catch(() => setBranches([]))
  }, [seeAll, scopeList])

  if (!canViewQueueOperations) return <Navigate to="/operations/access-denied" replace />
  if (requiresTeamLeadBranchSetup(profile)) return <BranchSetupError />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const scopedBranchRows = Array.isArray(scopeList)
    ? branches.filter((b) => scopeList.includes(b.slug))
    : []
  const branchOptions = seeAll
    ? [{ slug: 'all', name: 'All branches' }, ...branches]
    : Array.isArray(scopeList) && scopeList.length > 1
      ? [
          { slug: 'all', name: 'All my branches' },
          ...(scopedBranchRows.length
            ? scopedBranchRows
            : scopeList.map((slug) => ({ slug, name: slug }))),
        ]
      : (Array.isArray(scopeList) ? scopeList : []).map((slug) => ({ slug, name: slug }))

  return (
    <section className="queue-board flex min-h-0 flex-col">
      <PageHeader
        eyebrow={profile?.role === 'admin' ? 'Branch Admin' : 'Queue Board'}
        title={profile?.role === 'admin' ? 'Queue' : 'Today on the floor'}
        description={
          profile?.role === 'admin'
            ? 'View tickets and open POS when payment is ready.'
            : seeRedo
              ? 'Active tickets until payment. Redo is the owner QC lane - customers never see it.'
              : 'Active tickets until payment - waiting, in progress, and final checking.'
        }
        live={live}
        action={(
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <RefreshButton loading={loading} onClick={reload} />
            {branchFilter && branchFilter !== 'all' ? (
              <>
                <Link
                  to={`/queue/${branchFilter}`}
                  target="_blank"
                  rel="noreferrer"
                  className="floor-touch-btn inline-flex items-center rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 no-underline"
                >
                  Customer kiosk
                </Link>
                <Link
                  to={`/queue/${branchFilter}/tv`}
                  target="_blank"
                  rel="noreferrer"
                  className="floor-touch-btn inline-flex items-center rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 no-underline"
                >
                  Shop TV
                </Link>
              </>
            ) : null}
            {canManageQueue && (
              <Link to="/operations/queue/new" className="floor-touch-btn inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground no-underline transition hover:opacity-90 sm:px-5">
                <Plus size={18} aria-hidden />
                New ticket
              </Link>
            )}
          </div>
        )}
      />

      <div className="queue-board-toolbar mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          {(seeAll || branchOptions.length > 1) ? (
            <label className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
              Branch
              <select
                value={branchFilter}
                onChange={(e) => onBranchChange(e.target.value)}
                className="mt-2 block min-h-11 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground sm:w-52"
              >
                {branchOptions.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
              </select>
            </label>
          ) : (
            <p className="rounded-xl border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground">
              Branch · {getBranchScope(profile) || 'unassigned'}
            </p>
          )}
            </div>
        <div
          className="floor-status-chips flex w-full gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:w-auto sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden"
          role="toolbar"
          aria-label="Filter queue by status"
        >
          <button
            type="button"
            className={`floor-status-chip floor-touch-btn shrink-0 rounded-2xl border px-3 py-2.5 text-left text-sm font-semibold transition ${
              !focusLane
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border bg-card text-foreground hover:border-primary/40'
            }`}
            aria-pressed={!focusLane}
            onClick={() => setLaneFilter(null)}
          >
            <span className="block text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">All</span>
            <span className="tabular-nums text-primary">{counts.total}</span>
          </button>
          {boardStatuses.map((status) => {
            const active = focusLane === status
            const n = (grouped[status] || []).length
            return (
              <button
                key={status}
                type="button"
                className={`floor-status-chip floor-touch-btn shrink-0 rounded-2xl border px-3 py-2.5 text-left text-sm font-semibold transition ${
                  active
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-card text-foreground hover:border-primary/40'
                }`}
                aria-pressed={active}
                onClick={() => setLaneFilter(active ? null : status)}
              >
                <span className="block text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                  {STATUS_LABELS[status]}
                </span>
                <span className="tabular-nums text-primary">{n}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div
        className="floor-lane-board queue-lane-board queue-lane-board-fluid mt-3 sm:mt-4"
        style={{ '--queue-lane-count': boardStatuses.length }}
        role="region"
        aria-label="Active queue lanes"
      >
        {boardStatuses.map((status) => {
          const meta = LANE_META[status] || LANE_META.waiting
          const Icon = meta.icon
          const tickets = grouped[status] || []
          const laneFocused = focusLane === status
          const laneDimmed = Boolean(focusLane) && !laneFocused
          return (
            <section
              key={status}
              id={`queue-lane-${status}`}
              className={`floor-lane queue-lane ${laneFocused ? 'queue-lane-focused' : ''} ${laneDimmed ? 'queue-lane-dimmed' : ''}`}
              data-status={status}
              aria-label={STATUS_LABELS[status]}
              aria-current={laneFocused ? 'true' : undefined}
            >
              <div className="queue-lane-head mb-3 flex items-start justify-between gap-2">
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => setLaneFilter(laneFocused ? null : status)}
                  aria-pressed={laneFocused}
                >
                  <div className="flex items-center gap-2">
                    <span className="queue-lane-icon" aria-hidden>
                      <Icon size={14} />
                    </span>
                    <h2 className="queue-lane-title text-xs font-bold tracking-[0.14em] uppercase">{STATUS_LABELS[status]}</h2>
                  </div>
                  <p className="queue-lane-hint mt-1 text-[11px]">{meta.hint}</p>
                </button>
                <button
                  type="button"
                  className="queue-lane-count floor-touch-btn shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums"
                  onClick={() => setLaneFilter(laneFocused ? null : status)}
                  aria-label={`${STATUS_LABELS[status]}: ${tickets.length} tickets`}
                  aria-pressed={laneFocused}
                >
                  {tickets.length}
                </button>
              </div>
              <div className="floor-lane-body">
                {loading
                  ? Array.from({ length: 3 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-muted" />)
                  : tickets.length
                    ? tickets.map((ticket) => (
                      <TicketCard
                        key={ticket.booking_id}
                        ticket={ticket}
                        timingWarnings={timingWarnings}
                        onOpen={canManageQueue ? setEditBookingId : undefined}
                      />
                    ))
                    : <EmptyLine text="No tickets in this lane." />}
            </div>
          </section>
          )
        })}
      </div>

      {canManageQueue ? (
        <QueueTicketEditModal
          bookingId={editBookingId}
          open={Boolean(editBookingId)}
          onOpenChange={(next) => {
            if (!next) setEditBookingId(null)
          }}
          onUpdated={reload}
        />
      ) : null}
    </section>
  )
}

export function QueueTicketPage() {
  const { id } = useParams()
  const { profile, canViewQueueOperations } = useAuth()
  const navigate = useNavigate()

  if (!canViewQueueOperations) return <Navigate to="/operations/access-denied" replace />
  if (requiresTeamLeadBranchSetup(profile)) return <BranchSetupError />
  if (!id) return <Navigate to="/operations/queue" replace />

  return (
    <section>
      <QueueTicketEditor
        bookingId={id}
        variant="page"
        onClose={() => navigate('/operations/queue')}
      />
    </section>
  )
}

export function NewQueueTicketPage() {
  const navigate = useNavigate()
  const { user, profile, canManageQueue } = useAuth()
  const assignedBranch = getBranchScope(profile)
  const scopeList = getBranchScopeList(profile)
  const canChooseBranch = canOverrideQueueBranches(profile) || (Array.isArray(scopeList) && scopeList.length > 1)
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
    vehicle_type: 'medium',
    service_ids: [],
    branch: assignedBranch || '',
    final_price: '',
    notes: '',
    services: [],
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [vehicleTypeOptions, setVehicleTypeOptions] = useState(FALLBACK_VEHICLE_TYPES)

  function sumSelectedPrices(serviceRows, ids, sizeSlug) {
    return ids.reduce((sum, id) => {
      const svc = serviceRows.find((s) => s.id === id)
      return sum + resolveServicePriceMinor(svc, sizeSlug)
    }, 0)
  }

  useEffect(() => {
    Promise.all([
      fetchServices(),
      canChooseBranch ? fetchBranches() : Promise.resolve([]),
      listVehicleSizes({ activeOnly: true }).catch(() => []),
    ])
      .then(([serviceRows, branchRows, sizes]) => {
        setServices(serviceRows)
        setBranches(
          Array.isArray(scopeList) && scopeList.length > 1 && !canOverrideQueueBranches(profile)
            ? branchRows.filter((b) => scopeList.includes(b.slug))
            : branchRows,
        )
        if (sizes?.length) {
          setVehicleTypeOptions(sizes.map((s) => ({ label: s.label, value: s.slug })))
        }
        const defaultSize = sizes?.some((s) => s.slug === 'medium')
          ? 'medium'
          : sizes?.[0]?.slug || 'medium'
        setForm((current) => ({
          ...current,
          branch: assignedBranch || current.branch || branchRows[0]?.slug || '',
          services: serviceRows,
          service_ids: current.service_ids || [],
          vehicle_type: defaultSize,
        }))
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [assignedBranch, canChooseBranch, profile, scopeList])

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
          const names = splitCustomerName(match.customer_name)
          setForm((current) => ({
            ...current,
            customer_id: match.customer_id || '',
            vehicle_id: match.vehicle_id || '',
            customer_name: match.customer_name || current.customer_name,
            customer_first_name: names.first || current.customer_first_name,
            customer_last_name: names.last || current.customer_last_name,
            customer_phone: match.customer_phone || current.customer_phone,
            vehicle_plate: match.plate_number || current.vehicle_plate,
            vehicle_make: match.vehicle_make || current.vehicle_make,
            vehicle_model: match.vehicle_model || current.vehicle_model,
            vehicle_year: match.vehicle_year || current.vehicle_year,
            vehicle_color: match.vehicle_color || current.vehicle_color,
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
  const setMake = (vehicle_make) => setForm((current) => ({ ...current, vehicle_make }))
  const setModel = (vehicle_model) => setForm((current) => ({ ...current, vehicle_model }))
  const updateVehicleType = (event) => {
    const vehicle_type = normalizeVehicleType(event.target.value)
    setForm((current) => {
      const ids = current.service_ids || []
      const total = sumSelectedPrices(services, ids, vehicle_type)
      return {
      ...current,
        vehicle_type,
        final_price: ids.length ? String(total / 100) : current.final_price,
      }
    })
  }
  const updateServiceIds = (ids) => {
    setForm((current) => {
      const nextIds = Array.isArray(ids) ? ids : []
      const total = sumSelectedPrices(services, nextIds, current.vehicle_type)
      return {
        ...current,
        service_ids: nextIds,
        final_price: nextIds.length ? String(total / 100) : current.final_price,
      }
    })
  }

  const parsedFormPrice = Number(String(form.final_price).replace(/,/g, '').trim())
  const showFormLowPriceWarning = Number.isFinite(parsedFormPrice) && parsedFormPrice > 0 && parsedFormPrice < 50

  const submit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const phoneDigits = String(form.customer_phone || '').replace(/\D/g, '')
      if (phoneDigits.length < 10) throw new Error('Phone number is required (at least 10 digits).')
      if (!String(form.vehicle_plate || '').trim()) throw new Error('Plate number is required.')
      if (!form.service_ids?.length) throw new Error('Select at least one service, package, or detailing service.')
      if (showFormLowPriceWarning && !window.confirm('Please confirm this amount is correct. Did you mean a higher peso amount?')) {
        setSubmitting(false)
        return
      }
      const ticket = await createQueueTicket({
        ...form,
        customer_name: `${form.customer_first_name || ''} ${form.customer_last_name || ''}`.trim(),
        branch: canChooseBranch ? form.branch : assignedBranch,
        vehicle_type: normalizeVehicleType(form.vehicle_type),
        service_ids: form.service_ids,
        service_id: form.service_ids[0],
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
      <PageHeader eyebrow="Create Queue Ticket" title="Add vehicle to queue" description="Required: plate, phone, and at least one Service / Package / Detailing. Name is optional for fast walk-ins." />
      {error && <p className="floor-alert floor-alert-error mt-5">{error}</p>}
      <div className="mt-8">
        <Panel title="Ticket Form" icon={Plus}>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2 text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">Plate number *<input value={form.vehicle_plate} onChange={update('vehicle_plate')} required autoFocus placeholder="ABC 1234" className="floor-control" /></label>
            {form.vehicle_plate.trim().length >= 2 && plateLookupState !== 'idle' && (
              <p className={`sm:col-span-2 floor-alert ${plateLookupState === 'found' ? 'floor-alert-ok' : 'floor-alert-warn'}`}>
                {plateLookupState === 'loading' ? 'Checking plate number...' : getPlateLookupStatus(form.vehicle_plate, Boolean(plateMatch))}
              </p>
            )}
            <FormField label="Phone number *" value={form.customer_phone} onChange={update('customer_phone')} required />
            <FormField label="Email (optional)" value={form.customer_email} onChange={update('customer_email')} type="email" />
            <FormField label="First name (optional)" value={form.customer_first_name} onChange={update('customer_first_name')} />
            <FormField label="Last name (optional)" value={form.customer_last_name} onChange={update('customer_last_name')} />
            <p className="sm:col-span-2 text-xs text-slate-400">No name yet? Ticket shows as Walk-in · plate. CRM can fill the name later.</p>
            <VehicleMakeModelFields
              make={form.vehicle_make}
              model={form.vehicle_model}
              onMakeChange={setMake}
              onModelChange={setModel}
              variant="floor"
            />
            <FormField label="Year" value={form.vehicle_year} onChange={update('vehicle_year')} type="number" min="1886" max="2200" />
            <FormField label="Color" value={form.vehicle_color} onChange={update('vehicle_color')} />
            <label className="text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">Car size (pricing)<select value={form.vehicle_type} onChange={updateVehicleType} className="floor-control">{vehicleTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <ServiceKindPicker
              services={services}
              selectedIds={form.service_ids}
              vehicleType={form.vehicle_type}
              onChange={updateServiceIds}
              disabled={submitting}
            />
            {canChooseBranch && <label className="text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">Branch<select value={form.branch} onChange={update('branch')} required className="floor-control">{branches.map((branch) => <option key={branch.slug} value={branch.slug}>{branch.name}</option>)}</select></label>}
            <FormField label="Final Price in Pesos" value={form.final_price} onChange={update('final_price')} type="number" min="0" step="0.01" required />
            {showFormLowPriceWarning && <p className="floor-alert floor-alert-warn">Please confirm this amount is correct. Did you mean a higher peso amount?</p>}
            <label className="sm:col-span-2 text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">Notes<textarea value={form.notes} onChange={update('notes')} className="floor-control floor-control-area" /></label>
            <button disabled={submitting} className="floor-touch-btn sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#052699] px-5 py-3.5 text-base font-semibold text-white shadow-[0_8px_20px_rgba(5,38,153,0.28)] transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[#1d4ed8] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60">{submitting ? <LoaderCircle className="animate-spin" size={18} aria-hidden /> : <Plus size={18} aria-hidden />}Create Queue Ticket</button>
          </form>
        </Panel>
      </div>
    </section>
  )
}

export function CrewPage() {
  const { profile, canManageCrew, canViewQueueOperations } = useAuth()
  const canSettings = canEditAttendanceSettings(profile) || canEditAttendanceRoles(profile)
  const { staffPool, availableStaff, busyStaff, loading, error, reload } = useOperationsSnapshot()
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    email: '',
    password: '',
    phone: '',
    branch_slug: getBranchScope(profile) || '',
    present_today: true,
  })
  const [branches, setBranches] = useState([])
  const [saving, setSaving] = useState('')
  const [actionError, setActionError] = useState('')
  const [mainTab, setMainTab] = useState('attendance')
  const [crewTab, setCrewTab] = useState('pool')
  const presentCount = staffPool.filter((member) => member.is_present_today).length
  const presentRows = useMemo(() => staffPool.filter((m) => m.is_present_today), [staffPool])
  const canPickBranch = canSeeAllBranches(profile)

  useEffect(() => {
    if (!canPickBranch) return
    fetchBranches()
      .then((rows) => {
        setBranches(rows)
        setForm((current) => ({ ...current, branch_slug: current.branch_slug || getBranchScope(profile) || rows[0]?.slug || '' }))
      })
      .catch((err) => setActionError(err.message))
  }, [canPickBranch, profile])

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
      setForm((current) => ({ ...current, full_name: '', username: '', email: '', password: '', phone: '' }))
    })
  }

  if (!canViewQueueOperations) return <Navigate to="/operations/access-denied" replace />
  if (requiresTeamLeadBranchSetup(profile)) return <BranchSetupError />
  if (error) return <ErrorState error={error} onRetry={reload} />
  return (
    <section>
      <PageHeader
        eyebrow="Crew"
        title="Crew & attendance"
        description="Geofenced clock-in for every floor role, attendance heatmap, and crew pool."
        action={<RefreshButton loading={loading} onClick={reload} />}
      />
      {actionError && <p className="mt-5 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">{actionError}</p>}

      <div className="mt-6 flex flex-wrap gap-2">
        {[
          { key: 'attendance', label: 'Attendance' },
          { key: 'crew', label: 'Crew' },
          ...(canSettings ? [{ key: 'settings', label: 'Settings' }] : []),
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setMainTab(tab.key)}
            className={`min-h-10 rounded-2xl px-4 text-sm font-semibold transition ${mainTab === tab.key ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-muted'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mainTab === 'attendance' && <CrewAttendancePanel profile={profile} canManage={canManageCrew} />}
      {mainTab === 'settings' && canSettings && <CrewSettingsPanel profile={profile} />}

      {mainTab === 'crew' && (
        <>
          <div className="mt-6 mb-4 grid grid-cols-3 gap-3 text-center text-xs text-muted-foreground">
            <span className="rounded-xl border border-border bg-card px-3 py-2"><strong className="block text-lg text-foreground">{staffPool.length}</strong>Pool</span>
            <span className="rounded-xl border border-border bg-card px-3 py-2"><strong className="block text-lg text-foreground">{presentCount}</strong>Present</span>
            <span className="rounded-xl border border-border bg-card px-3 py-2"><strong className="block text-lg text-foreground">{availableStaff.length}</strong>Deployable</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'pool', label: `Pool (${staffPool.length})` },
              { key: 'present', label: `Present (${presentCount})` },
              { key: 'busy', label: `Busy (${busyStaff.length})` },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCrewTab(tab.key)}
                className={`min-h-10 rounded-2xl px-4 text-sm font-semibold transition ${crewTab === tab.key ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-muted'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {crewTab === 'pool' && (
            <Panel title="Staff Pool" icon={UserPlus} className="mt-5">
              {canManageCrew && (
                <form onSubmit={submitStaff} className="mb-5 grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Staff name
                    <input value={form.full_name} onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))} required placeholder="Full name" className="min-h-11 rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Username *
                    <input value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} required minLength={3} placeholder="login handle" className="min-h-11 rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Email *
                    <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required placeholder="staff@hakumautocare.com" className="min-h-11 rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Password *
                    <input type="text" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required minLength={8} placeholder="Temp password (min 8)" className="min-h-11 rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Phone
                    <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="09…" className="min-h-11 rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                  {canPickBranch && (
                    <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Branch
                      <select value={form.branch_slug} onChange={(event) => setForm((current) => ({ ...current, branch_slug: event.target.value }))} required className="min-h-11 rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none">
                        {branches.map((branch) => <option key={branch.slug} value={branch.slug}>{branch.name}</option>)}
                      </select>
                    </label>
                  )}
                  <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
                <input type="checkbox" checked={form.present_today} onChange={(event) => setForm((current) => ({ ...current, present_today: event.target.checked }))} />
                Mark as attended today
              </label>
                  <button disabled={saving === 'add-staff'} className="md:col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60">{saving === 'add-staff' ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />}Add crew member</button>
            </form>
          )}
              <StaffPoolList
                rows={staffPool}
                canManage={canManageCrew}
                canPickBranch={canPickBranch}
                branches={branches}
                saving={saving}
                onAttendance={(member, status) => runCrewAction(`${member.id}-${status}`, () => setStaffAttendance(member, status, profile))}
                onEdit={(member, patch) => runCrewAction(`${member.id}-edit`, () => updateCrewStaffMember(member.id, patch))}
                onDeactivate={(member) => {
                  if (!window.confirm(`Remove ${member.full_name} from the active crew pool?`)) return
                  return runCrewAction(`${member.id}-off`, () => deactivateCrewStaffMember(member.id))
                }}
              />
        </Panel>
          )}
          {crewTab === 'present' && (
            <div className="mt-5 grid gap-6 xl:grid-cols-2">
              <Panel title="Present today" icon={CheckCircle2}>
                <StaffPoolList
                  rows={presentRows}
                  canManage={canManageCrew}
                  canPickBranch={canPickBranch}
                  branches={branches}
                  saving={saving}
                  onAttendance={(member, status) => runCrewAction(`${member.id}-${status}`, () => setStaffAttendance(member, status, profile))}
                  onEdit={(member, patch) => runCrewAction(`${member.id}-edit`, () => updateCrewStaffMember(member.id, patch))}
                  onDeactivate={(member) => {
                    if (!window.confirm(`Remove ${member.full_name} from the active crew pool?`)) return
                    return runCrewAction(`${member.id}-off`, () => deactivateCrewStaffMember(member.id))
                  }}
                />
              </Panel>
              <Panel title="Deployable (not on a ticket)" icon={Users}><CrewList rows={availableStaff} empty="No attended staff available" /></Panel>
      </div>
          )}
          {crewTab === 'busy' && (
            <Panel title="Busy Staff" icon={Users} className="mt-5"><CrewList rows={busyStaff} empty="No busy staff" busy /></Panel>
          )}
        </>
      )}
    </section>
  )
}

export { default as KpiPage } from './KpiPage.jsx'

export function MyTasksPage() {
  const { user, profile, canViewAssignedTasks } = useAuth()
  const [queueRows, setQueueRows] = useState([])
  const [planRows, setPlanRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState('')

  const load = useCallback(async () => {
    if (!user?.id) return
    setError('')
    setLoading(true)
    const [queueRes, planRes] = await Promise.all([
      supabase
      .from('queue_assignments')
        .select('id, booking_id, task_name, task_notes, status, started_at, completed_at, released_at, created_at, bookings(vehicle_plate, branch, status, queue_number)')
      .eq('staff_id', user.id)
        .in('status', ['active', 'pending'])
        .order('created_at', { ascending: false }),
      supabase
        .from('plan_card_assignees')
        .select('id, status, notes, created_at, updated_at, card_id, plan_cards(id, title, description, due_at, labels)')
        .eq('staff_id', user.id)
        .in('status', ['todo', 'in_progress'])
        .order('created_at', { ascending: false }),
    ])
    if (queueRes.error) setError(queueRes.error.message)
    else setQueueRows(queueRes.data || [])
    if (planRes.error) setError((prev) => prev || planRes.error.message)
    else setPlanRows(planRes.data || [])
    setLoading(false)
  }, [user?.id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!user?.id) return undefined
    const channel = supabase
      .channel(`my-tasks-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_assignments', filter: `staff_id=eq.${user.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_card_assignees', filter: `staff_id=eq.${user.id}` }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [load, user?.id])

  if (!canViewAssignedTasks) return <Navigate to="/operations/access-denied" replace />

  const markInProgress = async (assignment) => {
    setSaving(assignment.id)
    try {
      await acknowledgeQueueAssignment(assignment.id)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving('')
    }
  }

  const markQueueDone = async (assignment) => {
    setSaving(assignment.id)
    try {
      await completeQueueAssignment(assignment.id)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving('')
    }
  }

  const updatePlanTask = async (row, nextStatus) => {
    const patch = allowedStaffPlanAssigneePatch(row, { status: nextStatus })
    if (!patch) {
      setError('Illegal planning status change.')
      return
    }
    setSaving(row.id)
    const { error: uError } = await supabase
      .from('plan_card_assignees')
      .update(patch)
      .eq('id', row.id)
      .eq('staff_id', user.id)
    setSaving('')
    if (uError) setError(uError.message)
    else load()
  }

  const runClock = async (kind) => {
    setSaving(`clock-${kind}`)
    try {
      const coords = await readBrowserPosition()
      if (kind === 'in') {
        await geoTimeIn({ profile, coords })
        toast.success('Timed in')
      } else {
        await geoTimeOut({ profile, coords })
        toast.success('Timed out')
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving('')
    }
  }

  if (error) return <ErrorState error={error} onRetry={load} />
  const empty = !loading && !queueRows.length && !planRows.length
  const isStaff = profile?.role === ROLES.STAFF
  return (
    <section className="px-1 sm:px-0">
      <PageHeader eyebrow="My Tasks" title="Assigned work" description="Queue floor jobs and planning cards assigned to you." action={<RefreshButton loading={loading} onClick={load} />} />

      {isStaff && (
        <Panel title="Attendance" icon={Clock3} className="mt-6">
          <p className="mb-4 text-sm text-slate-400">Time in inside the branch geofence. Late is flagged vs shift start.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={Boolean(saving)}
              onClick={() => runClock('in')}
              className="min-h-11 rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
            >
              {saving === 'clock-in' ? 'Locating…' : 'Time in'}
            </button>
            <button
              type="button"
              disabled={Boolean(saving)}
              onClick={() => runClock('out')}
              className="min-h-11 rounded-2xl border border-white/10 px-4 text-sm font-semibold text-slate-200 disabled:opacity-40"
            >
              {saving === 'clock-out' ? 'Saving…' : 'Time out'}
            </button>
          </div>
        </Panel>
      )}

      <Panel title="Planning assignments" icon={ClipboardList} className="mt-6">
        <div className="grid gap-4">
          {planRows.length ? planRows.map((row) => {
            const card = row.plan_cards
            return (
              <article key={row.id} className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold">{card?.title || 'Planning card'}</p>
                    <p className="mt-1 text-xs capitalize text-slate-400">{row.status.replace('_', ' ')}{card?.due_at ? ` · due ${new Date(card.due_at).toLocaleString()}` : ''}</p>
                    {card?.description && <p className="mt-2 text-sm text-slate-400 line-clamp-2">{card.description}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.status === 'todo' && (
                      <button type="button" disabled={saving === row.id} onClick={() => updatePlanTask(row, 'in_progress')} className="min-h-11 rounded-2xl bg-blue-500 px-4 text-sm font-semibold text-white disabled:opacity-40">Start</button>
                    )}
                    {row.status === 'in_progress' && (
                      <button type="button" disabled={saving === row.id} onClick={() => updatePlanTask(row, 'done')} className="min-h-11 rounded-2xl border border-emerald-300/30 px-4 text-sm font-semibold text-emerald-100 disabled:opacity-40">Mark done</button>
                    )}
                  </div>
                </div>
              </article>
            )
          }) : <EmptyLine text={loading ? 'Loading…' : 'No open planning assignments.'} />}
        </div>
      </Panel>

      <Panel title="Queue assignments" icon={CarFront} className="mt-5">
        <div className="grid gap-4">
          {queueRows.length ? queueRows.map((row) => {
            const booking = row.bookings
            return (
              <article key={row.id} className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold">{row.task_name || 'Queue service task'}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {booking?.vehicle_plate ? `${booking.vehicle_plate} · ` : ''}
                      {booking?.branch || '—'}
                      {booking?.queue_number ? ` · #${formatQueueNumber(booking.queue_number)}` : ''}
                    </p>
                    <p className="mt-1 text-xs capitalize text-slate-400">{row.status}{booking?.status ? ` · ticket ${booking.status}` : ''}</p>
              </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {row.booking_id && !isStaff && (
                      <Link to={`/operations/queue/${row.booking_id}`} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 no-underline">
                        Open ticket
                      </Link>
                    )}
                    {row.status === 'pending' && (
                      <button
                        type="button"
                        disabled={saving === row.id}
                        onClick={() => markInProgress(row)}
                        className="min-h-11 rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {saving === row.id ? 'Saving…' : 'Acknowledge'}
                      </button>
                    )}
                    {row.status === 'active' && (
                      <button
                        type="button"
                        disabled={saving === row.id}
                        onClick={() => markQueueDone(row)}
                        className="min-h-11 rounded-2xl border border-emerald-300/30 px-4 py-2 text-sm font-semibold text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {saving === row.id ? 'Saving…' : 'Mark done'}
                      </button>
                    )}
                  </div>
            </div>
            {row.task_notes && <p className="mt-4 text-sm text-slate-400">{row.task_notes}</p>}
          </article>
            )
          }) : <EmptyLine text={loading ? 'Loading…' : empty ? 'No assigned tasks right now.' : 'No queue assignments.'} />}
      </div>
      </Panel>
    </section>
  )
}

export function AccessDeniedPage() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const goLogin = async () => {
    setBusy(true)
    try {
      await signOut()
    } catch (err) {
      console.warn('[auth] sign out from access denied failed', err?.message || err)
      try {
        await supabase.auth.signOut({ scope: 'local' })
      } catch {
        /* still navigate */
      }
    } finally {
      navigate('/operations/login', { replace: true, state: { signedOut: true } })
      setBusy(false)
    }
  }

  const home = profile?.role ? redirectForRole(profile.role) : '/operations/login'

  return (
    <section className="grid min-h-[60vh] place-items-center px-4">
      <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center text-card-foreground shadow-sm">
        <ShieldAlert className="mx-auto text-amber-600 dark:text-amber-200" size={42} />
        <h1 className="mt-5 text-3xl font-semibold text-foreground">Access denied</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your account does not have access to this operations area.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {profile?.role ? (
            <Link
              to={home}
              className="inline-flex items-center justify-center rounded-2xl border border-border bg-background px-5 py-3 font-semibold text-foreground no-underline"
            >
              Go to my home
            </Link>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={goLogin}
            className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? 'Signing out…' : 'Sign out & back to login'}
          </button>
        </div>
      </div>
    </section>
  )
}

function Panel({ title, icon: Icon, children, className = '' }) {
  return (
    <article className={`rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:rounded-3xl sm:p-5 ${className}`}>
      <div className="mb-4 flex items-center gap-3">
        <Icon className="text-primary" size={18} aria-hidden />
        <h2 className="font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </article>
  )
}

function CrewList({ title, rows, empty, busy = false }) {
  return (
    <div>
      {title && <h3 className="mb-3 text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">{title}</h3>}
      <div className="grid gap-3">
        {rows.length ? rows.map((row) => (
          <div key={`${row.staff_id}-${row.booking_id || 'free'}`} className="rounded-2xl border border-border bg-muted/30 p-4">
            <p className="font-medium text-foreground">{row.full_name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {row.branch_slug || 'All branches'}
              {busy && row.queue_number ? ` · ${formatQueueNumber(row.queue_number)}` : ''}
            </p>
          </div>
        )) : <EmptyLine text={empty} />}
      </div>
    </div>
  )
}

function StaffPoolList({ rows, canManage, canPickBranch, branches = [], saving, onAttendance, onEdit, onDeactivate }) {
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({
    full_name: '',
    username: '',
    phone: '',
    email: '',
    password: '',
    branch_slug: '',
  })

  if (!rows.length) return <EmptyLine text="No staff in this branch pool yet." />

  return (
    <div className="grid gap-3">
      {rows.map((member) => {
        const present = member.is_present_today
        const busy = member.is_busy_today
        const isEditing = editingId === member.id
        return (
          <div key={member.id} className="rounded-2xl border border-border bg-muted/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">{member.full_name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {member.username ? `@${member.username} · ` : ''}
                  {member.login_email ? `${member.login_email} · ` : ''}
                  {member.branch_slug || 'No branch'}
                  {member.phone ? ` · ${member.phone}` : ''}
                </p>
              </div>
              <span className={`w-fit rounded-full border px-3 py-1 text-[10px] font-bold uppercase ${present ? 'border-emerald-600/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200' : 'border-border bg-muted text-muted-foreground'}`}>
                {present ? (busy ? 'Deployed' : 'Present') : 'Not attended'}
              </span>
            </div>
            {canManage && isEditing && (
              <form
                className="mt-4 grid gap-2 md:grid-cols-2"
                onSubmit={async (event) => {
                  event.preventDefault()
                  await onEdit(member, editForm)
                  setEditingId(null)
                }}
              >
                <input
                  required
                  aria-label="Staff name"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="min-h-11 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none"
                />
                <input
                  required
                  minLength={3}
                  aria-label="Username"
                  value={editForm.username}
                  onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))}
                  placeholder="Username"
                  className="min-h-11 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none"
                />
                <input
                  type="email"
                  aria-label="Email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="Email (leave blank to keep)"
                  className="min-h-11 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none"
                />
                <input
                  type="text"
                  aria-label="New password"
                  value={editForm.password}
                  onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="New password (optional)"
                  minLength={8}
                  className="min-h-11 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none"
                />
                <input
                  aria-label="Phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="Phone"
                  className="min-h-11 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none"
                />
                {canPickBranch && (
                  <select
                    aria-label="Branch"
                    value={editForm.branch_slug}
                    onChange={(e) => setEditForm((f) => ({ ...f, branch_slug: e.target.value }))}
                    className="min-h-11 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none"
                  >
                    {branches.map((branch) => (
                      <option key={branch.slug} value={branch.slug}>{branch.name}</option>
                    ))}
                  </select>
                )}
                <button type="submit" disabled={saving === `${member.id}-edit`} className="min-h-11 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Save</button>
                <button type="button" onClick={() => setEditingId(null)} className="min-h-11 rounded-xl border border-border px-3 py-2 text-sm text-foreground">Cancel</button>
              </form>
            )}
            {canManage && !isEditing && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <button type="button" disabled={present || saving === `${member.id}-present`} onClick={() => onAttendance(member, 'present')} className="floor-touch-btn rounded-xl border border-emerald-600/30 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40 dark:text-emerald-100">Mark present</button>
                <button type="button" disabled={!present || saving === `${member.id}-absent`} onClick={() => onAttendance(member, 'absent')} className="floor-touch-btn rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">Mark absent</button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(member.id)
                    setEditForm({
                      full_name: member.full_name || '',
                      username: member.username || '',
                      phone: member.phone || '',
                      email: member.login_email || '',
                      password: '',
                      branch_slug: member.branch_slug || '',
                    })
                  }}
                  className="floor-touch-btn rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
                >
                  Edit
                </button>
                <button type="button" disabled={saving === `${member.id}-off`} onClick={() => onDeactivate(member)} className="floor-touch-btn rounded-xl border border-red-500/30 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-500/10 disabled:opacity-40 dark:text-red-200">Remove</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function EmptyLine({ text }) {
  return <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">{text}</p>
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
  return (
    <button
      type="button"
      onClick={onClick}
      className="floor-touch-btn inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted sm:px-5"
    >
      <RefreshCw className={loading ? 'animate-spin' : ''} size={17} aria-hidden />
      Refresh
    </button>
  )
}

function FormField({ label, value, onChange, type = 'text', required = false, min, step }) {
  return (
    <label className="text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">
      {label}
      <input
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        min={min}
        step={step}
        className="floor-control"
      />
    </label>
  )
}
