/** Display-only labels and grouping. Never changes a ticket or its stored status. */
export const DAYLIGHT_STAGES = [
  { key: 'waiting', label: 'Waiting', color: 'var(--stage-waiting)' },
  { key: 'in_progress', label: 'Washing', color: 'var(--stage-washing)' },
  { key: 'final_checking', label: 'Final check', color: 'var(--stage-check)' },
  { key: 'redo', label: 'Redo', color: 'var(--bad)' },
  { key: 'for_payment', label: 'To pay', color: 'var(--stage-payment)' },
  { key: 'completed', label: 'Done', color: 'var(--ok)', collapsed: true },
  { key: 'cancelled', label: 'Cancelled', color: 'var(--ink-3)', collapsed: true },
]
export function formatDaylightDuration(minutes) {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0 || minutes > 1440) return '—'
  return `${Math.round(minutes)} min`
}
export function groupDaylightQueue(tickets, yourMove) {
  const seen = new Set()
  const rows = tickets.filter(ticket => {
    if (!ticket.booking_id) return true
    if (seen.has(ticket.booking_id)) return false
    seen.add(ticket.booking_id)
    return true
  })
  const stages = yourMove
    ? [{ key: 'your_move', status: 'final_checking', label: 'Your move', color: 'var(--blue)' }, ...DAYLIGHT_STAGES.filter(s => s.key !== 'final_checking')]
    : DAYLIGHT_STAGES
  const groups = stages.map(stage => ({ ...stage, tickets: rows.filter(t => t.status === (stage.status || stage.key)) }))
  // Keep any legacy loaded status accessible instead of dropping a ticket.
  const known = new Set(DAYLIGHT_STAGES.map(s => s.key))
  for (const ticket of rows.filter(t => !known.has(t.status))) {
    let group = groups.find(g => g.key === ticket.status)
    if (!group) {
      group = { key: ticket.status, label: String(ticket.status).replace(/_/g, ' '), color: 'var(--ink-3)', tickets: [] }
      groups.push(group)
    }
    group.tickets.push(ticket)
  }
  return groups.filter(g => g.tickets.length)
}
export function queueSummary(tickets, availableStatuses) {
  return [
    ['waiting', 'Waiting'], ['in_progress', 'Washing'], ['final_checking', 'Check'], ['for_payment', 'To pay'],
  ].map(([key, label]) => ({ key, label, value: availableStatuses.includes(key) ? tickets.filter(t => t.status === key).length : null }))
}
export function longestWaitingMinutes(tickets, now = Date.now()) {
  let longest = null
  for (const ticket of tickets) {
    if (ticket.status !== 'waiting') continue
    const start = new Date(ticket.waiting_at || ticket.created_at).getTime()
    if (!Number.isFinite(start) || start > now) continue
    const minutes = Math.round((now - start) / 60000)
    longest = longest == null ? minutes : Math.max(longest, minutes)
  }
  return longest
}
