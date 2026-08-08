/**
 * Team Lead Queue Manager — mobile-first legacy port (cars only, no motors).
 * Reading this as: redesign-preserve of Hakum bay-floor queue for Team Leads on
 * phones, Hakum navy brand language, leaning toward existing floor-shell tokens.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { createCoalescedReload } from '../lib/coalesceReload'
import { getLocalCalendarDate } from '../lib/localCalendarDate'
import { supabase } from '../lib/supabase'
import {
  formatQueueNumber,
  getBranchScope,
  getOpsBoardStatuses,
  groupVisitTickets,
  normalizePlate,
  requiresTeamLeadBranchSetup,
  STATUS_LABELS,
} from '../queue/queueLogic'
import { fetchTeamLeadDayBoard, formatMoney } from '../queue/queueApi'
import QueueTicketEditModal from '../components/QueueTicketEditModal'

const STATUS_FILTERS = [
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

function ticketMatchesSearch(ticket, q) {
  if (!q) return true
  const hay = [
    ticket.vehicle_plate,
    ticket.vehicle_make,
    ticket.vehicle_model,
    ticket.service_name,
    ticket.customer_name,
    ticket.customer_phone,
    ...(ticket.service_names || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

function QueueManagerCard({ ticket, expanded, onToggle, onOpen }) {
  const status = ticket.status
  const kind = serviceKindFromPayCategory(ticket.service_pay_category)
  const services = (ticket.service_names?.length
    ? ticket.service_names
    : [ticket.service_name].filter(Boolean))
  const price = Number(ticket.final_price_minor ?? ticket.base_price_minor ?? 0)
  const waitMins = minutesBetween(ticket.created_at, ticket.in_progress_at || ticket.actual_start)
  const processMins = minutesBetween(
    ticket.in_progress_at || ticket.actual_start,
    ticket.actual_end || ticket.final_checking_at,
  )
  const totalMins = minutesBetween(
    ticket.created_at,
    ticket.actual_end || (['waiting', 'in_progress', 'final_checking'].includes(status) ? null : ticket.actual_end),
  )
  const sizeLabel = ticket.vehicle_type
    ? String(ticket.vehicle_type).replace(/_/g, ' ')
    : ''
  const vehicleLabel = [ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(' ')
    || ticket.vehicle_model
    || 'Vehicle'

  return (
    <article className="qmgr-card">
      <button type="button" className="qmgr-card-head" onClick={onToggle} aria-expanded={expanded}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="qmgr-plate">{ticket.vehicle_plate || 'NO PLATE'}</span>
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
              <p className="qmgr-meta-value">{formatDuration(processMins)}</p>
            </div>
            <div>
              <p className="qmgr-meta-label">Duration</p>
              <p className="qmgr-meta-value">{formatDuration(totalMins)}</p>
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
                <span className="text-sm text-muted-foreground">Unassigned</span>
              )}
            </div>
          </div>

          {onOpen && ['waiting', 'in_progress', 'final_checking'].includes(status) ? (
            <button type="button" className="qmgr-open-btn" onClick={() => onOpen(ticket.booking_id)}>
              Open ticket
            </button>
          ) : (
            <Link to={`/operations/queue/${ticket.booking_id}`} className="qmgr-open-btn">
              View ticket
            </Link>
          )}
        </div>
      ) : null}
    </article>
  )
}

export default function TeamLeadQueuePage() {
  const { profile, canManageQueue, canViewQueueOperations } = useAuth()
  const branch = getBranchScope(profile) || 'all'
  const boardStatuses = useMemo(() => getOpsBoardStatuses(profile), [profile])

  const [activeQueue, setActiveQueue] = useState([])
  const [dayTickets, setDayTickets] = useState([])
  const [completedTotalMinor, setCompletedTotalMinor] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('waiting')
  const [historyPlate, setHistoryPlate] = useState('')
  const [historyRows, setHistoryRows] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [editBookingId, setEditBookingId] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const today = getLocalCalendarDate()

  const load = useCallback(async () => {
    setError('')
    try {
      const data = await fetchTeamLeadDayBoard(profile, { branchFilter: branch, day: today })
      setActiveQueue(data.activeQueue || [])
      setDayTickets(data.dayTickets || [])
      setCompletedTotalMinor(data.completedTotalMinor || 0)
    } catch (err) {
      setError(err.message || 'Unable to load queue')
    } finally {
      setLoading(false)
    }
  }, [profile, branch, today])

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_assignments' }, scheduleReload)
      .subscribe()
    return () => {
      scheduleReload.cancel()
      supabase.removeChannel(channel)
    }
  }, [branch, scheduleReload])

  const boardTickets = useMemo(() => groupVisitTickets(activeQueue), [activeQueue])
  const dayGrouped = useMemo(() => groupVisitTickets(dayTickets), [dayTickets])

  const counts = useMemo(() => {
    const out = {
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
    out.all = out.waiting + out.in_progress + out.final_checking + out.completed + out.cancelled
    return out
  }, [boardTickets, dayGrouped])

  const listTickets = useMemo(() => {
    const q = search.trim().toLowerCase()
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
    return rows.filter((t) => ticketMatchesSearch(t, q))
  }, [boardTickets, dayGrouped, statusFilter, search, boardStatuses])

  const runHistory = async () => {
    const plate = normalizePlate(historyPlate)
    if (!plate) {
      setHistoryError('Enter a plate number')
      return
    }
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const { data, error: histErr } = await supabase
        .from('operations_queue_board')
        .select(QUEUE_BOARD_SELECT_MIN)
        .ilike('vehicle_plate', `%${plate}%`)
        .order('created_at', { ascending: false })
        .limit(40)
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
          <h1 className="qmgr-title">Queue</h1>
          <p className="qmgr-sub">Today · cars</p>
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
          placeholder="Plate, model, service…"
          enterKeyHint="search"
        />
      </label>

      <details
        className="qmgr-history"
        open={historyOpen}
        onToggle={(e) => setHistoryOpen(e.currentTarget.open)}
      >
        <summary className="qmgr-history-summary">
          <History size={15} aria-hidden />
          Plate history
        </summary>
        <div className="qmgr-history-body">
          <label className="qmgr-search">
            <Search size={16} aria-hidden />
            <input
              type="search"
              value={historyPlate}
              onChange={(e) => setHistoryPlate(e.target.value.toUpperCase())}
              placeholder="Plate number…"
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
                <p className="text-sm text-muted-foreground">No history for that plate.</p>
              )}
            </div>
          ) : null}
        </div>
      </details>

      <div className="qmgr-status-grid" role="toolbar" aria-label="Filter by status">
        {STATUS_FILTERS.map((item) => {
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
  vehicle_plate, vehicle_make, vehicle_model, vehicle_type, service_name,
  base_price_minor, final_price_minor, assigned_staff_name, created_at, visit_group_id,
  service_pay_category, in_progress_at, final_checking_at, actual_start, actual_end
`
