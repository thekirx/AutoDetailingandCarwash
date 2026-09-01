/**
 * Team Lead Queue Manager — mobile-first legacy port (cars only, no motors).
 * Reading this as: redesign-preserve of Hakum bay-floor queue for Team Leads on
 * phones, Hakum navy brand language, leaning toward existing floor-shell tokens.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ChevronDown,
  ChevronUp,
  History,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { serviceKindFromPayCategory } from '../lib/serviceKinds'
import {
  filterTicketsByFamily,
  QUEUE_FAMILY_WASH,
} from '../lib/queueFamilies'
import { createCoalescedReload } from '../lib/coalesceReload'
import { getLocalCalendarDate } from '../lib/localCalendarDate'
import { isOverSla } from '../lib/ownerRevisionsPhase7'
import { supabase } from '../lib/supabase'
import {
  DURATION_FILTERS,
  QUEUE_DATE_PRESETS,
  averageDwellByStatus,
  fifoNextTicketId,
  formatQueueNumber,
  getBranchScope,
  getOpsBoardStatuses,
  groupVisitTickets,
  matchesDurationFilter,
  matchesTicketSearch,
  normalizePlate,
  requiresTeamLeadBranchSetup,
  sortTicketsFifo,
  STATUS_LABELS,
  statusShortLabel,
  ticketElapsedMinutes,
} from '../queue/queueLogic'
import { fetchTeamLeadDayBoard, formatMoney } from '../queue/queueApi'
import QueueTicketEditModal from '../components/QueueTicketEditModal'

const BASE_STATUS_FILTERS = [
  { key: 'waiting', label: 'Waiting' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'final_checking', label: 'Final Check' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
]

function minutesBetween(startIso, endIso) {
  if (!startIso) return null
  const start = new Date(startIso).getTime()
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
  return Math.max(0, Math.round((end - start) / 60_000))
}

function formatDuration(mins) {
  if (mins == null) return '0m'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function QueueManagerCard({ ticket, expanded, onToggle, onOpen, canManage, isFifoNext }) {
  const status = ticket.status
  const kind = serviceKindFromPayCategory(ticket.service_pay_category)
  const services = (ticket.service_names?.length
    ? ticket.service_names
    : [ticket.service_name].filter(Boolean))
  const price = Number(ticket.final_price_minor ?? ticket.base_price_minor ?? 0)
  const waitMins = minutesBetween(ticket.waiting_at || ticket.created_at, ticket.in_progress_at || ticket.actual_start)
  const processMins = minutesBetween(
    ticket.in_progress_at || ticket.actual_start,
    ticket.actual_end || ticket.final_checking_at,
  )
  const totalMins = minutesBetween(
    ticket.created_at,
    ticket.actual_end || (['waiting', 'in_progress', 'final_checking'].includes(status) ? null : ticket.actual_end),
  )
  const sla = ticket.service_sla_minutes
  const processOver = isOverSla(processMins, sla)
  const totalOver = isOverSla(totalMins, sla)
  const sizeLabel = ticket.vehicle_type
    ? String(ticket.vehicle_type).replace(/_/g, ' ')
    : ''
  const vehicleLabel = [ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(' ')
    || ticket.vehicle_model
    || 'Vehicle'
  const canStartHere = canManage && status === 'waiting'

  return (
    <article className="qmgr-card">
      <button type="button" className="qmgr-card-head" onClick={onToggle} aria-expanded={expanded}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="qmgr-plate">{ticket.vehicle_plate || 'NO PLATE'}</span>
            {isFifoNext ? (
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Next
              </span>
            ) : null}
            <span className={`qmgr-status qmgr-status-${status}`}>
              {STATUS_LABELS[status] || status}
            </span>
          </div>
          <p className="mt-2 truncate text-base font-semibold text-foreground capitalize">
            {vehicleLabel}
            {sizeLabel ? (
              <span className="ml-1.5 font-normal text-muted-foreground normal-case">
                ({sizeLabel})
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatQueueNumber(ticket.queue_number, ticket.service_pay_category)}
            {kind === 'detailing' ? ' · Detailing' : kind === 'package' ? ' · Package' : ' · Service'}
          </p>
        </div>
        <span className="qmgr-chevron" aria-hidden>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </button>

      {expanded ? (
        <div className="qmgr-card-body">
          <div className="qmgr-meta-block">
            <p className="qmgr-meta-label">Service</p>
            <div className="flex flex-wrap gap-1.5">
              {services.length ? services.map((name) => (
                <span key={name} className="qmgr-service-pill">{name}</span>
              )) : <span className="text-sm text-muted-foreground">No service</span>}
            </div>
          </div>

          <div className="qmgr-meta-grid">
            <div>
              <p className="qmgr-meta-label">Phone</p>
              <p className="qmgr-meta-value">{ticket.customer_phone || 'N/A'}</p>
            </div>
            <div>
              <p className="qmgr-meta-label">Total Cost</p>
              <p className="qmgr-meta-value qmgr-meta-money">{formatMoney(price)}</p>
            </div>
            <div>
              <p className="qmgr-meta-label">Waiting</p>
              <p className="qmgr-meta-value">{formatDuration(waitMins)}</p>
            </div>
            <div>
              <p className="qmgr-meta-label">Process</p>
              <p className={`qmgr-meta-value ${processOver ? 'text-red-600 dark:text-red-400' : ''}`}>
                {formatDuration(processMins)}
              </p>
            </div>
            <div>
              <p className="qmgr-meta-label">Duration</p>
              <p className={`qmgr-meta-value ${totalOver ? 'text-red-600 dark:text-red-400' : ''}`}>
                {formatDuration(totalMins)}
              </p>
            </div>
            <div>
              <p className="qmgr-meta-label">Customer</p>
              <p className="qmgr-meta-value truncate">{ticket.customer_name || '—'}</p>
            </div>
          </div>

          <div className="qmgr-meta-block">
            <p className="qmgr-meta-label">Crew</p>
            <div className="flex flex-wrap gap-1.5">
              {ticket.assigned_staff_name ? (
                String(ticket.assigned_staff_name)
                  .split(',')
                  .map((name) => name.trim())
                  .filter(Boolean)
                  .map((name) => (
                    <span key={name} className="qmgr-crew-pill">
                      <Users size={12} aria-hidden />
                      {name}
                    </span>
                  ))
              ) : (
                <span className="text-sm text-muted-foreground">
                  {canStartHere ? 'Unassigned — open ticket to assign, then Start' : 'Unassigned'}
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            {canStartHere && onOpen ? (
              <button
                type="button"
                className="qmgr-open-btn qmgr-open-btn-primary"
                onClick={() => onOpen(ticket.booking_id)}
              >
                Assign crew &amp; start
              </button>
            ) : null}
            {onOpen && ['waiting', 'in_progress', 'final_checking'].includes(status) ? (
              <button type="button" className="qmgr-open-btn" onClick={() => onOpen(ticket.booking_id)}>
                {canStartHere ? 'Open ticket' : status === 'in_progress' ? 'Final check / manage' : 'Open ticket'}
              </button>
            ) : (
              <Link to={`/operations/queue/${ticket.booking_id}`} className="qmgr-open-btn">
                View ticket
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </article>
  )
}

export default function TeamLeadQueuePage() {
  const { profile, canManageQueue, canViewQueueOperations } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const queueFamily = QUEUE_FAMILY_WASH
  const branch = getBranchScope(profile) || 'all'
  const boardStatuses = useMemo(() => getOpsBoardStatuses(profile, { family: queueFamily }), [profile, queueFamily])

  const [activeQueue, setActiveQueue] = useState([])
  const [dayTickets, setDayTickets] = useState([])
  const [completedTotalMinor, setCompletedTotalMinor] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('waiting')
  const [datePreset, setDatePreset] = useState('today')
  const [durationFilter, setDurationFilter] = useState('all')
  const [historyPlate, setHistoryPlate] = useState('')
  const [historyRows, setHistoryRows] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [editBookingId, setEditBookingId] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const today = getLocalCalendarDate()

  useEffect(() => {
    if (!searchParams.get('family')) return
    const next = new URLSearchParams(searchParams)
    next.delete('family')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    const openId = searchParams.get('open')
    if (!openId || !canManageQueue) return
    setEditBookingId(openId)
    setExpandedId(openId)
    setStatusFilter('waiting')
    const next = new URLSearchParams(searchParams)
    next.delete('open')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, canManageQueue])

  const load = useCallback(async () => {
    setError('')
    try {
      const data = await fetchTeamLeadDayBoard(profile, { branchFilter: branch, day: today, family: queueFamily })
      setActiveQueue(filterTicketsByFamily(data.activeQueue || [], queueFamily))
      setDayTickets(filterTicketsByFamily(data.dayTickets || [], queueFamily))
      setCompletedTotalMinor(data.completedTotalMinor || 0)
    } catch (err) {
      setError(err.message || 'Unable to load queue')
    } finally {
      setLoading(false)
    }
  }, [profile, branch, today, queueFamily])

  const loadRef = useRef(load)
  loadRef.current = load
  const scheduleReload = useMemo(
    () => createCoalescedReload(() => loadRef.current(), 400),
    [],
  )

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel(`tl-queue-manager-${branch}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `branch=eq.${branch}` }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_assignments' }, scheduleReload)
      .subscribe()
    return () => {
      scheduleReload.cancel()
      supabase.removeChannel(channel)
    }
  }, [branch, scheduleReload])

  const boardTickets = useMemo(() => groupVisitTickets(activeQueue), [activeQueue])
  const dayGrouped = useMemo(() => groupVisitTickets(dayTickets), [dayTickets])

  const statusFilters = BASE_STATUS_FILTERS

  const counts = useMemo(() => {
    const out = {
      confirmed: 0,
      waiting: 0,
      in_progress: 0,
      final_checking: 0,
      completed: 0,
      cancelled: 0,
      all: 0,
    }
    for (const t of boardTickets) {
      if (out[t.status] != null) out[t.status] += 1
    }
    for (const t of dayGrouped) {
      if (t.status === 'completed') out.completed += 1
      if (t.status === 'cancelled') out.cancelled += 1
    }
    out.all =
      out.confirmed + out.waiting + out.in_progress + out.final_checking + out.completed + out.cancelled
    return out
  }, [boardTickets, dayGrouped])

  const listTickets = useMemo(() => {
    let rows = []
    if (statusFilter === 'all') {
      rows = [...boardTickets, ...dayGrouped]
    } else if (statusFilter === 'completed' || statusFilter === 'cancelled') {
      rows = dayGrouped.filter((t) => t.status === statusFilter)
    } else if (boardStatuses.includes(statusFilter)) {
      rows = boardTickets.filter((t) => t.status === statusFilter)
    } else {
      rows = boardTickets
    }
    const todayKey = today
    if (datePreset === 'today') {
      rows = rows.filter((t) => {
        if (['waiting', 'in_progress', 'final_checking'].includes(t.status)) {
          // Open lanes stay until POS completes — isTicketOnTodayFloor upstream.
          return true
        }
        return t.queue_date === todayKey || String(t.created_at || '').slice(0, 10) === todayKey
      })
    } else if (datePreset === 'yesterday') {
      const y = new Date(`${todayKey}T12:00:00+08:00`)
      y.setDate(y.getDate() - 1)
      const yKey = y.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
      rows = rows.filter((t) => t.queue_date === yKey || String(t.created_at || '').slice(0, 10) === yKey)
    } else if (datePreset === 'week') {
      const end = new Date(`${todayKey}T12:00:00+08:00`)
      const start = new Date(end)
      start.setDate(start.getDate() - 6)
      rows = rows.filter((t) => {
        const key = t.queue_date || String(t.created_at || '').slice(0, 10)
        if (!key) return false
        const d = new Date(`${key}T12:00:00+08:00`)
        return d >= start && d <= end
      })
    }
    rows = rows.filter(
      (t) =>
        matchesTicketSearch(t, search) &&
        matchesDurationFilter(ticketElapsedMinutes(t), durationFilter),
    )
    return sortTicketsFifo(rows)
  }, [boardTickets, dayGrouped, statusFilter, search, boardStatuses, datePreset, durationFilter, today])

  const nextFifoId = useMemo(() => fifoNextTicketId(boardTickets), [boardTickets])

  const dwellAverages = useMemo(
    () => averageDwellByStatus(
      boardTickets.filter((t) => boardStatuses.includes(t.status) || t.status === 'for_payment'),
    ),
    [boardTickets, boardStatuses],
  )

  const runHistory = async () => {
    const q = String(historyPlate || '').trim()
    if (!q) {
      setHistoryError('Enter a plate or phone number')
      return
    }
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const params = new URLSearchParams({ q, limit: '40' })
      const res = await fetch(`/api/customer-history?${params}`)
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        const visits = body.visits || body.rows || body.timeline || []
        if (Array.isArray(visits) && visits.length) {
          const mapped = visits.map((v) => ({
            booking_id: v.booking_id || v.id,
            vehicle_plate: v.vehicle_plate || v.plate,
            status: v.status,
            final_price_minor: v.final_price_minor ?? v.total_minor,
            base_price_minor: v.base_price_minor,
            service_name: v.service_name || (v.services || []).join(', '),
            created_at: v.created_at || v.visited_at,
            customer_phone: v.customer_phone || v.phone,
            visit_group_id: v.visit_group_id,
          }))
          setHistoryRows(groupVisitTickets(mapped))
          return
        }
      }
      // Fallback: board plate/phone search when API empty or unavailable
      const plate = normalizePlate(q)
      const digits = q.replace(/\D/g, '')
      let query = supabase.from('operations_queue_board').select(QUEUE_BOARD_SELECT_MIN)
      if (plate && plate.length >= 3) {
        query = query.ilike('vehicle_plate', `%${plate}%`)
      } else if (digits.length >= 7) {
        query = query.ilike('customer_phone', `%${digits}%`)
      } else {
        query = query.or(`vehicle_plate.ilike.%${q}%,customer_phone.ilike.%${q}%`)
      }
      const { data, error: histErr } = await query.order('created_at', { ascending: false }).limit(40)
      if (histErr) throw histErr
      setHistoryRows(groupVisitTickets(data || []))
    } catch (err) {
      setHistoryError(err.message || 'History lookup failed')
      setHistoryRows([])
    } finally {
      setHistoryLoading(false)
    }
  }

  if (!canViewQueueOperations) {
    return <p className="p-4 text-sm text-muted-foreground">Queue access required.</p>
  }
  if (requiresTeamLeadBranchSetup(profile)) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-950 dark:text-amber-100">
        Assign a branch to this Team Lead account before managing the queue.
      </div>
    )
  }

  return (
    <section className="qmgr">
      <header className="qmgr-toolbar">
        <div className="qmgr-toolbar-text">
          <h1 className="qmgr-title">Car Wash Queue</h1>
          <p className="qmgr-sub">
            {QUEUE_DATE_PRESETS.find((p) => p.key === datePreset)?.label || 'Today'}
            {' · services & packages · detailing on Bookings'}
          </p>
        </div>
        <div className="qmgr-toolbar-actions">
          <button
            type="button"
            className="floor-icon-btn"
            onClick={() => {
              setLoading(true)
              load()
            }}
            aria-label="Refresh queue"
          >
            {loading ? <LoaderCircle className="animate-spin" size={18} /> : <RefreshCw size={18} />}
          </button>
          {canManageQueue ? (
            <Link to="/operations/queue/new" className="qmgr-add-btn qmgr-add-btn-inline">
              <Plus size={18} aria-hidden />
              Add
            </Link>
          ) : null}
        </div>
      </header>

      <label className="qmgr-search">
        <Search size={16} aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Plate, phone, service…"
          enterKeyHint="search"
        />
      </label>

      <div className="qmgr-filter-row">
        <label className="qmgr-filter">
          <span>Date</span>
          <select value={datePreset} onChange={(e) => setDatePreset(e.target.value)}>
            {QUEUE_DATE_PRESETS.filter((p) => p.key !== 'custom').map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="qmgr-filter">
          <span>Duration</span>
          <select value={durationFilter} onChange={(e) => setDurationFilter(e.target.value)}>
            {DURATION_FILTERS.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </label>
      </div>

      <details
        className="qmgr-history"
        open={historyOpen}
        onToggle={(e) => setHistoryOpen(e.currentTarget.open)}
      >
        <summary className="qmgr-history-summary">
          <History size={15} aria-hidden />
          Plate / phone history
        </summary>
        <div className="qmgr-history-body">
          <label className="qmgr-search">
            <Search size={16} aria-hidden />
            <input
              type="search"
              value={historyPlate}
              onChange={(e) => setHistoryPlate(e.target.value)}
              placeholder="Plate or phone…"
              enterKeyHint="search"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  runHistory()
                }
              }}
            />
          </label>
          <button
            type="button"
            className="qmgr-history-btn"
            disabled={historyLoading}
            onClick={runHistory}
          >
            {historyLoading ? 'Searching…' : 'Search'}
          </button>
          {historyError ? <p className="qmgr-history-error" role="alert">{historyError}</p> : null}
          {historyRows ? (
            <div className="qmgr-history-results">
              {historyRows.length ? historyRows.map((row) => (
                <button
                  key={row.booking_id}
                  type="button"
                  className="qmgr-history-row"
                  onClick={() => setEditBookingId(row.booking_id)}
                >
                  <span className="font-semibold">{row.vehicle_plate}</span>
                  <span className="text-muted-foreground">{STATUS_LABELS[row.status] || row.status}</span>
                  <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatMoney(row.final_price_minor ?? row.base_price_minor ?? 0)}
                  </span>
                </button>
              )) : (
                <p className="text-sm text-muted-foreground">No history for that plate or phone.</p>
              )}
            </div>
          ) : null}
        </div>
      </details>

      {Object.keys(dwellAverages).length ? (
        <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground" aria-label="Average dwell by status">
          {['waiting', 'in_progress', 'final_checking', 'for_payment'].map((key) => {
            const avg = dwellAverages[key]
            if (avg == null) return null
            return (
              <span key={key} className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5">
                {statusShortLabel(key)} avg {formatDuration(Math.round(avg))}
              </span>
            )
          })}
        </div>
      ) : null}

      <div className="qmgr-status-grid" role="toolbar" aria-label="Filter by status">
        {statusFilters.map((item) => {
          const active = statusFilter === item.key
          const n = counts[item.key] ?? 0
          const showTotal = item.key === 'completed' && completedTotalMinor > 0
          return (
            <button
              key={item.key}
              type="button"
              className={`qmgr-status-card ${active ? 'qmgr-status-card-active' : ''}`}
              aria-pressed={active}
              onClick={() => setStatusFilter(item.key)}
            >
              <span className="qmgr-status-card-label">{item.label}</span>
              <span className="qmgr-status-card-value">{n}</span>
              {showTotal ? (
                <span className="qmgr-status-card-total">{formatMoney(completedTotalMinor)}</span>
              ) : null}
            </button>
          )
        })}
      </div>

      {error ? (
        <p className="qmgr-error" role="alert">{error}</p>
      ) : null}

      <div className="qmgr-list" aria-live="polite">
        {loading && !listTickets.length ? (
          Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/40" />
          ))
        ) : listTickets.length ? (
          listTickets.map((ticket) => (
            <QueueManagerCard
              key={ticket.booking_id}
              ticket={ticket}
              expanded={expandedId === ticket.booking_id}
              onToggle={() => setExpandedId((id) => (id === ticket.booking_id ? null : ticket.booking_id))}
              onOpen={canManageQueue ? setEditBookingId : undefined}
              canManage={canManageQueue}
              isFifoNext={ticket.booking_id === nextFifoId}
            />
          ))
        ) : (
          <div className="qmgr-empty">
            <p>No cars in this filter.</p>
            {canManageQueue ? (
              <Link to="/operations/queue/new" className="qmgr-empty-link">Add a car</Link>
            ) : null}
          </div>
        )}
      </div>

      {canManageQueue ? (
        <QueueTicketEditModal
          bookingId={editBookingId}
          open={Boolean(editBookingId)}
          onOpenChange={(next) => {
            if (!next) setEditBookingId(null)
          }}
          onUpdated={load}
        />
      ) : null}
    </section>
  )
}

/** Minimal select for plate history (avoids pulling unused board columns). */
const QUEUE_BOARD_SELECT_MIN = `
  booking_id, branch, queue_number, queue_date, status, customer_name, customer_phone,
  vehicle_plate, vehicle_make, vehicle_model, vehicle_type, service_name, service_sla_minutes,
  base_price_minor, final_price_minor, assigned_staff_name, created_at, visit_group_id,
  service_pay_category, waiting_at, in_progress_at, final_checking_at, for_payment_at,
  actual_start, actual_end
`
