/** Task list filters + flatten. Interface for Planner Tasks / Review. */

export function flattenPlannerCards(board) {
  const lists = [...(board?.plan_lists || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  const rows = []
  for (const list of lists) {
    const cards = [...(list.plan_cards || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    for (const card of cards) {
      rows.push({
        ...card,
        list_id: list.id,
        list_title: list.title,
      })
    }
  }
  return rows
}

function assigneeStatus(card) {
  const rows = card.plan_card_assignees || []
  if (rows.some((a) => a.status === 'for_review')) return 'for_review'
  if (rows.some((a) => a.status === 'in_progress')) return 'in_progress'
  if (rows.length && rows.every((a) => a.status === 'done')) return 'done'
  return 'todo'
}

function listBucket(title) {
  const t = String(title || '').toLowerCase()
  if (/done|complete/.test(t)) return 'done'
  if (/progress|doing|active/.test(t)) return 'in_progress'
  return 'upcoming'
}

function isAll(value) {
  return !value || value === 'all' || value === 'any'
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function filterPlannerCards(cards, filters = {}) {
  const q = String(filters.q || '').trim().toLowerCase()
  const status = filters.status || 'all'
  const categoryId = filters.categoryId || 'all'
  const assigneeId = filters.assigneeId || 'all'
  const due = filters.due || 'all'
  const assignedOnly = Boolean(filters.assignedOnly)
  const viewerId = filters.viewerId || filters.staffId || ''
  const now = filters.now ? new Date(filters.now) : new Date()
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  return (Array.isArray(cards) ? cards : []).filter((card) => {
    if (assignedOnly && viewerId) {
      const mine = (card.plan_card_assignees || []).some((a) => a.staff_id === viewerId)
      if (!mine) return false
    }
    if (q) {
      const hay = `${card.title || ''} ${card.description || ''} ${card.list_title || ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (!isAll(categoryId)) {
      if (categoryId === 'none') {
        if (card.category_id) return false
      } else if (String(card.category_id || '') !== categoryId) return false
    }
    if (!isAll(assigneeId)) {
      const rows = card.plan_card_assignees || []
      if (assigneeId === 'unassigned') {
        if (rows.length) return false
      } else if (!rows.some((a) => a.staff_id === assigneeId)) return false
    }
    if (!isAll(status)) {
      const st = assigneeStatus(card)
      if (status === 'todo' || status === 'for_review') {
        if (st !== status) return false
      } else if (status === 'upcoming' || status === 'in_progress' || status === 'done') {
        if (listBucket(card.list_title) !== status && st !== status) return false
      }
    }
    if (due === 'none' && card.due_at) return false
    if (due === 'overdue') {
      if (!card.due_at || new Date(card.due_at) >= now) return false
    }
    if (due === 'today') {
      if (!card.due_at || !sameDay(new Date(card.due_at), now)) return false
    }
    if (due === 'week') {
      if (!card.due_at) return false
      const d = new Date(card.due_at)
      if (d < now || d > weekEnd) return false
    }
    return true
  })
}

export function reviewQueue(cards) {
  const out = []
  for (const card of Array.isArray(cards) ? cards : []) {
    for (const a of card.plan_card_assignees || []) {
      if (a.status === 'for_review') out.push({ card, assignee: a })
    }
  }
  return out
}

export function reviewItemsFromBoard(board) {
  const out = []
  for (const card of flattenPlannerCards(board)) {
    for (const a of card.plan_card_assignees || []) {
      if (a.status === 'for_review') out.push({ card, assignee: a })
    }
  }
  return out
}

/** One round-trip shape: assignee rows with nested card + list. */
export function cardsFromAssigneeRows(rows) {
  const byCard = new Map()
  for (const row of Array.isArray(rows) ? rows : []) {
    const card = row.plan_cards
    if (!card?.id) continue
    const assignee = { ...row }
    delete assignee.plan_cards
    const existing = byCard.get(card.id)
    if (existing) {
      existing.plan_card_assignees.push(assignee)
      continue
    }
    byCard.set(card.id, {
      ...card,
      list_id: card.list_id || card.plan_lists?.id,
      list_title: card.plan_lists?.title || '',
      plan_card_assignees: [assignee],
    })
  }
  return [...byCard.values()]
}

export function reviewItemsFromAssigneeRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.status === 'for_review' && row.plan_cards)
    .map((row) => ({
      card: {
        ...row.plan_cards,
        list_id: row.plan_cards.list_id || row.plan_cards.plan_lists?.id,
        list_title: row.plan_cards.plan_lists?.title || '',
      },
      assignee: row,
    }))
}

export function planProofObjectPath(uid, cardId, fileName, now = Date.now()) {
  const safe = String(fileName || 'proof').replace(/[^\w.-]+/g, '_')
  return `${uid}/${cardId}/${now}-${safe}`
}

export function isHttpProofUrl(value) {
  return /^https?:\/\//i.test(String(value || ''))
}

export function allowedReviewAssigneePatch(current, action) {
  if (!current || current.status !== 'for_review') return null
  if (action === 'accept') {
    return { status: 'done', reviewed_at: new Date().toISOString() }
  }
  if (action === 'return') {
    return { status: 'in_progress', reviewed_at: null }
  }
  return null
}
