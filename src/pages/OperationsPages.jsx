import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  BadgeCheck,
  CarFront,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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
import {
  filterTicketsByFamily,
  queueFamilyForProfile,
  QUEUE_FAMILIES,
} from '../lib/queueFamilies'
import { canAccessPayroll, canAccessPos, canManagePeople, canSeeAllBranches, canViewPlanning, canViewRedoLane, ROLES, isSuperAdmin } from '../auth/permissions'
import {
  DEFAULT_COMPENSATION_RULES,
  normalizeCompensationSettings,
  buildCompensationPostPlan,
} from '../lib/compensation'
import { collectPaged } from '../lib/crmInsights'
import QueueTicketEditModal from '../components/QueueTicketEditModal'
import QueueTicketEditor from '../components/QueueTicketEditor'
import TeamLeadQueuePage from './TeamLeadQueuePage'
import SuperAdminFloorBoard from './SuperAdminFloorBoard'
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
  statusShortLabel,
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
  searchPlates,
  setStaffAttendance,
  updateCrewStaffMember,
} from '../queue/queueApi'
import { allowedStaffPlanAssigneePatch } from '../queue/staffTaskLogic'
import { hasPlannerProof, isHttpProofUrl, planProofObjectPath } from '../lib/plannerTasks'
import { createCoalescedReload } from '../lib/coalesceReload'
import {
  BOOKING_TABLE_DEFAULT_PAGE_SIZE,
  BOOKING_TABLE_PAGE_SIZES,
  QUEUE_LANE_PAGE_SIZE,
  bookingVehicleText,
  paginateBookingTableRows,
  paginateRows,
} from '../lib/bookingTable'
import { Button } from '../components/ui/button'
import { Tabs } from '../components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import OpsGuideCard from '@/components/ops/OpsGuideCard'
import OpsPageShell from '@/components/ops/OpsPageShell'
import OpsTabList from '@/components/ops/OpsTabBar'
import { QUEUE_WORKFLOW_STEPS, MY_TASKS_WORKFLOW_STEPS } from '@/components/ops/opsGuideCopy'
import { toast } from 'sonner'
import { plateKindLabel, plateValidationError, PLATE_FIELD_HINT } from '../lib/customerAuth'
import { applyPlateSuggestion, plateSuggestPrefix, rankPlateSuggestions } from '../lib/plateSuggest'

const statusTone = {
  confirmed: 'queue-status-pill queue-status-waiting',
  waiting: 'queue-status-pill queue-status-waiting',
  in_progress: 'queue-status-pill queue-status-progress',
  final_checking: 'queue-status-pill queue-status-check',
  for_payment: 'queue-status-pill queue-status-pay',
  redo: 'queue-status-pill queue-status-redo',
  completed: 'queue-status-pill queue-status-done',
}

const QUEUE_SHELL_TABS = Object.freeze([
  { id: 'board', label: 'Board' },
  { id: 'table', label: 'Table' },
])

const LANE_META = {
  confirmed: { icon: ClipboardList, hint: 'Assigned from Bookings' },
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

function QueueLanePager({ slice, onPage, label }) {
  if (!slice || slice.totalPages <= 1) return null
  return (
    <div className="queue-lane-pager">
      <button
        type="button"
        className="queue-lane-pager-btn"
        disabled={slice.page <= 1}
        aria-label={`Previous ${label} page`}
        onClick={() => onPage(slice.page - 1)}
      >
        Prev
      </button>
      <p className="queue-lane-pager-range tabular-nums">
        {slice.from}–{slice.to} of {slice.total}
      </p>
      <button
        type="button"
        className="queue-lane-pager-btn"
        disabled={slice.page >= slice.totalPages}
        aria-label={`Next ${label} page`}
        onClick={() => onPage(slice.page + 1)}
      >
        Next
      </button>
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

function TicketCard({ ticket, timingWarnings, onOpen, compact = false }) {
  const warn = isSuspiciousTiming(ticket, timingWarnings)
  const linked = (ticket.linked_booking_ids?.length || 1) > 1
  const plate = String(ticket.vehicle_plate || '').trim().toUpperCase() || 'No plate'
  const car = [ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(' ') || 'Vehicle TBD'
  const service = ticket.service_name || 'Service TBD'
  const qNum = formatQueueNumber(ticket.queue_number, ticket.service_pay_category)
  const label = `${qNum} · ${plate}, ${car}, ${service}`
  const body = (
    <>
      <p className="bk-ticket-status tabular-nums">{qNum}</p>
      <p className="bk-ticket-plate">{plate}</p>
      <p className="bk-ticket-car">{car}</p>
      <p className="bk-ticket-service">{service}</p>
      {linked ? (
        <p className="bk-ticket-status">{ticket.linked_booking_ids.length} services</p>
      ) : null}
      {warn ? (
        <p className="bk-ticket-status flex items-center gap-1 text-amber-700 dark:text-amber-200">
          <ShieldAlert size={12} aria-hidden />
          Fast in-progress
        </p>
      ) : null}
    </>
  )
  if (onOpen) {
  return (
      <button
        type="button"
        onClick={() => onOpen(ticket.booking_id)}
        className={`floor-ticket queue-ticket-card bk-ticket-compact bk-ticket-openable w-full text-left ${compact ? 'queue-ticket-compact' : ''}`}
        aria-label={`Open ticket · ${label}`}
      >
        {body}
      </button>
    )
  }
  return (
    <Link
      to={`/operations/queue/${ticket.booking_id}`}
      className={`floor-ticket queue-ticket-card bk-ticket-compact bk-ticket-openable ${compact ? 'queue-ticket-compact' : ''}`}
      aria-label={`Open ticket · ${label}`}
    >
      {body}
    </Link>
  )
}

function useOperationsSnapshot(branchFilter = 'all', family = 'wash') {
  const { profile } = useAuth()
  const [snapshot, setSnapshot] = useState({ queue: [], activeQueue: [], staffPool: [], availableStaff: [], busyStaff: [], events: [], handoffs: [], timingWarnings: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [live, setLive] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      setSnapshot(await fetchOperationsSnapshot(profile, { branchFilter, family }))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [profile, branchFilter, family])

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
  if (!canViewQueueOperations) return <Navigate to="/operations/access-denied" replace />
  if (requiresTeamLeadBranchSetup(profile)) return <BranchSetupError />
  // Network floor for BossMich / ASA with all-branch scope
  if (canSeeAllBranches(profile)) return <SuperAdminFloorBoard />
  return <ScopedFloorDashboard />
}

function ScopedFloorDashboard() {
  const { profile, canViewQueueOperations } = useAuth()
  const isTeamLeadFloor = profile?.role === ROLES.TEAM_LEAD
  const seeAll = canSeeAllBranches(profile)
  const seeRedo = canViewRedoLane(profile) && !isTeamLeadFloor
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

  const queueMetricCols = isTeamLeadFloor
    ? 'xl:grid-cols-4'
    : seeRedo
      ? 'xl:grid-cols-6'
      : 'xl:grid-cols-5'

  return (
    <OpsPageShell
      className="hakum-dashboard"
      eyebrow={profile?.role === 'admin' ? 'Branch Admin' : 'Team Lead'}
      title={isTeamLeadFloor ? 'Floor' : 'Queue View'}
      description={
        profile?.role === 'admin'
          ? 'High-level floor summary — waiting cars, detailing, and tickets ready for POS.'
          : isTeamLeadFloor
            ? `Jobs on your branch · ${branchLabel}. Open Queue to assign crew and run tickets.`
            : 'Branch summary of queue volume, detailing jobs, crew, and handoffs. Open Queue for the full detail board.'
      }
      meta={
        live ? (
          <span className="floor-live-pill" aria-live="polite">
            <span className="floor-live-dot" aria-hidden />
            Live
          </span>
        ) : null
      }
      actions={<RefreshButton loading={loading || salesLoading} onClick={refreshAll} />}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
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
      <div className={`mt-4 grid gap-3 grid-cols-2 sm:mt-6 sm:gap-4 ${queueMetricCols}`}>
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
        {!isTeamLeadFloor ? (
          <MetricCard
            label="For Payment"
            value={filteredHandoffs.filter((h) => h.status === 'pending').length}
            icon={Send}
            tone="amber"
            to={canOpenPos ? '/operations/pos' : operationsQueueHref({ branch: branchFilter })}
            hint={canOpenPos ? 'Open POS checkout' : 'Open queue board'}
          />
        ) : null}
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
      {!isTeamLeadFloor && timingFlags.length > 0 && (
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
      {!isTeamLeadFloor ? (
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
      ) : null}
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
      {!isTeamLeadFloor ? (
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
      ) : null}
    </OpsPageShell>
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
  const queueFamily = queueFamilyForProfile(searchParams.get('family'), profile)
  const familyMeta = QUEUE_FAMILIES.find((f) => f.id === queueFamily) || QUEUE_FAMILIES[0]
  const requestedLane = parseQueueLaneParam(searchParams.get('lane'))
  const view = searchParams.get('view') === 'table' ? 'table' : 'board'
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
  const [lanePage, setLanePage] = useState({})
  const [tablePage, setTablePage] = useState(1)
  const [tablePageSize, setTablePageSize] = useState(BOOKING_TABLE_DEFAULT_PAGE_SIZE)
  const { activeQueue, timingWarnings, loading, error, live, reload } = useOperationsSnapshot(branchFilter, queueFamily)
  const boardStatuses = useMemo(() => getOpsBoardStatuses(profile, { family: queueFamily }), [profile, queueFamily])
  const familyQueue = useMemo(() => filterTicketsByFamily(activeQueue || [], queueFamily), [activeQueue, queueFamily])
  const visibleQueue = useMemo(
    () => familyQueue.filter((ticket) => boardStatuses.includes(ticket.status)),
    [familyQueue, boardStatuses],
  )
  const boardTickets = useMemo(() => groupVisitTickets(visibleQueue), [visibleQueue])
  const grouped = useMemo(
    () => Object.fromEntries(boardStatuses.map((status) => [status, boardTickets.filter((ticket) => ticket.status === status)])),
    [boardTickets, boardStatuses],
  )
  const counts = useMemo(() => getQueueCounts(visibleQueue, { statuses: boardStatuses }), [visibleQueue, boardStatuses])
  const focusLane = requestedLane && boardStatuses.includes(requestedLane) ? requestedLane : null
  const tableSource = useMemo(() => {
    const list = focusLane ? grouped[focusLane] || [] : boardTickets
    return [...list].sort((a, b) => {
      const ai = boardStatuses.indexOf(a.status)
      const bi = boardStatuses.indexOf(b.status)
      if (ai !== bi) return ai - bi
      return String(a.customer_name || '').localeCompare(String(b.customer_name || ''), undefined, { sensitivity: 'base' })
    })
  }, [boardTickets, boardStatuses, focusLane, grouped])
  const tableSlice = paginateBookingTableRows(tableSource, { page: tablePage, pageSize: tablePageSize })
  const branchNameBySlug = useMemo(
    () => Object.fromEntries((branches || []).map((b) => [b.slug, b.name || b.slug])),
    [branches],
  )

  useEffect(() => {
    setLanePage({})
    setTablePage(1)
  }, [queueFamily, focusLane, branchFilter])

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

  const setQueueView = useCallback((nextView) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (nextView === 'table') next.set('view', 'table')
      else next.delete('view')
      return next
    }, { replace: true })
  }, [setSearchParams])

  const setLaneFilter = useCallback((lane) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('family')
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
      next.delete('family')
      if (slug && slug !== 'all') next.set('branch', slug)
      else next.delete('branch')
      return next
    }, { replace: true })
  }, [setSearchParams])

  useEffect(() => {
    if (!searchParams.get('family')) return
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('family')
      return next
    }, { replace: true })
  }, [searchParams, setSearchParams])

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

  const queueStepIcons = {
    'stay-until-pos': Send,
    assign: UserPlus,
    payment: Wallet,
    redo: ShieldAlert,
  }

  return (
    <OpsPageShell
      className="hakum-queue queue-board"
      eyebrow="Floor"
      title="Queue"
      description={
        seeRedo
          ? 'Same-day services and packages until POS completes the sale. Redo is the owner QC lane. Detailing lives on Bookings.'
          : 'Same-day services and packages — waiting, on the bay, and final check until POS release. Detailing lives on Bookings.'
      }
      icon={CarFront}
      meta={
        live ? (
          <span className="floor-live-pill" aria-live="polite">
            <span className="floor-live-dot" aria-hidden />
            Live
          </span>
        ) : null
      }
      actions={
        canManageQueue ? (
          <Link
            to="/operations/queue/new"
            className="floor-touch-btn inline-flex min-h-11 items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground no-underline transition hover:opacity-90 sm:px-5"
          >
            <Plus size={18} aria-hidden />
            New ticket
          </Link>
        ) : null
      }
    >
      <OpsGuideCard
        title="How the queue works"
        description="Jobs stay on this board until POS completes the sale. Open any step if this is your first shift on floor."
        steps={QUEUE_WORKFLOW_STEPS}
        stepIcons={queueStepIcons}
      />

      <div className="queue-board-toolbar flex flex-col gap-3">
        <Tabs value={view} onValueChange={setQueueView} className="min-w-0">
          <div className="queue-board-controls flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <OpsTabList tabs={QUEUE_SHELL_TABS} aria-label="Queue layout" />
            <RefreshButton loading={loading} onClick={reload} />
            </div>
        </Tabs>
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
          {branchFilter && branchFilter !== 'all' ? (
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/queue/${branchFilter}`}
                target="_blank"
                rel="noreferrer"
                className="floor-touch-btn inline-flex min-h-11 items-center rounded-xl border border-border px-3 text-sm font-semibold text-foreground no-underline"
              >
                Customer kiosk
              </Link>
              <Link
                to={`/queue/${branchFilter}/tv`}
                target="_blank"
                rel="noreferrer"
                className="floor-touch-btn inline-flex min-h-11 items-center rounded-xl border border-border px-3 text-sm font-semibold text-foreground no-underline"
              >
                Shop TV
              </Link>
            </div>
          ) : null}
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
                  {statusShortLabel(status)}
                </span>
                <span className="tabular-nums text-primary">{n}</span>
              </button>
              )
            })}
          </div>
      </div>

      {view === 'table' ? (
        <div className="mt-3">
        <div className="bk-table">
          <div className="bk-table-toolbar">
          <div>
              <p className="bk-table-count">{familyMeta.shortLabel} ledger</p>
              <p className="bk-table-range">
                {tableSlice.total
                  ? `${tableSlice.from}–${tableSlice.to} of ${tableSlice.total} cars`
                  : 'No cars in this family and lane.'}
              </p>
            </div>
          </div>
          <Table className="bk-data-grid">
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead className="q-col-service">Service</TableHead>
                <TableHead>Lane</TableHead>
                <TableHead className="q-col-queue">Queue</TableHead>
                <TableHead className="q-col-branch">Branch</TableHead>
                <TableHead className="q-col-crew">Crew</TableHead>
                <TableHead className="q-col-open">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }, (_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={8}>
                      <div className="h-10 animate-pulse rounded-lg bg-muted" />
                    </TableCell>
                  </TableRow>
                ))
              ) : tableSlice.rows.length ? (
                tableSlice.rows.map((ticket) => (
                  <TableRow
                    key={ticket.booking_id}
                    className={canManageQueue ? 'cursor-pointer' : undefined}
                    onClick={() => {
                      if (canManageQueue) setEditBookingId(ticket.booking_id)
                    }}
                  >
                    <TableCell>
                      <div className="font-semibold text-foreground">{ticket.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{ticket.customer_phone || 'No phone'}</div>
                    </TableCell>
                    <TableCell className="text-foreground">{bookingVehicleText(ticket)}</TableCell>
                    <TableCell className="q-col-service font-medium text-primary">{ticket.service_name || '—'}</TableCell>
                    <TableCell>
                      <span className={statusTone[ticket.status] || statusTone.completed}>
                        {statusShortLabel(ticket.status)}
                      </span>
                    </TableCell>
                    <TableCell className="q-col-queue tabular-nums font-semibold text-foreground">
                      {formatQueueNumber(ticket.queue_number, ticket.service_pay_category)}
                    </TableCell>
                    <TableCell className="q-col-branch capitalize text-foreground">
                      {branchNameBySlug[ticket.branch] || ticket.branch || '—'}
                    </TableCell>
                    <TableCell className="q-col-crew text-muted-foreground">
                      {ticket.assigned_staff_name || 'Unassigned'}
                    </TableCell>
                    <TableCell className="q-col-open">
                      {canManageQueue ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11 cursor-pointer"
                          onClick={(event) => {
                            event.stopPropagation()
                            setEditBookingId(ticket.booking_id)
                          }}
                        >
                          Open ticket
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">View only</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No tickets in this family. Switch lane chips or create a ticket.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="bk-table-pager">
            <label className="bk-table-page-size">
              Rows per page
              <select
                value={tablePageSize}
                onChange={(e) => {
                  setTablePageSize(Number(e.target.value))
                  setTablePage(1)
                }}
                aria-label="Rows per page"
              >
                {BOOKING_TABLE_PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <p className="bk-table-page-range tabular-nums">
              {tableSlice.from}-{tableSlice.to} of {tableSlice.total}
            </p>
            <div className="bk-table-page-nav">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 min-w-11 cursor-pointer px-0"
                disabled={tableSlice.page <= 1}
                aria-label="Previous page"
                onClick={() => setTablePage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} strokeWidth={2} />
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 min-w-11 cursor-pointer px-0"
                disabled={tableSlice.page >= tableSlice.totalPages}
                aria-label="Next page"
                onClick={() => setTablePage((p) => p + 1)}
              >
                <ChevronRight size={16} strokeWidth={2} />
              </Button>
        </div>
          </div>
        </div>
        </div>
      ) : (
      <div
        className="queue-lane-board-fit mt-3 sm:mt-4"
        style={{ '--queue-lane-count': boardStatuses.length }}
        role="region"
        aria-label="Active queue lanes"
      >
        {boardStatuses.map((status) => {
          const meta = LANE_META[status] || LANE_META.waiting
          const Icon = meta.icon
          const tickets = grouped[status] || []
          const slice = paginateRows(tickets, {
            page: lanePage[status] || 1,
            pageSize: QUEUE_LANE_PAGE_SIZE,
          })
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
              <div className="queue-lane-head mb-2 flex items-start justify-between gap-1">
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => setLaneFilter(laneFocused ? null : status)}
                  aria-pressed={laneFocused}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="queue-lane-icon" aria-hidden>
                      <Icon size={12} />
                    </span>
                    <h2 className="queue-lane-title text-[10px] font-bold tracking-[0.08em] uppercase">
                      {statusShortLabel(status)}
                    </h2>
          </div>
                  <p className="queue-lane-hint mt-0.5 text-[10px] leading-snug">{meta.hint}</p>
                </button>
                <button
                  type="button"
                  className="queue-lane-count floor-touch-btn shrink-0 rounded-full px-2 py-1 text-[11px] font-bold tabular-nums"
                  onClick={() => setLaneFilter(laneFocused ? null : status)}
                  aria-label={`${STATUS_LABELS[status]}: ${tickets.length} tickets`}
                  aria-pressed={laneFocused}
                >
                  {tickets.length}
                </button>
            </div>
              <div className="floor-lane-body">
                {loading
                  ? Array.from({ length: 2 }, (_, index) => (
                      <div key={index} className="h-20 animate-pulse rounded-xl bg-muted" />
                    ))
                  : slice.rows.length
                    ? slice.rows.map((ticket) => (
                        <TicketCard
                          key={ticket.booking_id}
                          ticket={ticket}
                          timingWarnings={timingWarnings}
                          onOpen={canManageQueue ? setEditBookingId : undefined}
                          compact
                        />
                      ))
                    : <EmptyLine text="Empty" />}
          </div>
              <QueueLanePager
                slice={slice}
                label={statusShortLabel(status)}
                onPage={(page) => setLanePage((cur) => ({ ...cur, [status]: page }))}
              />
    </section>
          )
        })}
        </div>
      )}

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
    </OpsPageShell>
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
    <OpsPageShell className="hakum-queue-ticket" eyebrow="Queue" title="Ticket">
      <QueueTicketEditor
        bookingId={id}
        variant="page"
        onClose={() => navigate('/operations/queue')}
      />
    </OpsPageShell>
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
  const [, setPlateMatch] = useState(null)
  const [plateLookupState, setPlateLookupState] = useState('idle')
  const [plateSuggestions, setPlateSuggestions] = useState([])
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
          // Only seed default size once — never clobber a TL pick on re-fetch.
          vehicle_type: current._sizeReady ? current.vehicle_type : defaultSize,
          _sizeReady: true,
        }))
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [assignedBranch, canChooseBranch, profile, scopeList])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const plate = form.vehicle_plate.trim()
      const prefix = plateSuggestPrefix(plate)
      if (!prefix) {
        setPlateMatch(null)
        setPlateSuggestions([])
        setPlateLookupState('idle')
        return
      }

      setPlateLookupState('loading')
      searchPlates(plate, profile)
        .then((rows) => {
          const ranked = rankPlateSuggestions(rows, plate)
          setPlateSuggestions(ranked)
          const exact = ranked.find(
            (row) => (row.normalized_plate_number || '') === prefix && prefix.length === (row.normalized_plate_number || '').length,
          )
          if (exact && !plateValidationError(plate)) {
            setPlateMatch(exact)
            setPlateLookupState('found')
            setForm((current) => {
              if (current.vehicle_id && current.vehicle_id === (exact.vehicle_id || exact.id)) return current
              return {
                ...applyPlateSuggestion(current, exact),
                vehicle_type: normalizeVehicleType(exact.vehicle_type || current.vehicle_type),
                _sizeReady: true,
              }
            })
            return
          }
          if (!plateValidationError(plate) && ranked.length === 0) {
            setPlateMatch(null)
            setPlateLookupState('not_found')
            setForm((current) => ({ ...current, customer_id: '', vehicle_id: '' }))
            return
          }
          setPlateMatch(null)
          setPlateLookupState(ranked.length ? 'suggest' : 'idle')
        })
        .catch((err) => setError(err.message))
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [form.vehicle_plate, profile])

  const update = (key) => (event) => {
    const value = key === 'vehicle_plate' ? event.target.value.toUpperCase() : event.target.value
    setForm((current) => {
      const next = { ...current, [key]: value }
      if (key === 'customer_first_name' || key === 'customer_last_name') {
        next.customer_name = `${key === 'customer_first_name' ? value : current.customer_first_name} ${key === 'customer_last_name' ? value : current.customer_last_name}`.trim()
      }
      return next
    })
  }
  const pickPlateSuggestion = (row) => {
    setForm((current) => ({
      ...applyPlateSuggestion(current, row),
      vehicle_type: normalizeVehicleType(row.vehicle_type || current.vehicle_type),
      _sizeReady: true,
    }))
    setPlateSuggestions([])
    setPlateMatch(row)
    setPlateLookupState('found')
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
        _sizeReady: true,
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
      const plateError = plateValidationError(form.vehicle_plate)
      if (plateError) throw new Error(plateError)
      if (!form.service_ids?.length) throw new Error('Select at least one service or package.')
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
      navigate(`/operations/queue?open=${ticket.id}`)
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
    <OpsPageShell
      className="hakum-new-ticket"
      eyebrow="Create Queue Ticket"
      title="Add vehicle to queue"
      description="Required: LTO plate, conduction sticker, or temporary / TOP; phone; and at least one Service or Package. Detailing jobs belong on Bookings. Name is optional for fast walk-ins."
    >
      {error && <p className="floor-alert floor-alert-error">{error}</p>}
      <div>
        <Panel title="Ticket Form" icon={Plus}>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2 text-xs font-bold tracking-[0.14em] text-slate-500 uppercase suggest-field">
              Plate / sticker *
              <input
                value={form.vehicle_plate}
                onChange={update('vehicle_plate')}
                required
                autoFocus
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                placeholder="ABC 1234 · CS 123456 · TMP 1234"
                className="floor-control"
                aria-autocomplete="list"
                aria-expanded={plateSuggestions.length > 0}
                aria-invalid={Boolean(form.vehicle_plate.trim() && plateValidationError(form.vehicle_plate) && !plateSuggestions.length)}
              />
              {plateSuggestions.length > 0 ? (
                <ul className="suggest-list" role="listbox">
                  {plateSuggestions.map((row) => (
                    <li key={row.vehicle_id || row.id}>
                      <button
                        type="button"
                        className="suggest-option"
                        onMouseDown={(event) => {
                          event.preventDefault()
                          pickPlateSuggestion(row)
                        }}
                      >
                        {row.plate_number}
                        {row.customer_name ? ` · ${row.customer_name}` : ''}
                        {row.vehicle_make ? ` · ${[row.vehicle_make, row.vehicle_model].filter(Boolean).join(' ')}` : ''}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </label>
            <p className="sm:col-span-2 text-xs text-slate-400">{PLATE_FIELD_HINT}. Matches appear after 3 characters.</p>
            {form.vehicle_plate.trim() && plateValidationError(form.vehicle_plate) && !plateSuggestions.length ? (
              <p className="sm:col-span-2 floor-alert floor-alert-error" role="alert">
                {plateValidationError(form.vehicle_plate)}
              </p>
            ) : plateKindLabel(form.vehicle_plate) ? (
              <p className="sm:col-span-2 text-xs font-semibold text-slate-500">{plateKindLabel(form.vehicle_plate)}</p>
            ) : null}
            {plateLookupState === 'found' || plateLookupState === 'not_found' ? (
              <p className={`sm:col-span-2 floor-alert ${plateLookupState === 'found' ? 'floor-alert-ok' : 'floor-alert-warn'}`}>
                {plateLookupState === 'found' ? getPlateLookupStatus(form.vehicle_plate, true) : getPlateLookupStatus(form.vehicle_plate, false)}
              </p>
            ) : plateLookupState === 'loading' ? (
              <p className="sm:col-span-2 floor-alert">Checking plate number...</p>
            ) : null}
            <FormField label="Phone number *" value={form.customer_phone} onChange={update('customer_phone')} required />
            {form.customer_phone.trim() && String(form.customer_phone).replace(/\D/g, '').length < 10 ? (
              <p className="sm:col-span-2 floor-alert floor-alert-error" role="alert">
                Phone number is required (at least 10 digits).
              </p>
            ) : null}
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
              kinds={['service', 'package']}
            />
            {canChooseBranch && <label className="text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">Branch<select value={form.branch} onChange={update('branch')} required className="floor-control">{branches.map((branch) => <option key={branch.slug} value={branch.slug}>{branch.name}</option>)}</select></label>}
            <FormField label="Final Price in Pesos" value={form.final_price} onChange={update('final_price')} type="number" min="0" step="0.01" required />
            {showFormLowPriceWarning && <p className="floor-alert floor-alert-warn">Please confirm this amount is correct. Did you mean a higher peso amount?</p>}
            <label className="sm:col-span-2 text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">Notes<textarea value={form.notes} onChange={update('notes')} className="floor-control floor-control-area" /></label>
            <button disabled={submitting} className="floor-touch-btn sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#052699] px-5 py-3.5 text-base font-semibold text-white shadow-[0_8px_20px_rgba(5,38,153,0.28)] transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[#1d4ed8] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60">{submitting ? <LoaderCircle className="animate-spin" size={18} aria-hidden /> : <Plus size={18} aria-hidden />}Create Queue Ticket</button>
          </form>
        </Panel>
      </div>
    </OpsPageShell>
  )
}

export function CrewPage() {
  const { profile, canManageCrew, canViewQueueOperations } = useAuth()
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
    <OpsPageShell
      className="hakum-crew"
      eyebrow="Crew"
      title="Crew pool"
      description="Present crew only can be assigned to jobs. Time in / out lives on Attendance."
      actions={(
        <div className="flex flex-wrap gap-2">
          <Link
            to="/operations/attendance"
            className="floor-touch-btn inline-flex items-center rounded-2xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground no-underline"
          >
            Open Attendance
          </Link>
          <RefreshButton loading={loading} onClick={reload} />
        </div>
      )}
    >
      {actionError && <p className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm text-red-100">{actionError}</p>}

      <div className="grid grid-cols-3 gap-3 text-center text-xs text-muted-foreground">
        <span className="rounded-xl border border-border bg-card px-3 py-2"><strong className="block text-lg text-foreground">{staffPool.length}</strong>Pool</span>
        <span className="rounded-xl border border-border bg-card px-3 py-2"><strong className="block text-lg text-foreground">{presentCount}</strong>Present</span>
        <span className="rounded-xl border border-border bg-card px-3 py-2"><strong className="block text-lg text-foreground">{availableStaff.length}</strong>Deployable</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'pool', label: `Pool (${staffPool.length})` },
          { key: 'present', label: `Present (${presentCount})` },
          { key: 'busy', label: `Busy (${busyStaff.length})` },
          { key: 'compensation', label: 'Compensation' },
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
              {canManageCrew && canManagePeople(profile) ? (
                <p className="mb-5 rounded-2xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  New accounts are created in{' '}
                  <Link to="/operations/people" className="font-semibold text-primary underline-offset-4 hover:underline">
                    People
                  </Link>
                  . Use this tab to mark present and deploy crew on the floor.
                </p>
              ) : null}
              {canManageCrew && !canManagePeople(profile) ? (
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
              ) : null}
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
          {crewTab === 'compensation' && (
            <CrewCompensationPanel profile={profile} staffPool={staffPool} branchFilter={getBranchScope(profile) || 'all'} />
          )}
    </OpsPageShell>
  )
}

function CrewCompensationPanel({ profile, staffPool, branchFilter }) {
  const [salesRows, setSalesRows] = useState([])
  const [rules, setRules] = useState(DEFAULT_COMPENSATION_RULES)
  const [loading, setLoading] = useState(true)
  const isTL = profile?.role === ROLES.TEAM_LEAD
  const canSeePay = isSuperAdmin(profile) || isTL
  const today = getLocalCalendarDate()

  const load = useCallback(async () => {
    setLoading(true)
    const startIso = `${today}T00:00:00+08:00`
    const endIso = `${today}T23:59:59.999+08:00`
    try {
      const [sales, r] = await Promise.all([
        collectPaged(async (from, to) => {
          let q = supabase
            .from('sales')
            .select('id, branch, total_minor, sale_line_items(line_total_minor, services(pay_category))')
            .eq('status', 'paid')
            .gte('occurred_at', startIso)
            .lte('occurred_at', endIso)
            .order('occurred_at', { ascending: false })
            .range(from, to)
          if (branchFilter && branchFilter !== 'all') q = q.eq('branch', branchFilter)
          const { data, error } = await q
          if (error) throw error
          return data || []
        }, 1000),
        supabase
          .from('compensation_settings')
          .select(
            'wash_pool_pct, ceramic_shirt_deduction_minor, ceramic_card_fee_pct, ceramic_crew_solo_pct, ceramic_crew_split_pct, ceramic_detailer_split_pct',
          )
          .eq('id', 1)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error) throw error
            return normalizeCompensationSettings(data)
          }),
      ])
      setSalesRows(sales)
      setRules({ ...DEFAULT_COMPENSATION_RULES, ...r })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [branchFilter, today])

  useEffect(() => {
    load()
  }, [load])

  const roster = staffPool.filter((m) => m.is_present_today)
  const result = buildCompensationPostPlan({
    date: today,
    salesRows,
    roster,
    poolPct: rules.wash_pool_pct,
    posted: [],
    branchFilter,
  })
  const totalSales = result.totalSales
  const showBranch = new Set(result.rows.map((row) => row.branch)).size > 1
  const myPayRows = result.rows.filter(
    (row) => row.id === profile?.id || row.staff_id === profile?.id,
  )
  const visiblePayRows = canSeePay ? result.rows : myPayRows

  if (loading) return <Panel title="Compensation estimate" icon={Wallet} className="mt-5"><p className="text-sm text-muted-foreground">Loading…</p></Panel>

  return (
    <Panel title="Compensation estimate · today" icon={Wallet} className="mt-5">
      <p className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
        Estimate only — not posted pay. Confirm payouts on{' '}
        <Link to="/operations/payroll" className="font-semibold underline underline-offset-2">
          Payroll
        </Link>
        .
      </p>
      <div className="grid gap-3 sm:grid-cols-3 mb-4">
        <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
          <p className="text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Total sales</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatMoney(totalSales)}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
          <p className="text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Pool ({rules.wash_pool_pct}%)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatMoney(result.pool_minor)}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
          <p className="text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Present crew</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{roster.length}</p>
        </div>
      </div>
      {visiblePayRows.length > 0 ? (
        <div className="grid gap-2">
          {!canSeePay ? (
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Your pay</p>
          ) : null}
          {visiblePayRows.map((row) => (
            <div key={`${row.branch}-${row.id || row.staff_id}`} className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
              <div>
                <p className="font-medium text-foreground">{canSeePay ? row.full_name : 'Wash pool share'}</p>
                <p className="text-xs text-muted-foreground">Weight {row.weight}{showBranch ? ` · ${row.branch}` : ''}</p>
              </div>
              <p className="text-lg font-semibold tabular-nums text-foreground">{formatMoney(row.pay_minor)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{!canSeePay ? 'Your pay shows here after you time in and wash sales post.' : 'No present crew for salary split.'}</p>
      )}
      {canAccessPayroll(profile) ? (
        <div className="mt-4">
          <Link
            to="/operations/payroll"
            className="floor-touch-btn inline-flex min-h-11 items-center rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Run payroll
          </Link>
        </div>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">
        Estimate from today&apos;s paid wash sales. Confirmed pay is posted once from Payroll, not from this tab.
      </p>
      </Panel>
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
    const staffId = profile?.id || user?.id
    if (!staffId) return
    setError('')
    setLoading(true)
    const [queueRes, planRes] = await Promise.all([
      supabase
      .from('queue_assignments')
        .select('id, booking_id, task_name, task_notes, status, started_at, completed_at, released_at, created_at, bookings(vehicle_plate, branch, status, queue_number)')
      .eq('staff_id', staffId)
        .in('status', ['active', 'pending'])
        .order('created_at', { ascending: false }),
      supabase
        .from('plan_card_assignees')
        .select('id, status, notes, proof_url, proof_note, proof_submitted_at, created_at, updated_at, card_id, plan_cards(id, title, description, due_at, labels, proof_required)')
        .eq('staff_id', staffId)
        .in('status', ['todo', 'in_progress', 'for_review'])
        .order('created_at', { ascending: false }),
    ])
    if (queueRes.error) setError(queueRes.error.message)
    else setQueueRows(queueRes.data || [])
    if (planRes.error) setError((prev) => prev || planRes.error.message)
    else setPlanRows(planRes.data || [])
    setLoading(false)
  }, [user?.id, profile?.id])

  const myTasksLoadRef = useRef(load)
  myTasksLoadRef.current = load
  const scheduleMyTasks = useMemo(() => createCoalescedReload(() => myTasksLoadRef.current(), 400), [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const staffId = profile?.id || user?.id
    if (!staffId) return undefined
    const channel = supabase
      .channel(`my-tasks-${staffId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_assignments', filter: `staff_id=eq.${staffId}` }, scheduleMyTasks)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_card_assignees', filter: `staff_id=eq.${staffId}` }, scheduleMyTasks)
      .subscribe()
    return () => {
      scheduleMyTasks.cancel()
      supabase.removeChannel(channel)
    }
  }, [scheduleMyTasks, user?.id, profile?.id])

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

  const updatePlanTask = async (row, nextStatus, proofFields = {}) => {
    const proofRequired = Boolean(row.plan_cards?.proof_required)
    const patch = allowedStaffPlanAssigneePatch(
      { ...row, proof_required: proofRequired },
      { status: nextStatus, ...proofFields },
      { proofRequired },
    )
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

  if (error) return <ErrorState error={error} onRetry={load} />
  const empty = !loading && !queueRows.length && !planRows.length
  const isStaff = profile?.role === ROLES.STAFF
  const showPlannerCue = empty && canViewPlanning(profile)
  return (
    <OpsPageShell
      className="hakum-my-tasks planner-v2"
      eyebrow="My Tasks"
      title="Assigned work"
      description="Queue floor jobs and planning cards assigned to you."
      actions={
        <div className="flex flex-wrap gap-2">
          {isStaff ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/operations/attendance">Attendance</Link>
            </Button>
          ) : null}
          {showPlannerCue ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/operations/planning">Open Planner</Link>
            </Button>
          ) : null}
          <RefreshButton loading={loading} onClick={load} />
        </div>
      }
    >
      <OpsGuideCard
        title="How my tasks work"
        description="Queue assignments and planner cards assigned to you. Photo proof goes to Planner review."
        steps={MY_TASKS_WORKFLOW_STEPS}
        stepIcons={{ queue: CarFront, planning: ClipboardList, attendance: Clock3, planner: ClipboardList }}
      />

      {showPlannerCue ? (
        <p className="rounded-2xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          Nothing assigned to you yet. Assign cards from{' '}
          <Link to="/operations/planning" className="font-semibold text-primary underline-offset-4 hover:underline">
            Planner
          </Link>
          .
        </p>
      ) : null}

      <Panel title="Planning assignments" icon={ClipboardList} className="mt-2">
        <div className="grid gap-4">
          {planRows.length ? planRows.map((row) => {
            const card = row.plan_cards
            return (
              <article key={row.id} className="planner-ticket rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold">{card?.title || 'Planning card'}</p>
                    <p className="mt-1 text-xs capitalize text-muted-foreground">{row.status === 'for_review' ? 'For review' : row.status.replace('_', ' ')}{card?.due_at ? ` · due ${new Date(card.due_at).toLocaleString()}` : ''}{card?.proof_required ? ' · photo required' : ''}{row.proof_submitted_at ? ` · proof sent ${new Date(row.proof_submitted_at).toLocaleDateString()}` : ''}</p>
                    {row.proof_url && isHttpProofUrl(row.proof_url) && (
                      <a href={row.proof_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-primary underline">View proof</a>
                    )}
                    {row.proof_url && !isHttpProofUrl(row.proof_url) && (
                      <p className="mt-1 text-xs text-muted-foreground">Photo attached</p>
                    )}
                    {card?.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{card.description}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.status === 'todo' && (
                      <button type="button" disabled={saving === row.id} onClick={() => updatePlanTask(row, 'in_progress')} className="min-h-11 rounded-2xl bg-blue-500 px-4 text-sm font-semibold text-white disabled:opacity-40">Start</button>
                    )}
                    {row.status === 'in_progress' && (
                      <ProofSubmit row={row} saving={saving} userId={user.id} onSubmit={(proofFields) => updatePlanTask(row, 'for_review', proofFields)} onSkip={() => updatePlanTask(row, 'done')} />
                    )}
                    {row.status === 'for_review' && (
                      <span className="inline-flex items-center rounded-full bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-800">Waiting for review</span>
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
              <article key={row.id} className="planner-ticket rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold">{row.task_name || 'Queue service task'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {booking?.vehicle_plate ? `${booking.vehicle_plate} · ` : ''}
                      {booking?.branch || '—'}
                      {booking?.queue_number ? ` · #${formatQueueNumber(booking.queue_number)}` : ''}
                    </p>
                    <p className="mt-1 text-xs capitalize text-muted-foreground">{row.status}{booking?.status ? ` · ticket ${booking.status}` : ''}</p>
              </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {row.booking_id && !isStaff && (
                      <Link to={`/operations/queue/${row.booking_id}`} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-border px-4 py-2 text-sm font-semibold no-underline">
                        Open ticket
                      </Link>
                    )}
                    {row.status === 'pending' && (
                      <button
                        type="button"
                        disabled={saving === row.id}
                        onClick={() => markInProgress(row)}
                        className="min-h-11 rounded-2xl border border-border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {saving === row.id ? 'Saving…' : 'Acknowledge'}
                      </button>
                    )}
                    {row.status === 'active' && (
                      <button
                        type="button"
                        disabled={saving === row.id}
                        onClick={() => markQueueDone(row)}
                        className="min-h-11 rounded-2xl border border-emerald-300/30 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {saving === row.id ? 'Saving…' : 'Mark done'}
                      </button>
                    )}
            </div>
            </div>
            {row.task_notes && <p className="mt-4 text-sm text-muted-foreground">{row.task_notes}</p>}
          </article>
            )
          }) : <EmptyLine text={loading ? 'Loading…' : empty ? 'No assigned tasks right now.' : 'No queue assignments.'} />}
      </div>
      </Panel>
    </OpsPageShell>
  )
}

export { default as AccessDeniedPage } from './AccessDeniedPage'

function ProofSubmit({ row, saving, userId, onSubmit, onSkip }) {
  const [open, setOpen] = useState(false)
  const [proofNote, setProofNote] = useState('')
  const [proofFile, setProofFile] = useState(null)
  const [proofLink, setProofLink] = useState('')
  const [uploading, setUploading] = useState(false)
  const proofRequired = Boolean(row.plan_cards?.proof_required)
  if (!open) {
  return (
      <>
        <button type="button" disabled={saving === row.id} onClick={() => setOpen(true)} className="min-h-11 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40">Submit for review</button>
        {!proofRequired && (
          <button type="button" disabled={saving === row.id} onClick={onSkip} className="min-h-11 rounded-2xl border border-border px-4 text-sm font-semibold disabled:opacity-40">Mark done</button>
        )}
      </>
    )
  }

  async function submit() {
    if (proofRequired && !hasPlannerProof(row.proof_url, proofFile)) {
      toast.error('Photo proof is required for this task')
      return
    }
    let proof_url = proofLink.trim() || row.proof_url || null
    if (proofFile) {
      const cardId = row.card_id || row.plan_cards?.id
      if (!userId || !cardId) return
      setUploading(true)
      const path = planProofObjectPath(userId, cardId, proofFile.name)
      const { error } = await supabase.storage.from('plan-proofs').upload(path, proofFile, { upsert: true })
      setUploading(false)
      if (error) {
        toast.error(error.message)
        return
      }
      proof_url = path
    }
    onSubmit({ proof_url, proof_note: proofNote.trim() || null })
  }

  const busy = uploading || saving === row.id
  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl border border-border bg-card p-3">
      <label className="text-xs font-medium text-muted-foreground">{proofRequired ? 'Photo (required)' : 'Photo (optional)'}
        <input type="file" accept="image/*" className="mt-1 block w-full text-sm" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
      </label>
      <input placeholder="Note (optional)" value={proofNote} onChange={(e) => setProofNote(e.target.value)} className="min-h-10 rounded-xl border border-border bg-background px-3 text-sm" />
      {!proofRequired && (
        <input placeholder="Link (optional)" value={proofLink} onChange={(e) => setProofLink(e.target.value)} className="min-h-10 rounded-xl border border-border bg-background px-3 text-sm" />
      )}
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={submit} className="min-h-11 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40">{busy ? 'Saving…' : 'Submit'}</button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-2xl border border-border px-4 text-sm font-semibold">Cancel</button>
      </div>
    </div>
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
