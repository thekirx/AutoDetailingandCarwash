/** Rate-your-last-visit waits until an hour after the visit's last line finishes. */

export const REVIEW_DELAY_MS = 60 * 60 * 1000

const OPEN_STATUSES = new Set([
  'pending',
  'confirmed',
  'waiting',
  'in_progress',
  'final_checking',
  'for_releasing',
  'redo',
])

export function workFinishedMs(row) {
  const pay = row?.for_payment_at ? new Date(row.for_payment_at).getTime() : NaN
  if (Number.isFinite(pay)) return pay
  const done = row?.completed_at ? new Date(row.completed_at).getTime() : NaN
  return Number.isFinite(done) ? done : null
}

function visitKey(row) {
  return row?.visit_group_id || row?.id || null
}

function groupVisits(history = []) {
  const groups = new Map()
  for (const row of history || []) {
    const key = visitKey(row)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  return [...groups.values()]
}

function finishedGroup(rows) {
  if (rows.some((row) => OPEN_STATUSES.has(String(row?.status || '')))) return null
  let finish = null
  let rep = null
  for (const row of rows) {
    const ms = workFinishedMs(row)
    if (ms == null) return null
    if (finish == null || ms > finish) {
      finish = ms
      rep = row
    }
  }
  if (finish == null || !rep) return null
  return { finish, row: rep }
}

function latestFinishedGroup(history = []) {
  let best = null
  for (const rows of groupVisits(history)) {
    const group = finishedGroup(rows)
    if (!group) continue
    if (!best || group.finish > best.finish) best = group
  }
  return best
}

/** Latest visit whose every line has finished, even inside the review hour. */
export function latestFinishedVisit(history = []) {
  return latestFinishedGroup(history)?.row || null
}

/**
 * Latest finished visit, only after REVIEW_DELAY_MS from its last line.
 * A newer visit still inside the hour hides older visits.
 */
export function latestReviewableVisit(history = [], now = Date.now()) {
  const latest = latestFinishedGroup(history)
  if (!latest) return null
  if (now - latest.finish < REVIEW_DELAY_MS) return null
  return latest.row
}

/** Milliseconds until the latest finished visit can be rated. Null when there is nothing to wait for. */
export function reviewDelayRemainingMs(history = [], now = Date.now()) {
  const latest = latestFinishedGroup(history)
  if (!latest) return null
  const remaining = latest.finish + REVIEW_DELAY_MS - now
  return remaining > 0 ? remaining : null
}
