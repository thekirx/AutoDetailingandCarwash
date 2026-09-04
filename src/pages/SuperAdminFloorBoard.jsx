import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import {
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canSeeAllBranches, ROLES } from '@/auth/permissions'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import { paymentMethodLabel } from '@/lib/paymentMethods'
import { createCoalescedReload } from '@/lib/coalesceReload'
import { supabase } from '@/lib/supabase'
import {
  DASHBOARD_DATE_PRESETS,
  getDashboardDateRange,
} from '@/queue/queueLogic'
import { queueFamilyHref } from '@/lib/queueFamilies'
import {
  FLOOR_BOARD_FAMILY_META,
  floorLaneLabel,
} from '@/lib/floorBoardLanes'
import { formatCarSizeLabel } from '@/lib/ownerRevisionsPhase7'
import { fetchBranches, fetchSuperAdminFloorBoard, formatMoney } from '@/queue/queueApi'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function formatMinutes(total) {
  const n = Number(total)
  if (!Number.isFinite(n) || n <= 0) return '0m'
  if (n < 60) return `${Math.round(n)}m`
  const h = Math.floor(n / 60)
  const m = Math.round(n % 60)
  return m ? `${h}h ${m}m` : `${h}h`
}

function StatTile({ label, value, hint, tone = 'default', onNavigate, breakdown }) {
  const btnRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [tip, setTip] = useState(null)
  const toneClass =
    tone === 'green'
      ? 'border-emerald-500/25 bg-emerald-500/[0.06]'
      : tone === 'amber'
        ? 'border-amber-500/25 bg-amber-500/[0.06]'
        : tone === 'rose'
          ? 'border-rose-500/25 bg-rose-500/[0.06]'
          : 'border-border bg-card'
  const detail = String(breakdown || hint || `${label}: ${value}`).trim()
  const preview = detail.length > 160 ? `${detail.slice(0, 157)}…` : detail

  const placeTip = useCallback(() => {
    const el = btnRef.current
    if (!el || typeof window === 'undefined') return
    const r = el.getBoundingClientRect()
    const width = Math.min(288, window.innerWidth - 24)
    const below = r.bottom + 132 < window.innerHeight
    const left = Math.min(Math.max(width / 2 + 12, r.left + r.width / 2), window.innerWidth - width / 2 - 12)
    setTip({
      left,
      top: below ? r.bottom + 10 : r.top - 10,
      place: below ? 'below' : 'above',
      width,
    })
  }, [])

  const hideTip = useCallback(() => setTip(null), [])

  useEffect(() => {
    if (!tip) return undefined
    const onScroll = () => hideTip()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [tip, hideTip])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          hideTip()
          setOpen(true)
        }}
        onMouseEnter={placeTip}
        onMouseLeave={hideTip}
        onFocus={placeTip}
        onBlur={hideTip}
        aria-haspopup="dialog"
        aria-label={`${label}: ${value}. Open breakdown.`}
        className={`relative min-h-[7.5rem] rounded-2xl border p-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${toneClass}`}
      >
        <p className="text-[10px] font-bold tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">{value}</p>
        {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
      </button>
      {tip
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[80] rounded-xl border border-border bg-card px-3 py-2.5 text-left text-xs leading-relaxed text-foreground shadow-xl ring-1 ring-black/10"
              style={{
                left: tip.left,
                top: tip.top,
                width: tip.width,
                transform: tip.place === 'below' ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
              }}
            >
              <p className="line-clamp-5 whitespace-pre-wrap">{preview}</p>
              <p className="mt-1.5 text-[10px] font-medium tracking-wide text-primary uppercase">
                Click for full breakdown
              </p>
            </div>,
            document.body,
          )
        : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            {hint ? <DialogDescription>{hint}</DialogDescription> : null}
          </DialogHeader>
          <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
            {detail}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {onNavigate ? (
              <Button
                type="button"
                className="min-h-11"
                onClick={() => {
                  setOpen(false)
                  onNavigate()
                }}
              >
                Open related view
              </Button>
            ) : (
              <span />
            )}
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Section({ title, eyebrow, children, action }) {
  return (
    <section className="mt-6 sm:mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          {eyebrow ? (
            <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">{eyebrow}</p>
          ) : null}
          <h2 className="text-lg font-semibold text-foreground sm:text-xl">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/**
 * Super Admin Floor Board — Services & Packages and Detailing Services, roster, money, tempo.
 */
export default function SuperAdminFloorBoard() {
  const { profile, canViewQueueOperations } = useAuth()
  const navigate = useNavigate()
  const seeAll = canSeeAllBranches(profile)
  const [branchFilter, setBranchFilter] = useState('all')
  const [datePreset, setDatePreset] = useState('today')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [branches, setBranches] = useState([])
  const [board, setBoard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [live, setLive] = useState(false)

  const range = useMemo(
    () => getDashboardDateRange(datePreset, customStart, customEnd),
    [datePreset, customStart, customEnd],
  )
  const rangeStartDate = useMemo(() => getLocalCalendarDate(range.start), [range.start])
  const rangeEndDate = useMemo(() => getLocalCalendarDate(range.end), [range.end])
  const branchLabel =
    branchFilter === 'all' ? 'All branches' : branchFilter

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const data = await fetchSuperAdminFloorBoard(profile, {
        branchFilter,
        startDate: rangeStartDate,
        endDate: rangeEndDate,
      })
      setBoard(data)
    } catch (err) {
      setError(err.message || 'Unable to load floor board')
      setBoard(null)
    } finally {
      setLoading(false)
    }
  }, [profile, branchFilter, rangeStartDate, rangeEndDate])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!seeAll) return
    fetchBranches().then(setBranches).catch(() => setBranches([]))
  }, [seeAll])

  useEffect(() => {
    const scheduleReload = createCoalescedReload(() => load(), 500)
    const filter =
      branchFilter && branchFilter !== 'all' ? `branch=eq.${branchFilter}` : undefined
    const channel = supabase
      .channel(`sa-floor-${branchFilter}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', ...(filter ? { filter } : {}) },
        scheduleReload,
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_attendance' }, scheduleReload)
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))
    return () => {
      scheduleReload.cancel()
      supabase.removeChannel(channel)
    }
  }, [load, branchFilter])

  if (!canViewQueueOperations) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        You do not have access to the floor board.
      </p>
    )
  }

  const lanesByFamily = board?.laneCountsByFamily || { wash: {}, detailing: {} }
  const financials = board?.financials || {}
  const kpi = board?.kpi || {}
  const available = board?.availableStaff || []
  const absent = board?.absentStaff || []

  function openFamilyLane(family, lane) {
    navigate(queueFamilyHref(family, { lane, branch: branchFilter }))
  }

  function openHistory(status) {
    const params = new URLSearchParams()
    if (branchFilter && branchFilter !== 'all') params.set('branch', branchFilter)
    if (status) params.set('status', status)
    const q = params.toString()
    navigate(q ? `/operations/history?${q}` : '/operations/history')
  }

  function LaneStrip({ family }) {
    const meta = FLOOR_BOARD_FAMILY_META[family]
    const lanes = lanesByFamily[family] || {}
    const loadingValue = loading && !board ? '…' : null
    const timelineStatuses = [
      { id: 'completed', tone: 'green' },
      { id: 'cancelled', tone: 'rose' },
    ]
    const tiles = [
      ...meta.liveStatuses.map((id) => ({
        id,
        tone: id === 'in_progress' ? 'green' : id === 'final_checking' || id === 'for_payment' ? 'amber' : 'default',
        hint: 'Live',
        onClick: () => openFamilyLane(family, id),
      })),
      ...timelineStatuses.map((row) => ({
        ...row,
        hint: 'In timeline',
        onClick: () => openHistory(row.id),
      })),
    ]

    return (
      <Section eyebrow={meta.eyebrow} title={meta.title}>
        <p className="mb-3 text-xs text-muted-foreground">{meta.hint}</p>
        <div className="grid grid-cols-2 gap-3 overflow-visible md:grid-cols-3 xl:grid-cols-6">
          {tiles.map((tile) => {
            const count = loadingValue ?? lanes[tile.id] ?? 0
            const label = floorLaneLabel(tile.id, family)
            return (
            <StatTile
              key={`${family}-${tile.id}`}
              label={label}
              value={count}
              tone={tile.tone}
              hint={tile.hint}
              onNavigate={tile.onClick}
              breakdown={
                tile.hint === 'Live'
                  ? `${count} ticket${count === 1 ? '' : 's'} live in ${label} for ${meta.title}. Opens the live ${meta.title} queue lane.`
                  : `${count} ticket${count === 1 ? '' : 's'} counted in ${label} for the selected timeline (${branchLabel}). Opens History filtered to this status.`
              }
            />
            )
          })}
        </div>
      </Section>
    )
  }

  return (
    <section className="sa-floor overflow-visible pb-10">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-bold tracking-[0.22em] text-primary uppercase">
              {profile?.role === ROLES.SUPER_ADMIN ? 'Super Admin' : 'Network'}
            </p>
            {live ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-emerald-800 uppercase dark:text-emerald-200">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
                Live
              </span>
            ) : null}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Floor Board</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Services & Packages and Detailing Services across {branchLabel.toLowerCase()}. Money and tempo follow the timeline below.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden />
          Refresh
        </button>
      </header>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
          Branch
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="mt-2 block min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground sm:w-52"
          >
            <option value="all">All branches</option>
            {branches.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name || b.slug}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
          Timeline
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
            className="mt-2 block min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground sm:w-44"
          >
            {DASHBOARD_DATE_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {datePreset === 'custom' ? (
          <>
            <label className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
              From
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="mt-2 block min-h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
              />
            </label>
            <label className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
              To
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="mt-2 block min-h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
              />
            </label>
          </>
        ) : null}
        <p className="text-xs text-muted-foreground sm:pb-3">
          {rangeStartDate === rangeEndDate ? rangeStartDate : `${rangeStartDate} → ${rangeEndDate}`}
        </p>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-950 dark:text-red-100" role="alert">
          {error}
        </p>
      ) : null}

      <LaneStrip family="wash" />
      <LaneStrip family="detailing" />

      <Section eyebrow="Detailing ops" title="Detailing operations">
        <p className="mb-3 text-xs text-muted-foreground">
          Multi-day pipeline pulse — Assigned through Ready for Release are live now.
        </p>
        <div className="grid grid-cols-2 gap-3 overflow-visible md:grid-cols-3 xl:grid-cols-5">
          <StatTile
            label="Assign to branch"
            value={loading && !board ? '…' : lanesByFamily.detailing?.confirmed ?? 0}
            hint="Live"
            onNavigate={() => openFamilyLane('detailing', 'confirmed')}
            breakdown="Confirmed detailing jobs waiting to be assigned to a branch bay. Opens the live Detailing Services queue on Assign to branch."
          />
          <StatTile
            label="In shop"
            value={
              loading && !board
                ? '…'
                : (lanesByFamily.detailing?.waiting || 0) + (lanesByFamily.detailing?.in_progress || 0)
            }
            tone="green"
            hint="Intake + in progress"
            breakdown="Combined count of detailing jobs in waiting (intake) plus in progress. Live bay state for cars already on site."
          />
          <StatTile
            label="Final checking"
            value={loading && !board ? '…' : lanesByFamily.detailing?.final_checking ?? 0}
            tone="amber"
            hint="Live"
            onNavigate={() => openFamilyLane('detailing', 'final_checking')}
            breakdown="Detailing jobs in final QA / checking before release. Opens the live Final checking lane."
          />
          <StatTile
            label="For releasing"
            value={loading && !board ? '…' : lanesByFamily.detailing?.for_releasing ?? 0}
            hint="Live"
            onNavigate={() => openFamilyLane('detailing', 'for_releasing')}
            breakdown="Detailing jobs ready for customer release / handoff. Opens the live For releasing lane."
          />
          <StatTile
            label="Completed"
            value={loading && !board ? '…' : lanesByFamily.detailing?.completed ?? 0}
            tone="green"
            hint="In timeline"
            onNavigate={() => openHistory('completed')}
            breakdown="Completed detailing jobs in the selected timeline. Opens History filtered to completed."
          />
        </div>
      </Section>

      <Section
        eyebrow="Roster"
        title="Carwash crew on shift"
        action={
          <Link to="/operations/crew" className="text-sm font-medium text-primary no-underline hover:underline">
            Open crew
          </Link>
        }
      >
        <div className="grid grid-cols-2 gap-3 overflow-visible sm:grid-cols-4">
          <StatTile
            label="Available"
            value={board?.availableCount ?? available.length}
            tone="green"
            hint="Present or late · free"
            onNavigate={() => navigate('/operations/crew')}
            breakdown={
              available.length
                ? `Free carwash crew on site (present or late, not on a bay):\n${available
                    .slice(0, 24)
                    .map((r) => r.full_name)
                    .join('\n')}`
                : 'No free carwash crew on site right now.'
            }
          />
          <StatTile
            label="On a bay"
            value={board?.onBayCount ?? (board?.busyStaff?.length || 0)}
            hint="Assigned now"
            onNavigate={() => navigate('/operations/crew')}
            breakdown={
              (board?.busyStaff || []).length
                ? `Crew currently assigned to a live bay:\n${(board.busyStaff || [])
                    .slice(0, 24)
                    .map((r) => r.full_name)
                    .join('\n')}`
                : 'Nobody is assigned to a bay right now.'
            }
          />
          <StatTile
            label="Absent / not in"
            value={board?.absentCount ?? absent.length}
            tone="rose"
            hint="Not on site today"
            onNavigate={() => navigate('/operations/attendance')}
            breakdown={
              absent.length
                ? `Rostered carwash crew not checked in today:\n${absent
                    .slice(0, 24)
                    .map((r) => r.full_name)
                    .join('\n')}`
                : 'Everyone on the carwash roster is on site.'
            }
          />
          <StatTile
            label="Crew total"
            value={board?.staffPool?.length ?? available.length + absent.length}
            hint={branchLabel}
            onNavigate={() => navigate('/operations/crew')}
            breakdown={`Total carwash staff in the pool for ${branchLabel} (available + on bay + absent).`}
          />
        </div>
        {(board?.adminRoster || []).length ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
              Administrative crew
            </p>
            <div className="grid grid-cols-2 gap-3 overflow-visible sm:grid-cols-3 xl:grid-cols-5">
              {(board.adminRoster || []).map((group) => (
                <StatTile
                  key={group.role}
                  label={group.label}
                  value={group.count}
                  hint="On roster"
                  onNavigate={() => navigate('/operations/people')}
                  breakdown={
                    group.names?.length
                      ? `Active ${group.label} on roster:\n${group.names.join('\n')}`
                      : `No active ${group.label} on roster.`
                  }
                />
              ))}
            </div>
          </div>
        ) : null}
      </Section>

      <Section eyebrow="Money" title="Financials">
        <div className="grid grid-cols-2 gap-3 overflow-visible xl:grid-cols-3">
          <StatTile
            label="Queue app sales"
            value={formatMoney(financials.queue_sales_minor)}
            hint="Carwash only"
            onNavigate={() => navigate('/operations/finance')}
            breakdown={`Paid sales linked to queue tickets (services & packages) for ${branchLabel} in this timeline.\nAmount: ${formatMoney(financials.queue_sales_minor)}`}
          />
          <StatTile
            label="Counter / POS sales"
            value={formatMoney(financials.pos_sales_minor)}
            hint="Detailing · coffee · merch"
            onNavigate={() => navigate('/operations/pos')}
            breakdown={[
              `Walk-in / counter POS paid sales for ${branchLabel} in this timeline.`,
              financials.detailing_sales_minor != null
                ? `Detailing ${formatMoney(financials.detailing_sales_minor)}`
                : null,
              financials.coffee_sales_minor != null ? `Coffee ${formatMoney(financials.coffee_sales_minor)}` : null,
              financials.merch_sales_minor != null ? `Merch ${formatMoney(financials.merch_sales_minor)}` : null,
              `Total ${formatMoney(financials.pos_sales_minor)}`,
            ]
              .filter(Boolean)
              .join('\n')}
          />
          <StatTile
            label="Cash"
            value={formatMoney(financials.cash_sales_minor)}
            hint={paymentMethodLabel('cash') || 'Cash'}
            onNavigate={() => navigate('/operations/finance')}
            breakdown={`Cash tender share of paid sales in this timeline (${branchLabel}).\nAmount: ${formatMoney(financials.cash_sales_minor)}`}
          />
          <StatTile
            label="GCash"
            value={formatMoney(financials.gcash_sales_minor)}
            hint={paymentMethodLabel('gcash') || 'GCash'}
            onNavigate={() => navigate('/operations/finance')}
            breakdown={`GCash tender share of paid sales in this timeline (${branchLabel}).\nAmount: ${formatMoney(financials.gcash_sales_minor)}`}
          />
          <StatTile
            label="Credit / Debit"
            value={formatMoney(financials.card_sales_minor)}
            hint={paymentMethodLabel('card') || 'Card'}
            onNavigate={() => navigate('/operations/finance')}
            breakdown={`Credit / debit card tender share of paid sales in this timeline (${branchLabel}).\nAmount: ${formatMoney(financials.card_sales_minor)}`}
          />
          <StatTile
            label="Cancel loss"
            value={formatMoney(financials.cancel_loss_minor)}
            tone="rose"
            hint="Cancelled job value in timeline"
            onNavigate={() => openHistory('cancelled')}
            breakdown={`Estimated value of cancelled jobs in the selected timeline (${branchLabel}). Opens History filtered to cancelled.`}
          />
          <StatTile
            label="Posted expenses"
            value={formatMoney(financials.expense_minor)}
            tone="amber"
            hint="Paid · posted in timeline"
            onNavigate={() => navigate('/operations/finance')}
            breakdown="Sum of expense total_minor for paid/posted rows created in this timeline (same statuses as Finance P&L). Approved-but-unpaid bills are excluded."
          />
        </div>
      </Section>

      <Section eyebrow="Tempo" title="KPI">
        <div className="grid grid-cols-1 gap-3 overflow-visible sm:grid-cols-3">
          <StatTile
            label="Avg waiting time"
            value={kpi.avg_wait_minutes == null ? '—' : formatMinutes(kpi.avg_wait_minutes)}
            hint={
              kpi.wait_sample_n
                ? `waiting → start · avg of ${kpi.wait_sample_n} ticket${kpi.wait_sample_n === 1 ? '' : 's'}`
                : 'No wait stamps in timeline'
            }
            breakdown={
              kpi.wait_sample_n
                ? `Average minutes from bay wait stamp (waiting_at) to service start (in_progress_at).\nSample: ${kpi.wait_sample_n} ticket${kpi.wait_sample_n === 1 ? '' : 's'} with both stamps in this timeline.`
                : 'No tickets in this timeline have both waiting_at and in_progress_at stamps, so average wait cannot be computed.'
            }
          />
          <StatTile
            label="Avg time per service"
            value={kpi.avg_service_minutes == null ? '—' : formatMinutes(kpi.avg_service_minutes)}
            hint={
              kpi.cycle_sample_n
                ? `in_progress → finish · avg of ${kpi.cycle_sample_n} ticket${kpi.cycle_sample_n === 1 ? '' : 's'}`
                : 'No finish stamps in timeline'
            }
            breakdown={
              kpi.cycle_sample_n
                ? `Average minutes from in_progress_at to for_payment_at (else completed_at / final_checking_at).\nSample: ${kpi.cycle_sample_n} ticket${kpi.cycle_sample_n === 1 ? '' : 's'} with start and finish stamps.`
                : 'No tickets in this timeline have both a start and finish stamp, so average service time cannot be computed.'
            }
          />
          <StatTile
            label="Failed QA"
            value={kpi.failed_qa_count ?? 0}
            tone="rose"
            hint="Sent to redo in timeline"
            breakdown={`Count of jobs sent to redo / failed QA in the selected timeline (${branchLabel}).\nValue: ${kpi.failed_qa_count ?? 0}`}
          />
        </div>
      </Section>

      <Section eyebrow="Insights" title="Car size & best sellers">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
              Car size per sale
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Logic: each paid sale in the timeline counts once by booking vehicle size. Bar = count; amount = sum of
              sale totals.
            </p>
            {(board?.carSizeBySale || []).length ? (
              <ul className="mt-3 space-y-2">
                {(board.carSizeBySale || []).slice(0, 8).map((row) => {
                  const max = Math.max(...(board.carSizeBySale || []).map((r) => r.count), 1)
                  const pct = Math.round((row.count / max) * 100)
                  return (
                    <li key={row.size}>
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="capitalize font-medium">{formatCarSizeLabel(row.size)}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {row.count} · {formatMoney(row.total_minor)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No sized sales in this timeline — need paid sales with a vehicle size on the booking.
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
              Best package / service
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Logic: ranks sale line items by peso total; if none, uses booking service name × sale total.
            </p>
            {(board?.bestSellers || []).length ? (
              <ol className="mt-3 space-y-2">
                {(board.bestSellers || []).slice(0, 5).map((row, i) => (
                  <li key={`${row.name}-${i}`} className="flex justify-between gap-2 text-sm">
                    <span className="truncate font-medium">
                      {i === 0 ? '★ ' : ''}
                      {row.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      ₱{Number(row.total || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No ranked sellers — need paid sales with line items or a booking service name.
              </p>
            )}
          </div>
        </div>
      </Section>
    </section>
  )
}
