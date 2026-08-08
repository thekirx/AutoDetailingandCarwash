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
  operationsQueueHref,
  STATUS_LABELS,
} from '@/queue/queueLogic'
import { fetchBranches, fetchSuperAdminFloorBoard, formatMoney } from '@/queue/queueApi'

function formatMinutes(total) {
  const n = Number(total)
  if (!Number.isFinite(n) || n <= 0) return '0m'
  if (n < 60) return `${Math.round(n)}m`
  const h = Math.floor(n / 60)
  const m = Math.round(n % 60)
  return m ? `${h}h ${m}m` : `${h}h`
}

function StatTile({ label, value, hint, tone = 'default', onClick }) {
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
      className={`rounded-2xl border p-4 text-left shadow-sm transition ${toneClass} ${onClick ? 'cursor-pointer hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary' : ''}`}
    >
      <p className="text-[10px] font-bold tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
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
 * Super Admin network floor — all-branch pulse, roster, money, tempo.
 * Signature: one continuous lane strip (bay status), then three quiet panels.
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

  const lanes = board?.laneCounts || {}
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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Floor</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Bay status across {branchLabel.toLowerCase()}. Money and tempo follow the timeline below.
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

      <Section eyebrow="Bay status" title="Jobs on the floor">
        <p className="mb-3 text-xs text-muted-foreground">
          Waiting through For Payment are live now. Completed and Cancelled follow the timeline.
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatTile
            label="Waiting"
            value={loading && !board ? '…' : lanes.waiting ?? 0}
            hint="Live"
            onClick={() => navigate(operationsQueueHref({ lane: 'waiting', branch: branchFilter }))}
          />
          <StatTile
            label="In progress"
            value={loading && !board ? '…' : lanes.in_progress ?? 0}
            tone="green"
            hint="Live"
            onClick={() => navigate(operationsQueueHref({ lane: 'in_progress', branch: branchFilter }))}
          />
          <StatTile
            label="Final checking"
            value={loading && !board ? '…' : lanes.final_checking ?? 0}
            tone="amber"
            hint="Live"
            onClick={() => navigate(operationsQueueHref({ lane: 'final_checking', branch: branchFilter }))}
          />
          <StatTile
            label="For payment"
            value={loading && !board ? '…' : lanes.for_payment ?? 0}
            tone="amber"
            hint="Live"
            onClick={() => navigate(operationsQueueHref({ lane: 'for_payment', branch: branchFilter }))}
          />
          <StatTile
            label="Completed"
            value={loading && !board ? '…' : lanes.completed ?? 0}
            tone="green"
            hint="In timeline"
            onClick={() => setJobFilter('completed')}
          />
          <StatTile
            label="Cancelled"
            value={loading && !board ? '…' : lanes.cancelled ?? 0}
            tone="rose"
            hint="In timeline"
            onClick={() => setJobFilter('cancelled')}
          />
        </div>
      </Section>

      <Section
        eyebrow="Roster"
        title="Crew on shift"
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
          />
          <StatTile
            label="On a bay"
            value={board?.onBayCount ?? (board?.busyStaff?.length || 0)}
            hint="Assigned now"
          />
          <StatTile
            label="Absent / not in"
            value={board?.absentCount ?? absent.length}
            tone="rose"
            hint="Not on site today"
          />
          <StatTile
            label="Crew total"
            value={board?.staffPool?.length ?? available.length + absent.length}
            hint={branchLabel}
          />
        </div>
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
            hint="POS + queue · paid"
          />
          <StatTile
            label="Queue app sales"
            value={formatMoney(financials.queue_sales_minor)}
            hint="Linked to a ticket"
          />
          <StatTile
            label="Counter / POS sales"
            value={formatMoney(financials.pos_sales_minor)}
            hint="Walk-in, merch, coffee"
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
            jobs.slice(0, 60).map((ticket) => (
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
                      {ticket.queue_number != null ? ` · Q-${String(ticket.queue_number).padStart(3, '0')}` : ''}
                      {' · '}
                      {ticket.vehicle_plate || 'No plate'}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                    {STATUS_LABELS[ticket.status] || ticket.status}
                  </span>
                </div>
                <p className="mt-2 truncate text-sm text-foreground/80">
                  {ticket.service_name || 'Service'}
                  {ticket.final_price_minor != null ? ` · ${formatMoney(ticket.final_price_minor)}` : ''}
                </p>
                <p className="mt-2 text-[11px] font-medium text-primary">View details</p>
              </button>
            ))
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
