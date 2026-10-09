/** CRM smart groups - segment customers by visit timeline, visit count, spend, branch and reachability. */

/** Which date a customer is matched on. `never` ignores the range. */
export const CRM_MATCHES = Object.freeze([
  { id: 'any', label: 'Visited', hint: 'Had a completed visit in the range' },
  { id: 'first', label: 'New customers', hint: 'First ever visit falls in the range' },
  { id: 'last', label: 'Last visit', hint: 'Most recent visit falls in the range (use "More than" for lapsed)' },
  { id: 'joined', label: 'Signed up', hint: 'Account created in the range' },
  { id: 'never', label: 'Never visited', hint: 'No completed visit yet' },
])

export const CRM_RANGE_KINDS = Object.freeze([
  { id: 'last', label: 'In the last' },
  { id: 'before', label: 'More than … ago' },
  { id: 'between', label: 'Between dates' },
  { id: 'months', label: 'Month range' },
  { id: 'all', label: 'Any time' },
])

export const CRM_RANGE_UNITS = Object.freeze([
  { id: 'days', label: 'days' },
  { id: 'weeks', label: 'weeks' },
  { id: 'months', label: 'months' },
])

const preset = (id, label, match, range) => Object.freeze({ id, label, filter: { match, range } })
export const CRM_SMART_GROUP_PRESETS = Object.freeze([
  preset('visited_7d', 'Visited last 7 days', 'any', { kind: 'last', amount: 7, unit: 'days' }),
  preset('visited_30d', 'Visited last 30 days', 'any', { kind: 'last', amount: 30, unit: 'days' }),
  preset('visited_90d', 'Visited last 90 days', 'any', { kind: 'last', amount: 90, unit: 'days' }),
  preset('visited_6mo', 'Visited last 6 months', 'any', { kind: 'last', amount: 6, unit: 'months' }),
  preset('new_30d', 'New customers (30 days)', 'first', { kind: 'last', amount: 30, unit: 'days' }),
  preset('lapsed_90d', 'Lapsed (no visit 90+ days)', 'last', { kind: 'before', amount: 90, unit: 'days' }),
  preset('never', 'Never visited', 'never', { kind: 'all' }),
])

export const DEFAULT_SMART_FILTER = Object.freeze({
  match: 'any',
  range: { kind: 'last', amount: 30, unit: 'days' },
  minVisits: null,
  maxVisits: null,
  minSpendMinor: null,
  branch: 'all',
  smsOnly: false,
})

const MATCH_IDS = new Set(CRM_MATCHES.map((m) => m.id))
const KIND_IDS = new Set(CRM_RANGE_KINDS.map((k) => k.id))
const UNIT_IDS = new Set(CRM_RANGE_UNITS.map((u) => u.id))
const DAY_MS = 86400000

const posInt = (v) => {
  const n = Math.floor(Number(v))
  return v === '' || v == null || !Number.isFinite(n) || n < 0 ? null : n
}

/** Accepts the current filter shape, a preset, or a legacy saved group `{ mode, days }`. */
export function normalizeSmartFilter(input = {}) {
  const src = input.filter || input
  let match = src.match
  let range = src.range
  if (!match && src.mode) {
    const days = src.days == null ? null : Number(src.days)
    if (src.mode === 'never') match = 'never'
    else if (src.mode === 'lapsed') [match, range] = ['last', { kind: 'before', amount: days ?? 90, unit: 'days' }]
    else [match, range] = ['any', days == null ? { kind: 'all' } : { kind: 'last', amount: days, unit: 'days' }]
  }
  const r = range || {}
  const kind = KIND_IDS.has(r.kind) ? r.kind : DEFAULT_SMART_FILTER.range.kind
  return {
    match: MATCH_IDS.has(match) ? match : DEFAULT_SMART_FILTER.match,
    range: {
      kind,
      amount: Math.max(1, posInt(r.amount) ?? 30),
      unit: UNIT_IDS.has(r.unit) ? r.unit : 'days',
      from: r.from || '',
      to: r.to || '',
    },
    minVisits: posInt(src.minVisits),
    maxVisits: posInt(src.maxVisits),
    minSpendMinor: posInt(src.minSpendMinor),
    branch: src.branch || 'all',
    smsOnly: Boolean(src.smsOnly),
  }
}

function shiftBack(now, amount, unit) {
  if (unit === 'months') {
    const d = new Date(now)
    d.setMonth(d.getMonth() - amount)
    return d.getTime()
  }
  return now - amount * (unit === 'weeks' ? 7 : 1) * DAY_MS
}

const localDayStart = (ymd) => {
  const [y, m, d] = String(ymd).split('-').map(Number)
  return y && m ? new Date(y, m - 1, d || 1).getTime() : null
}

/** `{ from, to }` in epoch ms (either may be null = open). Local calendar days, `to` exclusive. */
export function resolveSmartRange(range = {}, now = Date.now()) {
  const amount = Math.max(1, posInt(range.amount) ?? 30)
  switch (range.kind) {
    case 'last':
      return { from: shiftBack(now, amount, range.unit), to: null }
    case 'before':
      return { from: null, to: shiftBack(now, amount, range.unit) }
    case 'between': {
      const from = range.from ? localDayStart(range.from) : null
      const end = range.to ? localDayStart(range.to) : null
      return { from, to: end == null ? null : end + DAY_MS }
    }
    case 'months': {
      const from = range.from ? localDayStart(`${range.from}-01`) : null
      let to = null
      if (range.to) {
        const [y, m] = range.to.split('-').map(Number)
        to = new Date(y, m, 1).getTime()
      }
      return { from, to }
    }
    default:
      return { from: null, to: null }
  }
}

const inRange = (ms, { from, to }) => ms != null && (from == null || ms >= from) && (to == null || ms < to)

const visitTime = (v) => {
  const at = v.completed_at || v.scheduled_start || v.created_at
  const ms = at ? Date.parse(at) : NaN
  return Number.isFinite(ms) ? ms : null
}

/**
 * Per-customer visit stats from booking rows. Only completed bookings count; bookings sharing a
 * `visit_group_id` (wash + detail on one trip) are one visit.
 */
export function buildCustomerVisitStats(visits = [], { branch = 'all' } = {}) {
  const byCustomer = new Map()
  for (const v of visits || []) {
    if (!v?.customer_id || (v.status && v.status !== 'completed')) continue
    if (branch !== 'all' && v.branch !== branch) continue
    const at = visitTime(v)
    if (at == null) continue
    let s = byCustomer.get(v.customer_id)
    if (!s) {
      s = { trips: new Map(), spendMinor: 0, branches: new Map() }
      byCustomer.set(v.customer_id, s)
    }
    const trip = v.visit_group_id || v.id || `${v.customer_id}:${at}`
    const prev = s.trips.get(trip)
    if (prev == null || at < prev) s.trips.set(trip, at)
    s.spendMinor += Number(v.final_price_minor ?? v.price_minor) || 0
    if (v.branch) s.branches.set(v.branch, (s.branches.get(v.branch) || 0) + 1)
  }
  const out = new Map()
  for (const [id, s] of byCustomer) {
    const times = [...s.trips.values()].sort((a, b) => a - b)
    out.set(id, {
      visits: times.length,
      visitTimes: times,
      firstVisit: times[0],
      lastVisit: times[times.length - 1],
      spendMinor: s.spendMinor,
      topBranch: [...s.branches.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    })
  }
  return out
}

const EMPTY_STATS = Object.freeze({ visits: 0, visitTimes: [], firstVisit: null, lastVisit: null, spendMinor: 0, topBranch: null })

export function isSmsReachable(c) {
  return Boolean(String(c?.phone || '').trim()) && c?.notify_sms !== false && !c?.is_disabled
}

/**
 * @returns customers that match, each with `stats` attached.
 * @param {object} group filter, preset, or legacy saved group
 */
export function filterCustomersBySmartGroup(customers = [], visits = [], group = {}, now = Date.now()) {
  const f = normalizeSmartFilter(group)
  const stats = buildCustomerVisitStats(visits, { branch: f.branch })
  const range = resolveSmartRange(f.range, now)
  const out = []
  for (const c of customers || []) {
    const s = stats.get(c.id) || EMPTY_STATS
    if (f.smsOnly && !isSmsReachable(c)) continue
    if (f.match === 'never') {
      if (s.visits) continue
    } else if (f.match === 'joined') {
      if (!inRange(c.created_at ? Date.parse(c.created_at) : null, range)) continue
    } else {
      if (!s.visits) continue
      if (f.match === 'first' && !inRange(s.firstVisit, range)) continue
      if (f.match === 'last' && !inRange(s.lastVisit, range)) continue
      if (f.match === 'any' && !s.visitTimes.some((t) => inRange(t, range))) continue
    }
    if (f.minVisits != null && s.visits < f.minVisits) continue
    if (f.maxVisits != null && s.visits > f.maxVisits) continue
    if (f.minSpendMinor != null && s.spendMinor < f.minSpendMinor) continue
    out.push({ ...c, stats: s })
  }
  return out
}

const plural = (n, word) => `${n} ${n === 1 ? word.replace(/s$/, '') : word}`
const fmtYmd = (ymd) => {
  const ms = localDayStart(ymd)
  return ms == null ? ymd : new Date(ms).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}
const fmtYm = (ym) => {
  const ms = localDayStart(`${ym}-01`)
  return ms == null ? ym : new Date(ms).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
}

export function describeSmartRange(range = {}) {
  const amount = Math.max(1, posInt(range.amount) ?? 30)
  switch (range.kind) {
    case 'last':
      return `in the last ${plural(amount, range.unit || 'days')}`
    case 'before':
      return `more than ${plural(amount, range.unit || 'days')} ago`
    case 'between':
      if (range.from && range.to) return `between ${fmtYmd(range.from)} and ${fmtYmd(range.to)}`
      if (range.from) return `since ${fmtYmd(range.from)}`
      return range.to ? `up to ${fmtYmd(range.to)}` : 'any time'
    case 'months':
      if (range.from && range.to) return range.from === range.to ? `in ${fmtYm(range.from)}` : `from ${fmtYm(range.from)} to ${fmtYm(range.to)}`
      if (range.from) return `since ${fmtYm(range.from)}`
      return range.to ? `up to ${fmtYm(range.to)}` : 'any time'
    default:
      return 'any time'
  }
}

/** One plain sentence for the active filter, e.g. "First visit in the last 30 days · 2+ visits". */
export function describeSmartFilter(group = {}, branchName = (s) => s) {
  const f = normalizeSmartFilter(group)
  const lead = {
    any: 'Visited',
    first: 'First visit',
    last: 'Last visit',
    joined: 'Signed up',
  }[f.match]
  const parts = [f.match === 'never' ? 'Never visited' : `${lead} ${describeSmartRange(f.range)}`]
  if (f.minVisits != null && f.maxVisits != null) parts.push(`${f.minVisits}-${f.maxVisits} visits`)
  else if (f.minVisits != null) parts.push(`${f.minVisits}+ visits`)
  else if (f.maxVisits != null) parts.push(`at most ${plural(f.maxVisits, 'visits')}`)
  if (f.minSpendMinor != null) parts.push(`spent ₱${(f.minSpendMinor / 100).toLocaleString('en-PH')}+`)
  if (f.branch !== 'all') parts.push(`at ${branchName(f.branch)}`)
  if (f.smsOnly) parts.push('SMS reachable')
  return parts.join(' · ')
}

/** Range filters that can't produce a window yet (missing or reversed dates). */
export function smartRangeError(range = {}) {
  if (range.kind !== 'between' && range.kind !== 'months') return ''
  if (!range.from && !range.to) return 'Pick a start or end date.'
  if (range.from && range.to && range.from > range.to) return 'Start is after end.'
  return ''
}

/**
 * Ticket notes (`bookings.notes`, typed on the Team Lead New ticket form or on a booking),
 * one entry per visit: lines of a multi-service visit share the same note.
 */
export function ticketNotesFromBookings(bookings = []) {
  const byVisit = new Map()
  for (const b of bookings) {
    const text = String(b?.notes || '').trim()
    if (!text) continue
    const key = `${b.visit_group_id || b.id}|${text}`
    const service = b.services?.name
    const hit = byVisit.get(key)
    if (hit) {
      if (service && !hit.services.includes(service)) hit.services.push(service)
      continue
    }
    byVisit.set(key, {
      id: key,
      text,
      at: b.created_at,
      branch: b.branch,
      plate: b.vehicle_plate || '',
      queueNumber: b.queue_number ?? null,
      fromTeamLead: Boolean(b.team_lead_id),
      author: b.team_lead_name || null,
      services: service ? [service] : [],
    })
  }
  return [...byVisit.values()]
}

/**
 * Marketing summary for one customer's bookings. Visit / spend numbers come from
 * `buildCustomerVisitStats` so the profile matches the smart-group table.
 */
export function summarizeCustomerHistory(bookings = [], now = Date.now()) {
  const id = bookings.find((b) => b?.customer_id)?.customer_id || '_'
  const s = buildCustomerVisitStats(bookings.map((b) => ({ ...b, customer_id: id }))).get(id) || EMPTY_STATS
  const gaps = s.visitTimes.slice(1).map((t, i) => t - s.visitTimes[i])
  const services = new Map()
  for (const b of bookings) {
    const name = b?.status === 'completed' ? b.services?.name : null
    if (name) services.set(name, (services.get(name) || 0) + 1)
  }
  return {
    ...s,
    avgTicketMinor: s.visits ? Math.round(s.spendMinor / s.visits) : 0,
    daysSinceLast: s.lastVisit == null ? null : Math.floor((now - s.lastVisit) / DAY_MS),
    cadenceDays: gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length / DAY_MS) : null,
    topServices: [...services.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, count]) => ({ name, count })),
    cancelled: bookings.filter((b) => b?.status === 'cancelled').length,
    noShows: bookings.filter((b) => b?.status === 'no_show').length,
  }
}

const STORAGE_KEY = 'hakum.crm.smartGroups'

export function loadSavedSmartGroups(userId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${userId || 'anon'}`)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map((g) => ({ ...g, filter: normalizeSmartFilter(g) })) : []
  } catch {
    return []
  }
}

export function saveSmartGroup(userId, group) {
  const rows = loadSavedSmartGroups(userId)
  const next = {
    id: group.id || `custom_${Date.now()}`,
    name: String(group.name || 'Custom group').trim() || 'Custom group',
    filter: normalizeSmartFilter(group.filter || group),
    created_at: new Date().toISOString(),
  }
  rows.unshift(next)
  localStorage.setItem(`${STORAGE_KEY}:${userId || 'anon'}`, JSON.stringify(rows.slice(0, 40)))
  return next
}

export function deleteSavedSmartGroup(userId, id) {
  const rows = loadSavedSmartGroups(userId).filter((g) => g.id !== id)
  localStorage.setItem(`${STORAGE_KEY}:${userId || 'anon'}`, JSON.stringify(rows))
  return rows
}
