/** Planner board visibility + tab IA. Complaints boards stay out of the task board. */
import { categoryVisibleToRole } from './planCategoryRoles.js'

export const PLANNER_TABS = [
  { id: 'board', label: 'Tasks', hint: 'Filter, create, and assign work', icon: 'tasks' },
  { id: 'calendar', label: 'Calendar', hint: 'Tasks, bookings, and events', icon: 'calendar' },
  { id: 'forms', label: 'Forms', hint: 'List, edit, and results', icon: 'forms' },
  { id: 'events', label: 'Events', hint: 'Meets and RSVP links', icon: 'events' },
  { id: 'review', label: 'Review', hint: 'Accept or send back proof', icon: 'review' },
  { id: 'configure', label: 'Configure', hint: 'Lists, categories, and boards', icon: 'settings' },
]

export const PLANNER_TAB_IDS = PLANNER_TABS.map((t) => t.id)

/** Live `plan_boards` columns — name is the workspace label; visible_roles empty = everyone. */
export const PLAN_BOARDS_LIST_SELECT = 'id, name, visible_roles'

export const PLAN_BOARD_DETAIL_SELECT = `
  id, name, visible_roles,
  plan_lists (
    id, title, position,
    plan_cards (
      id, title, description, labels, due_at, position, created_at, updated_at, created_by, category_id, proof_required, form_id,
      ops_forms ( id, name ),
      plan_checklist_items ( id, title, done, position ),
      plan_card_assignees (
        id, staff_id, status, proof_url, proof_note, proof_submitted_at, reviewed_at, staff_profiles ( id, full_name )
      )
    )
  )
`

export function defaultPlanListId(lists, preferredId) {
  const rows = Array.isArray(lists) ? lists : []
  if (preferredId && rows.some((l) => l.id === preferredId)) return preferredId
  return rows[0]?.id || ''
}

export function nextPlanCardPosition(lists, listId) {
  const list = (Array.isArray(lists) ? lists : []).find((row) => row.id === listId)
  let max = -1
  for (const card of list?.plan_cards || []) {
    const n = Number(card.position)
    if (Number.isFinite(n) && n > max) max = n
  }
  return max + 1
}

export function isPlannerBoardVisible(board) {
  const name = String(board?.name || '')
  if (!name) return false
  if (/\(archived\)/i.test(name)) return false
  if (/complaint/i.test(name)) return false
  return true
}

/** 19 Oct matrix: TL, Branch Admin, Marketing, Customer Rep have no Cash advance board. */
const CASH_ADVANCE_BOARD_HIDDEN_ROLES = new Set(['team_lead', 'admin', 'marketing', 'sales'])

export function isCashAdvancePlannerBoard(board) {
  return /cash\s*advance/i.test(String(board?.name || ''))
}

export function hidesCashAdvancePlannerBoard(profile) {
  return CASH_ADVANCE_BOARD_HIDDEN_ROLES.has(profile?.role)
}

/** Prefer plan_boards.visible_roles; legacy name+role hide until the board is seeded. */
export function boardVisibleToProfile(board, profile) {
  const roles = board?.visible_roles
  if (Array.isArray(roles) && roles.length > 0) return categoryVisibleToRole(board, profile?.role)
  if (hidesCashAdvancePlannerBoard(profile) && isCashAdvancePlannerBoard(board)) return false
  return true
}

export function visiblePlannerBoards(boards, profile) {
  return (Array.isArray(boards) ? boards : []).filter((board) => {
    if (!isPlannerBoardVisible(board)) return false
    return boardVisibleToProfile(board, profile)
  })
}

export function pickPlannerBoard(boards, wantedIdOrName, profile) {
  const rows = visiblePlannerBoards(boards, profile)
  if (!rows.length) return null
  const key = String(wantedIdOrName || '')
  const exact = rows.find((b) => b.id === key || b.name === key)
  if (exact) return exact
  // Prefer the ops Planner board (Experience tickets land here) over Cash Advance / Equipment.
  const preferred = rows.find((b) => /hakum\s*planner/i.test(b.name) || /^planner$/i.test(String(b.name || '').trim()))
  return preferred || rows[0]
}

export function nextPlanListPosition(lists) {
  let max = -1
  for (const list of Array.isArray(lists) ? lists : []) {
    const n = Number(list.position)
    if (Number.isFinite(n) && n > max) max = n
  }
  return max + 1
}

export function plannerBoardNameError(name) {
  const n = String(name || '').trim()
  if (!n) return 'Name is required'
  if (/complaint/i.test(n)) return 'Complaints stays on Forms, not as a task board.'
  if (/\(archived\)/i.test(n)) return 'Drop “(archived)” or the board stays hidden.'
  return ''
}

export function listCardCount(list) {
  return (list?.plan_cards || []).length
}

export const DEFAULT_PLAN_LISTS = [
  { title: 'Upcoming', position: 0 },
  { title: 'In Progress', position: 1 },
  { title: 'Done', position: 2 },
]

/** Fixed list for detailing completion outcomes 2–3 (Experience investigation). */
export const EXPERIENCE_LIST_TITLE = 'Experience'

/** Hakum navy, ink, stub gold — category dots, not a rainbow picker. */
export const PLANNER_SWATCHES = ['#052699', '#020a31', '#c4a35a', '#334155', '#64748b']

export function plannerSwatchValue(hex) {
  const v = String(hex || '').trim()
  return /^#[0-9A-Fa-f]{6}$/.test(v) ? v : PLANNER_SWATCHES[0]
}

export function plannerTabsForAccess({ canEdit, role } = {}) {
  if (role === 'video_editor') {
    return PLANNER_TABS.filter((t) => t.id === 'board' || t.id === 'calendar')
  }
  // Crew: Forms first (submit cash advance / equipment), then own assigned tasks only.
  if (role === 'staff') {
    return PLANNER_TABS.filter((t) => t.id === 'forms').concat(PLANNER_TABS.filter((t) => t.id === 'board'))
  }
  return PLANNER_TABS.filter((t) => (t.id !== 'review' && t.id !== 'configure') || canEdit)
}

export function plannerTabFromSearch(value, allowedIds) {
  const raw = value && typeof value.get === 'function' ? value.get('tab') : value
  const ids = Array.isArray(allowedIds) && allowedIds.length ? allowedIds : PLANNER_TAB_IDS
  return ids.includes(raw) ? raw : 'board'
}

export function plannerListOptions(lists, card) {
  const rows = Array.isArray(lists) ? lists : []
  if (rows.length) return rows
  if (card?.list_id) return [{ id: card.list_id, title: card.list_title || 'List' }]
  return []
}

export function reorderPlanRows(rows, id, dir) {
  const ordered = [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    const dp = (Number(a.position) || 0) - (Number(b.position) || 0)
    if (dp) return dp
    return String(a.id).localeCompare(String(b.id))
  })
  const i = ordered.findIndex((row) => row.id === id)
  const j = i + Number(dir)
  if (i < 0 || j < 0 || j >= ordered.length) return []
  const next = [...ordered]
  const [moved] = next.splice(i, 1)
  next.splice(j, 0, moved)
  return next.map((row, position) => ({ id: row.id, position }))
}
