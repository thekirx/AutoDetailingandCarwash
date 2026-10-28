/**
 * Team Lead Queue Manager — mobile-first legacy port (cars only, no motors).
 * Reading this as: redesign-preserve of Hakum bay-floor queue for Team Leads on
 * phones, Hakum navy brand language, leaning toward existing floor-shell tokens.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  SlidersHorizontal,
  History,
  LoaderCircle,
  RefreshCw,
  Search,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { getAccessTokenFresh } from '../lib/authToken'
import { canPushFinalCheckToPayment, canViewRedoLane, canMarkFailedQa } from '../auth/permissions'
import DaylightQueueCard from '../components/ops/DaylightQueueCard'
import { formatDaylightDuration, groupDaylightQueue, queueSummary, longestWaitingMinutes } from '../queue/daylightPresentation'
import {
  filterTicketsByFamily,
  QUEUE_FAMILY_WASH,
} from '../lib/queueFamilies'
import { createCoalescedReload } from '../lib/coalesceReload'
import { getLocalCalendarDate } from '../lib/localCalendarDate'
import { supabase } from '../lib/supabase'
import {
  DURATION_FILTERS,
  QUEUE_DATE_PRESETS,
  fifoNextTicketId,
  getBranchScope,
  getOpsBoardStatuses,
  getQueueTicketActionFlags,
  groupVisitTickets,
  matchesDurationFilter,
  matchesTicketSearch,
  normalizePlate,
  requiresTeamLeadBranchSetup,
  sortTicketsFifo,
  STATUS_LABELS,
  ticketElapsedMinutes,
} from '../queue/queueLogic'
import { fetchTeamLeadDayBoard, formatMoney, sendTicketToPayment, markTicketRedo } from '../queue/queueApi'
import QueueTicketEditModal from '../components/QueueTicketEditModal'

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
  const [datePreset, setDatePreset] = useState('today')
  const [durationFilter, setDurationFilter] = useState('all')
  const [historyPlate, setHistoryPlate] = useState('')
  const [historyRows, setHistoryRows] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [editBookingId, setEditBookingId] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [savingCard, setSavingCard] = useState(null)
  const [cardError, setCardError] = useState('')
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

  const summary = useMemo(() => queueSummary(boardTickets, boardStatuses), [boardTickets, boardStatuses])
  const listTickets = useMemo(() => {
    let rows = [...boardTickets, ...dayGrouped]
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
  }, [boardTickets, dayGrouped, search, datePreset, durationFilter, today])

  const nextFifoId = useMemo(() => fifoNextTicketId(boardTickets), [boardTickets])

  const canPushToPayment = canPushFinalCheckToPayment(profile)
  const groups = useMemo(() => groupDaylightQueue(listTickets, canPushToPayment), [listTickets, canPushToPayment])
  const longestWait = longestWaitingMinutes(boardTickets)

  // Same mutations and reason prompt as the existing ticket editor; no new API or data query.
  const runCardAction = async (ticket, action, callback) => {
    setCardError('')
    setSavingCard({ id: ticket.booking_id, action })
    try {
      await callback()
      await load()
    } catch (err) {
      setCardError(err.message || 'Unable to update ticket')
    } finally {
      setSavingCard(null)
    }
  }
  const runRedo = (ticket) => {
    const reason = window.prompt('Redo reason (visible to owner in audit)', ticket.redo_reason || '')
    if (reason === null) return Promise.resolve()
    return markTicketRedo(ticket, reason)
  }

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
      // BUG-083: this fetch sent no headers, so /api/customer-history answered
      // 401 on every call — `bearer()` reads the Authorization header and has no
      // cookie fallback. It stayed invisible because the fallback below queries
      // `operations_queue_board`, a different dataset: open queue rows rather
      // than visits, with no final_price_minor, service_name or visit_group_id.
      // A Team Lead checking a car that visited last month got nothing, and the
      // panel looked healthy.
      const token = await getAccessTokenFresh()
      if (!token) {
        setHistoryError('Sign in required')
        return
      }
      const res = await fetch(`/api/customer-history?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
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
      <div className="daylight-queue-hero">
        <header className="qmgr-toolbar">
          <h1 className="qmgr-title">Queue</h1>
          <div className="qmgr-toolbar-actions">
            <button type="button" className="floor-icon-btn" onClick={() => { setLoading(true); load() }} aria-label="Refresh queue">
              {loading ? <LoaderCircle className="animate-spin" size={18} /> : <RefreshCw size={18} />}
            </button>
            <button type="button" className="daylight-filter-toggle" aria-expanded={filtersOpen} aria-controls="queue-filters" onClick={() => setFiltersOpen(open => !open)}>
              <SlidersHorizontal size={16} aria-hidden />Filter
            </button>
          </div>
        </header>
        <label className="qmgr-search">
          <Search size={18} aria-hidden />
          <input type="search" aria-label="Find plate, phone or name" value={search} onChange={(e) => { setSearch(e.target.value); setHistoryPlate(e.target.value) }} placeholder="Find plate, phone or name" enterKeyHint="search" />
        </label>
        {filtersOpen ? (
          <div className="qmgr-filter-row" id="queue-filters">
            <label className="qmgr-filter"><span>Date</span>
              <select value={datePreset} onChange={(e) => setDatePreset(e.target.value)}>
                {QUEUE_DATE_PRESETS.filter((p) => p.key !== 'custom').map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </label>
            <label className="qmgr-filter"><span>Duration</span>
              <select value={durationFilter} onChange={(e) => setDurationFilter(e.target.value)}>
                {DURATION_FILTERS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </label>
          </div>
        ) : null}
      </div>
      <div className="daylight-queue-summary" aria-label="Queue summary">
        {summary.map(item => <div key={item.key}><strong>{loading && !boardTickets.length ? <span className="daylight-number-skeleton" aria-label="Loading" /> : item.value ?? '—'}</strong><span>{item.label}</span>{item.value == null ? <span className="sr-only">Count unavailable for this role</span> : null}</div>)}
      </div>
      {search.trim() || historyOpen ? (
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
                  <span className="text-muted-foreground">{({ in_progress: 'Washing', final_checking: 'Final check', for_payment: 'To pay', completed: 'Done' })[row.status] || STATUS_LABELS[row.status] || row.status}</span>
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

      ) : null}
      <p className="daylight-longest-wait">Longest wait <strong>{formatDaylightDuration(longestWait)}</strong></p>
      {error || cardError ? <p className="qmgr-error" role="alert">{error || cardError}</p> : null}
      <div className="qmgr-list" aria-live="polite">
        {loading && !listTickets.length ? (
          Array.from({ length: 2 }, (_, i) => <div key={i} className="daylight-card-skeleton" aria-label="Loading cars" />)
        ) : groups.length ? groups.map(group => {
          const heading = <><i style={{ background: group.color }} aria-hidden />{group.label}<span>· {group.tickets.length}</span></>
          const cards = group.tickets.map(ticket => {
            const actions = getQueueTicketActionFlags(ticket.status, {
              canManageQueue,
              canPushToPayment,
              canViewRedoLane: canViewRedoLane(profile),
              canFailQa: canMarkFailedQa(profile),
            })
            const finalCheck = ticket.status === 'final_checking'
            return <DaylightQueueCard key={ticket.booking_id} ticket={ticket} yourMove={group.key === 'your_move'} next={ticket.booking_id === nextFifoId}
              canStart={actions.canStart && ticket.status === 'waiting'}
              canSendToPay={finalCheck && actions.canSendToPayment && canPushToPayment}
              canRedo={finalCheck && actions.canMarkRedo}
              saving={savingCard?.id === ticket.booking_id ? savingCard.action : null}
              onOpen={() => setEditBookingId(ticket.booking_id)}
              onSendToPay={() => runCardAction(ticket, 'payment', () => sendTicketToPayment(ticket.booking_id))}
              onRedo={() => runCardAction(ticket, 'redo', () => runRedo(ticket))} />
          })
          return group.collapsed ? (
            <details className="daylight-queue-group daylight-queue-group-collapsed" key={group.key}>
              <summary><h2>{heading}</h2><span className="daylight-show-done">Show {group.tickets.length} {group.label.toLowerCase()}</span></summary>
              {group.key === 'completed' && completedTotalMinor > 0 ? <p className="daylight-completed-total">Total {formatMoney(completedTotalMinor)}</p> : null}
              <div className="daylight-group-cards">{cards}</div>
            </details>
          ) : <section className="daylight-queue-group" key={group.key}><h2>{heading}</h2><div className="daylight-group-cards">{cards}</div></section>
        }) : <div className="qmgr-empty"><p>No cars match your search or filters.</p>{canManageQueue ? <Link to="/operations/queue/new" className="qmgr-empty-link">Add a car</Link> : null}</div>}
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
  booking_id, branch, queue_number, queue_date, status, customer_id, customer_name, customer_phone,
  vehicle_plate, vehicle_make, vehicle_model, vehicle_type, service_name, service_sla_minutes,
  base_price_minor, final_price_minor, assigned_staff_name, created_at, visit_group_id,
  service_pay_category, waiting_at, in_progress_at, final_checking_at, for_payment_at,
  actual_start, actual_end, notes
`
