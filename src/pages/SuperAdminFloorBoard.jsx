import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  RefreshCw,
  UserMinus,
  UserCheck,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canSeeAllBranches, ROLES } from '@/auth/permissions'
import QueueTicketEditModal from '@/components/QueueTicketEditModal'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import { paymentMethodLabel } from '@/lib/paymentMethods'
import { createCoalescedReload } from '@/lib/coalesceReload'
import { supabase } from '@/lib/supabase'
import {
  DASHBOARD_DATE_PRESETS,
  getDashboardDateRange,
} from '@/queue/queueLogic'
import { queueFamilyHref, ticketQueueFamily, QUEUE_FAMILY_DETAILING } from '@/lib/queueFamilies'
import {
  FLOOR_BOARD_FAMILY_META,
  floorLaneLabel,
} from '@/lib/floorBoardLanes'
import { serviceKindFromPayCategory, formatQueueNumberForKind } from '@/lib/serviceKinds'
import { fetchBranches, fetchSuperAdminFloorBoard, formatMoney } from '@/queue/queueApi'

function formatMinutes(total) {
  const n = Number(total)
  if (!Number.isFinite(n) || n <= 0) return '0m'
  if (n < 60) return `${Math.round(n)}m`
  const h = Math.floor(n / 60)
  const m = Math.round(n % 60)
  return m ? `${h}h ${m}m` : `${h}h`
}

function StatTile({ label, value, hint, tone = 'default', onClick, breakdown }) {
  const toneClass =
    tone === 'green'
      ? 'border-emerald-500/25 bg-emerald-500/[0.06]'
      : tone === 'amber'
        ? 'border-amber-500/25 bg-amber-500/[0.06]'
        : tone === 'rose'
          ? 'border-rose-500/25 bg-rose-500/[0.06]'
          : 'border-border bg-card'
  const Comp = onClick ? 'button' : 'article'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={breakdown || undefined}
      className={`group relative rounded-2xl border p-4 text-left shadow-sm transition ${toneClass} ${onClick ? 'cursor-pointer hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary' : ''}`}
    >
      <p className="text-[10px] font-bold tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
      {breakdown ? (
        <div className="pointer-events-none absolute inset-x-2 bottom-full z-10 mb-2 hidden rounded-xl border border-border bg-card p-3 text-left text-xs shadow-lg group-hover:block">
          {breakdown}
        </div>
      ) : null}
    </Comp>
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
  const [jobFilter, setJobFilter] = useState('active')
  const [editBookingId, setEditBookingId] = useState(null)

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
  const activeJobs = board?.activeQueue || []
  const periodJobs = board?.periodJobs || []

  const jobs =
    jobFilter === 'active'
      ? activeJobs
      : jobFilter === 'completed'
        ? periodJobs.filter((j) => j.status === 'completed')
        : jobFilter === 'cancelled'
          ? periodJobs.filter((j) => j.status === 'cancelled')
          : [...activeJobs, ...periodJobs]

  function openFamilyLane(family, lane) {
    navigate(queueFamilyHref(family, { lane, branch: branchFilter }))
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
        onClick: () => setJobFilter(row.id),
      })),
    ]

    return (
      <Section eyebrow={meta.eyebrow} title={meta.title}>
        <p className="mb-3 text-xs text-muted-foreground">{meta.hint}</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {tiles.map((tile) => (
            <StatTile
              key={`${family}-${tile.id}`}
              label={floorLaneLabel(tile.id, family)}
              value={loadingValue ?? lanes[tile.id] ?? 0}
              tone={tile.tone}
              hint={tile.hint}
              onClick={tile.onClick}
            />
          ))}
        </div>
      </Section>
    )
  }

  return (
    <section className="sa-floor pb-10">
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

      <Section eyebrow="Detailing ops" title="Detailing operations summary">
        <p className="mb-3 text-xs text-muted-foreground">
          Multi-day pipeline pulse — Assigned through Ready for Release are live now.
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatTile
            label="Assign to branch"
            value={loading && !board ? '…' : lanesByFamily.detailing?.confirmed ?? 0}
            hint="Live"
            onClick={() => openFamilyLane('detailing', 'confirmed')}
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
          />
          <StatTile
            label="Final checking"
            value={loading && !board ? '…' : lanesByFamily.detailing?.final_checking ?? 0}
            tone="amber"
            hint="Live"
            onClick={() => openFamilyLane('detailing', 'final_checking')}
          />
          <StatTile
            label="For releasing"
            value={loading && !board ? '…' : lanesByFamily.detailing?.for_releasing ?? 0}
            hint="Live"
            onClick={() => openFamilyLane('detailing', 'for_releasing')}
          />
          <StatTile
            label="Completed"
            value={loading && !board ? '…' : lanesByFamily.detailing?.completed ?? 0}
            tone="green"
            hint="In timeline"
            onClick={() => setJobFilter('completed')}
          />
          <StatTile
            label="Cancelled"
            value={loading && !board ? '…' : lanesByFamily.detailing?.cancelled ?? 0}
            tone="rose"
            hint="In timeline"
            onClick={() => setJobFilter('cancelled')}
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Available"
            value={board?.availableCount ?? available.length}
            tone="green"
            hint="Present or late · free"
            breakdown={
              available.length
                ? available
                    .slice(0, 12)
                    .map((r) => r.full_name)
                    .join(', ')
                : 'No free carwash crew'
            }
          />
          <StatTile
            label="On a bay"
            value={board?.onBayCount ?? (board?.busyStaff?.length || 0)}
            hint="Assigned now"
            breakdown={(board?.busyStaff || [])
              .slice(0, 12)
              .map((r) => r.full_name)
              .join(', ') || 'Nobody on a bay'}
          />
          <StatTile
            label="Absent / not in"
            value={board?.absentCount ?? absent.length}
            tone="rose"
            hint="Not on site today"
            breakdown={
              absent.length
                ? absent
                    .slice(0, 12)
                    .map((r) => r.full_name)
                    .join(', ')
                : 'Everyone on site'
            }
          />
          <StatTile
            label="Crew total"
            value={board?.staffPool?.length ?? available.length + absent.length}
            hint={branchLabel}
          />
        </div>
        {(board?.adminRoster || []).length ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
              Administrative crew
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {(board.adminRoster || []).map((group) => (
                <StatTile
                  key={group.role}
                  label={group.label}
                  value={group.count}
                  hint="On roster"
                  breakdown={group.names?.length ? group.names.join(', ') : 'None'}
                />
              ))}
            </div>
          </div>
        ) : null}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
              <UserCheck size={14} aria-hidden /> Available
            </p>
            <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
              {available.length ? (
                available.slice(0, 24).map((row) => (
                  <li key={row.staff_id} className="flex justify-between gap-2 text-sm">
                    <span className="truncate font-medium text-foreground">{row.full_name}</span>
                    <span className="shrink-0 capitalize text-muted-foreground">{row.branch_slug}</span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-muted-foreground">No free crew on site.</li>
              )}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
              <UserMinus size={14} aria-hidden /> Absent / not checked in
            </p>
            <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
              {absent.length ? (
                absent.slice(0, 24).map((row) => (
                  <li key={row.staff_id} className="flex justify-between gap-2 text-sm">
                    <span className="truncate font-medium text-foreground">{row.full_name}</span>
                    <span className="shrink-0 capitalize text-muted-foreground">
                      {(row.attendance_status || 'out').replace(/_/g, ' ')}
                    </span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-muted-foreground">Everyone on the roster is on site.</li>
              )}
            </ul>
          </div>
        </div>
      </Section>

      <Section eyebrow="Money" title="Financials">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          <StatTile
            label="Total sales"
            value={loading && !board ? '…' : formatMoney(financials.total_sales_minor)}
            tone="green"
            hint="All POS · paid"
            breakdown={
              financials.total_sales_minor
                ? `Queue (carwash) ${formatMoney(financials.queue_sales_minor || 0)} (${Math.round(((financials.queue_sales_minor || 0) / financials.total_sales_minor) * 100)}%) · Counter ${formatMoney(financials.pos_sales_minor || 0)} (${Math.round(((financials.pos_sales_minor || 0) / financials.total_sales_minor) * 100)}%)`
                : 'No sales in timeline'
            }
          />
          <StatTile
            label="Queue app sales"
            value={formatMoney(financials.queue_sales_minor)}
            hint="Carwash only"
            breakdown="Services & packages linked to queue tickets"
          />
          <StatTile
            label="Counter / POS sales"
            value={formatMoney(financials.pos_sales_minor)}
            hint="Detailing · coffee · merch"
            breakdown={[
              financials.detailing_sales_minor != null
                ? `Detailing ${formatMoney(financials.detailing_sales_minor)}`
                : null,
              financials.coffee_sales_minor != null ? `Coffee ${formatMoney(financials.coffee_sales_minor)}` : null,
              financials.merch_sales_minor != null ? `Merch ${formatMoney(financials.merch_sales_minor)}` : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'Walk-in POS buckets'}
          />
          <StatTile label="Cash" value={formatMoney(financials.cash_sales_minor)} />
          <StatTile label="GCash" value={formatMoney(financials.gcash_sales_minor)} />
          <StatTile label="Credit / Debit" value={formatMoney(financials.card_sales_minor)} />
          <StatTile
            label="Cancel loss"
            value={formatMoney(financials.cancel_loss_minor)}
            tone="rose"
            hint="Cancelled job value in timeline"
          />
          <StatTile label="Paid tickets" value={financials.paid_count ?? 0} hint="Sale rows" />
        </div>
      </Section>

      <Section eyebrow="Tempo" title="KPI">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            label="Total waiting time"
            value={formatMinutes(kpi.total_wait_minutes)}
            hint="Sum of wait → start"
          />
          <StatTile
            label="Avg time per service"
            value={kpi.avg_service_minutes == null ? '—' : formatMinutes(kpi.avg_service_minutes)}
            hint="In progress → finish"
          />
          <StatTile
            label="Failed QA"
            value={kpi.failed_qa_count ?? 0}
            tone="rose"
            hint="Sent to redo in timeline"
          />
        </div>
      </Section>

      <Section eyebrow="Insights" title="Car size & best sellers">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
              Car size per sale
            </p>
            {(board?.carSizeBySale || []).length ? (
              <ul className="mt-3 space-y-2">
                {(board.carSizeBySale || []).slice(0, 8).map((row) => {
                  const max = Math.max(...(board.carSizeBySale || []).map((r) => r.count), 1)
                  const pct = Math.round((row.count / max) * 100)
                  return (
                    <li key={row.size}>
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="capitalize font-medium">{String(row.size).replace(/_/g, ' ')}</span>
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
              <p className="mt-3 text-sm text-muted-foreground">No sized sales in this timeline.</p>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
              Best package / service
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
              <p className="mt-3 text-sm text-muted-foreground">No line items to rank yet.</p>
            )}
          </div>
        </div>
      </Section>

      <Section eyebrow="Inventory" title="Chemical usage">
        {board?.chemicalUsage?.stub ? (
          <p className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
            Needs Sunday recon — weekly chemical usage × unit cost charts appear after branch admins submit
            internal-use leftover counts.
          </p>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-3 text-xs text-muted-foreground">Usage qty × product unit cost (from recon lines).</p>
            <ul className="space-y-2">
              {(board?.chemicalUsage?.weeks || []).map((w) => {
                const maxCost = Math.max(
                  ...(board.chemicalUsage.weeks || []).map((x) => x.cost_minor),
                  1,
                )
                const pct = Math.round((w.cost_minor / maxCost) * 100)
                return (
                  <li key={w.week_of}>
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="font-medium">Week of {w.week_of}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {w.usage_qty} units · {formatMoney(w.cost_minor)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-amber-500/80" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </Section>

      <Section
        eyebrow="Jobs"
        title="Job details"
        action={
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'active', label: 'Live floor' },
              { id: 'completed', label: 'Completed' },
              { id: 'cancelled', label: 'Cancelled' },
              { id: 'all', label: 'Mix' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setJobFilter(tab.id)}
                className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${
                  jobFilter === tab.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
      >
        <div className="grid max-h-[28rem] gap-3 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
          {jobs.length ? (
            jobs.slice(0, 60).map((ticket) => {
              const family = ticketQueueFamily(ticket)
              const kind = serviceKindFromPayCategory(ticket.service_pay_category)
              const kindLabel =
                kind === 'detailing' ? 'Detailing' : kind === 'package' ? 'Package' : 'Service'
              return (
                <button
                  key={ticket.booking_id}
                  type="button"
                  onClick={() => setEditBookingId(ticket.booking_id)}
                  className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {ticket.customer_name || 'Customer'}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {ticket.branch}
                        {ticket.queue_number != null
                          ? ` · ${formatQueueNumberForKind(ticket.queue_number, ticket.service_pay_category)}`
                          : ''}
                        {' · '}
                        {ticket.vehicle_plate || 'No plate'}
                        {' · '}
                        {kindLabel}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                      {floorLaneLabel(ticket.status, family)}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-sm text-foreground/80">
                    {ticket.service_name || (family === QUEUE_FAMILY_DETAILING ? 'Detailing service' : 'Service')}
                    {ticket.final_price_minor != null ? ` · ${formatMoney(ticket.final_price_minor)}` : ''}
                  </p>
                  <p className="mt-2 text-[11px] font-medium text-primary">View details</p>
                </button>
              )
            })
          ) : (
            <p className="col-span-full rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
              {loading ? 'Loading jobs…' : 'No jobs in this view.'}
            </p>
          )}
        </div>
      </Section>

      <Section eyebrow="Recent paid" title="Sales feed">
        <div className="grid max-h-80 gap-3 overflow-y-auto">
          {(board?.recentSales || []).length ? (
            board.recentSales.map((sale) => {
              const booking = sale.bookings || {}
              const customer = sale.customers || {}
              const name = booking.customer_name || customer.full_name || 'Customer'
              return (
                <div key={sale.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{name}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {sale.branch}
                        {' · '}
                        {paymentMethodLabel(sale.payment_method)}
                        {' · '}
                        {sale.booking_id ? 'Queue' : 'POS'}
                        {' · '}
                        {sale.occurred_at ? new Date(sale.occurred_at).toLocaleString() : '—'}
                      </p>
                    </div>
                    <p className="shrink-0 text-base font-semibold tabular-nums">
                      {formatMoney(sale.total_minor)}
                    </p>
                  </div>
                </div>
              )
            })
          ) : (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No paid sales in this timeline.
            </p>
          )}
        </div>
      </Section>

      <QueueTicketEditModal
        bookingId={editBookingId}
        open={Boolean(editBookingId)}
        onOpenChange={(open) => {
          if (!open) setEditBookingId(null)
        }}
        onUpdated={load}
      />
    </section>
  )
}
