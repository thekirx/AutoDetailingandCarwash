/** Planner board visibility + tab IA. Complaints boards stay out of the task board. */

export const PLANNER_TABS = [
  { id: 'board', label: 'Tasks', hint: 'Filter, create, and assign work', icon: 'tasks' },
  { id: 'calendar', label: 'Calendar', hint: 'Tasks, bookings, and events', icon: 'calendar' },
  { id: 'forms', label: 'Forms', hint: 'List, edit, and results', icon: 'forms' },
  { id: 'events', label: 'Events', hint: 'Meets and RSVP links', icon: 'events' },
  { id: 'review', label: 'Review', hint: 'Accept or send back proof', icon: 'review' },
]

export const PLANNER_TAB_IDS = PLANNER_TABS.map((t) => t.id)

export function isPlannerBoardVisible(board) {
  const name = String(board?.name || '')
  if (!name) return false
  if (/\(archived\)/i.test(name)) return false
  if (/complaint/i.test(name)) return false
  return true
}

export function visiblePlannerBoards(boards) {
  return (Array.isArray(boards) ? boards : []).filter(isPlannerBoardVisible)
}

export function pickPlannerBoard(boards, wantedIdOrName) {
  const rows = visiblePlannerBoards(boards)
  if (!rows.length) return null
  const key = String(wantedIdOrName || '')
  return rows.find((b) => b.id === key || b.name === key) || rows[0]
}

export function plannerTabsForAccess({ canEdit, role } = {}) {
  if (role === 'video_editor') {
    return PLANNER_TABS.filter((t) => t.id === 'board' || t.id === 'calendar')
  }
  return PLANNER_TABS.filter((t) => t.id !== 'review' || canEdit)
}

export function plannerTabFromSearch(value, allowedIds) {
  const raw = value && typeof value.get === 'function' ? value.get('tab') : value
  const ids = Array.isArray(allowedIds) && allowedIds.length ? allowedIds : PLANNER_TAB_IDS
  return ids.includes(raw) ? raw : 'board'
}
