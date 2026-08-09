/** CRM smart groups — filter customers by visit timeline. */

export const CRM_SMART_GROUP_PRESETS = [
  { id: 'visited_7d', label: 'Visited last 7 days', days: 7, mode: 'visited' },
  { id: 'visited_30d', label: 'Visited last 30 days', days: 30, mode: 'visited' },
  { id: 'visited_90d', label: 'Visited last 90 days', days: 90, mode: 'visited' },
  { id: 'visited_6mo', label: 'Visited last 6 months', days: 183, mode: 'visited' },
  { id: 'lapsed_90d', label: 'Lapsed (no visit 90+ days)', days: 90, mode: 'lapsed' },
  { id: 'never', label: 'Never visited (no bookings)', days: null, mode: 'never' },
]

function daysAgoIso(days, now = Date.now()) {
  return new Date(now - days * 86400000).toISOString()
}

/**
 * @param {Array<{ id: string }>} customers
 * @param {Array<{ customer_id?: string, created_at?: string, scheduled_start?: string, completed_at?: string }>} visits
 * @param {{ id?: string, days?: number|null, mode?: string }} group
 */
export function filterCustomersBySmartGroup(customers = [], visits = [], group = {}) {
  const mode = group.mode || CRM_SMART_GROUP_PRESETS.find((p) => p.id === group.id)?.mode || 'visited'
  const days = group.days ?? CRM_SMART_GROUP_PRESETS.find((p) => p.id === group.id)?.days
  const now = Date.now()

  const lastByCustomer = new Map()
  for (const v of visits || []) {
    const cid = v.customer_id
    if (!cid) continue
    const at = v.completed_at || v.scheduled_start || v.created_at
    if (!at) continue
    const prev = lastByCustomer.get(cid)
    if (!prev || String(at) > String(prev)) lastByCustomer.set(cid, at)
  }

  return (customers || []).filter((c) => {
    const last = lastByCustomer.get(c.id)
    if (mode === 'never') return !last
    if (!last) return false
    if (mode === 'visited') {
      if (days == null) return true
      return String(last) >= daysAgoIso(days, now)
    }
    if (mode === 'lapsed') {
      if (days == null) return false
      return String(last) < daysAgoIso(days, now)
    }
    return true
  })
}

const STORAGE_KEY = 'hakum.crm.smartGroups'

export function loadSavedSmartGroups(userId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${userId || 'anon'}`)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveSmartGroup(userId, group) {
  const rows = loadSavedSmartGroups(userId)
  const next = {
    id: group.id || `custom_${Date.now()}`,
    name: String(group.name || 'Custom group').trim() || 'Custom group',
    mode: group.mode || 'visited',
    days: group.days == null ? 30 : Number(group.days),
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
