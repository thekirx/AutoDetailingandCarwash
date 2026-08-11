/** Planner board visibility + tab IA. Complaints boards stay out of the task board. */

export const PLANNER_TABS = [
  { id: 'board', label: 'Tasks', hint: 'Move cards across columns', icon: 'tasks' },
  { id: 'calendar', label: 'Calendar', hint: 'Due dates, forms, events, bookings', icon: 'calendar' },
  { id: 'forms', label: 'Forms', hint: 'Fill, share, and review answers', icon: 'forms' },
  { id: 'events', label: 'Events', hint: 'Meets and RSVP links', icon: 'events' },
  { id: 'settings', label: 'Setup', hint: 'Labels and checklist templates', icon: 'setup' },
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

export function plannerTabFromSearch(value) {
  return PLANNER_TAB_IDS.includes(value) ? value : 'board'
}
