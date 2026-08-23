/**
 * Ops Lab — shared strategy boards for SA · ASA · BA · Operations Lead.
 * Deep seam: board kinds, item kinds, viewport math, notify copy.
 */

export const BOARD_KINDS = Object.freeze([
  { value: 'brainstorm', label: 'Brainstorm', hint: 'Open ideas' },
  { value: 'plan', label: 'Plan', hint: 'Dated execution plan' },
  { value: 'roadmap', label: 'Roadmap', hint: 'Quarter / horizon' },
  { value: 'solution', label: 'Solution', hint: 'Fix tied to a pain' },
])

export const BOARD_STATUSES = Object.freeze([
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
])

export const BOARD_PRIORITIES = Object.freeze([
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
])

export const ROADMAP_COLORS = Object.freeze([
  { value: 'amber', label: 'Amber', bg: '#fef3c7', border: '#f59e0b', ink: '#78350f' },
  { value: 'sky', label: 'Sky', bg: '#e0f2fe', border: '#0ea5e9', ink: '#0c4a6e' },
  { value: 'mint', label: 'Mint', bg: '#d1fae5', border: '#10b981', ink: '#064e3b' },
  { value: 'rose', label: 'Rose', bg: '#ffe4e6', border: '#f43f5e', ink: '#881337' },
  { value: 'violet', label: 'Violet', bg: '#ede9fe', border: '#8b5cf6', ink: '#4c1d95' },
  { value: 'slate', label: 'Slate', bg: '#f1f5f9', border: '#64748b', ink: '#0f172a' },
  { value: 'brand', label: 'Hakum', bg: '#e8edff', border: '#052699', ink: '#031d78' },
])

export const ROADMAP_KINDS = Object.freeze([
  { value: 'note', label: 'Sticky', defaultW: 220, defaultH: 160 },
  { value: 'heading', label: 'Heading', defaultW: 320, defaultH: 72 },
  { value: 'frame', label: 'Frame', defaultW: 420, defaultH: 280 },
  { value: 'action', label: 'Action', defaultW: 240, defaultH: 140 },
  { value: 'complaint_link', label: 'Complaint', defaultW: 260, defaultH: 180 },
  { value: 'form_link', label: 'Form link', defaultW: 260, defaultH: 160 },
])

export const ITEM_STATUSES = Object.freeze([
  { value: 'open', label: 'Open' },
  { value: 'doing', label: 'Doing' },
  { value: 'done', label: 'Done' },
])

export function boardKindMeta(value) {
  return BOARD_KINDS.find((k) => k.value === value) || BOARD_KINDS[0]
}

export function roadmapColor(value) {
  return ROADMAP_COLORS.find((c) => c.value === value) || ROADMAP_COLORS[0]
}

export function normalizeViewport(raw) {
  const v = raw && typeof raw === 'object' ? raw : {}
  const zoom = Math.min(2.5, Math.max(0.35, Number(v.zoom) || 1))
  return {
    x: Number.isFinite(Number(v.x)) ? Number(v.x) : 0,
    y: Number.isFinite(Number(v.y)) ? Number(v.y) : 0,
    zoom,
  }
}

export function clampItemSize(kind, w, h) {
  const def = ROADMAP_KINDS.find((k) => k.value === kind) || ROADMAP_KINDS[0]
  return {
    w: Math.min(720, Math.max(120, Math.round(Number(w) || def.defaultW))),
    h: Math.min(640, Math.max(80, Math.round(Number(h) || def.defaultH))),
  }
}

export function newRoadmapItemDraft({
  boardId,
  kind = 'note',
  color = 'brand',
  x = 120,
  y = 120,
  title = '',
  body = '',
  createdBy = null,
  meta = {},
  itemStatus = 'open',
} = {}) {
  const kindMeta = ROADMAP_KINDS.find((k) => k.value === kind) || ROADMAP_KINDS[0]
  const defaultTitle =
    kindMeta.value === 'heading'
      ? 'New heading'
      : kindMeta.value === 'complaint_link'
        ? 'Complaint link'
        : kindMeta.value === 'action'
          ? 'Next action'
          : ''
  const defaultBody =
    kindMeta.value === 'note'
      ? 'Idea…'
      : kindMeta.value === 'complaint_link'
        ? 'Link a customer complaint to this solution.'
        : kindMeta.value === 'action'
          ? 'Owner · due · outcome'
          : ''
  return {
    board_id: boardId,
    kind: kindMeta.value,
    title: title || defaultTitle,
    body: body || defaultBody,
    color: kindMeta.value === 'complaint_link' ? 'rose' : color,
    x: Math.round(Number(x) || 120),
    y: Math.round(Number(y) || 120),
    w: kindMeta.defaultW,
    h: kindMeta.defaultH,
    z_index: Date.now() % 1_000_000,
    meta: meta && typeof meta === 'object' ? meta : {},
    item_status: ITEM_STATUSES.some((s) => s.value === itemStatus) ? itemStatus : 'open',
    created_by: createdBy,
    updated_by: createdBy,
  }
}

export function newBoardDraft({
  title = '',
  boardKind = 'brainstorm',
  status = 'open',
  priority = 'normal',
  branchSlug = null,
  createdBy = null,
  description = '',
} = {}) {
  const kind = BOARD_KINDS.some((k) => k.value === boardKind) ? boardKind : 'brainstorm'
  return {
    title: String(title || '').trim() || `${boardKindMeta(kind).label} · untitled`,
    description: String(description || '').trim() || null,
    board_kind: kind,
    status: BOARD_STATUSES.some((s) => s.value === status) ? status : 'open',
    priority: BOARD_PRIORITIES.some((p) => p.value === priority) ? priority : 'normal',
    branch_slug: branchSlug || null,
    created_by: createdBy,
    updated_by: createdBy,
    viewport: { x: 0, y: 0, zoom: 1 },
  }
}

export function screenToBoardDelta(dx, dy, zoom) {
  const z = Number(zoom) || 1
  return { dx: dx / z, dy: dy / z }
}

export function boardPointFromClient({ clientX, clientY, rect, viewport }) {
  const v = normalizeViewport(viewport)
  return {
    x: (clientX - rect.left - v.x) / v.zoom,
    y: (clientY - rect.top - v.y) / v.zoom,
  }
}

export function buildOpsLabNotifyCopy({
  event = 'board_created',
  boardTitle = 'Ops Lab board',
  boardKind = 'brainstorm',
  boardId = '',
  actorName = 'Someone',
} = {}) {
  const kindLabel = boardKindMeta(boardKind).label
  const id = String(boardId || Date.now())
  if (event === 'complaint_linked') {
    return {
      kind: 'ops_lab.complaint_linked',
      title: `Complaint linked · ${kindLabel}`,
      body: `${actorName} linked a complaint on “${boardTitle}”. Review the solution board.`,
      url: `/operations/roadmap?board=${encodeURIComponent(id)}`,
      tag: `ops_lab:complaint:${id}`,
    }
  }
  if (event === 'board_updated') {
    return {
      kind: 'ops_lab.board_updated',
      title: `${kindLabel} updated`,
      body: `${actorName} updated “${boardTitle}”.`,
      url: `/operations/roadmap?board=${encodeURIComponent(id)}`,
      tag: `ops_lab:update:${id}:${Date.now()}`,
    }
  }
  return {
    kind: 'ops_lab.board_created',
    title: `New ${kindLabel.toLowerCase()}`,
    body: `${actorName} opened “${boardTitle}” in Ops Lab.`,
    url: `/operations/roadmap?board=${encodeURIComponent(id)}`,
    tag: `ops_lab:board:${id}`,
  }
}

/** Filter/sort board library for leaders. */
export function filterBoards(boards = [], { kind = 'all', status = 'all', q = '' } = {}) {
  const needle = String(q || '').trim().toLowerCase()
  return (boards || [])
    .filter((b) => (kind === 'all' ? true : b.board_kind === kind))
    .filter((b) => (status === 'all' ? true : b.status === status))
    .filter((b) => {
      if (!needle) return true
      const hay = `${b.title || ''} ${b.description || ''}`.toLowerCase()
      return hay.includes(needle)
    })
}

export function itemLinkLabel(item) {
  const meta = item?.meta || {}
  if (item?.kind === 'complaint_link') {
    return meta.complaint_label || meta.respondent_label || 'Open complaint'
  }
  if (item?.kind === 'form_link') {
    return meta.form_label || meta.url || 'Open form'
  }
  return null
}
