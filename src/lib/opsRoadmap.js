/**
 * Ops roadmap board — sticky notes / headings for SA · ASA · BA · Operations Lead.
 * Positions are board-space pixels; viewport is { x, y, zoom }.
 */

export const ROADMAP_COLORS = Object.freeze([
  { value: 'amber', label: 'Amber', bg: '#fef3c7', border: '#f59e0b', ink: '#78350f' },
  { value: 'sky', label: 'Sky', bg: '#e0f2fe', border: '#0ea5e9', ink: '#0c4a6e' },
  { value: 'mint', label: 'Mint', bg: '#d1fae5', border: '#10b981', ink: '#064e3b' },
  { value: 'rose', label: 'Rose', bg: '#ffe4e6', border: '#f43f5e', ink: '#881337' },
  { value: 'violet', label: 'Violet', bg: '#ede9fe', border: '#8b5cf6', ink: '#4c1d95' },
  { value: 'slate', label: 'Slate', bg: '#f1f5f9', border: '#64748b', ink: '#0f172a' },
])

export const ROADMAP_KINDS = Object.freeze([
  { value: 'note', label: 'Sticky', defaultW: 220, defaultH: 160 },
  { value: 'heading', label: 'Heading', defaultW: 320, defaultH: 72 },
  { value: 'frame', label: 'Frame', defaultW: 420, defaultH: 280 },
])

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
  color = 'amber',
  x = 120,
  y = 120,
  title = '',
  body = '',
  createdBy = null,
} = {}) {
  const meta = ROADMAP_KINDS.find((k) => k.value === kind) || ROADMAP_KINDS[0]
  return {
    board_id: boardId,
    kind: meta.value,
    title: title || (meta.value === 'heading' ? 'New heading' : ''),
    body: body || (meta.value === 'note' ? 'Idea…' : ''),
    color,
    x: Math.round(Number(x) || 120),
    y: Math.round(Number(y) || 120),
    w: meta.defaultW,
    h: meta.defaultH,
    z_index: Date.now() % 1_000_000,
    meta: {},
    created_by: createdBy,
    updated_by: createdBy,
  }
}

/** Map screen delta to board delta given zoom. */
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
