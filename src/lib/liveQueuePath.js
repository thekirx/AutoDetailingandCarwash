/** In-app customer queue. Public kiosk/TV stay on /queue/:slug. */
export const CUSTOMER_QUEUE_PATH = '/account/queue'

/** Poll safe public_queue_* views only. Never Realtime WAL on bookings (PII). */
export const PUBLIC_QUEUE_POLL_MS = 8_000

/** Prefer branch slug when set; otherwise public branch picker. */
export function liveQueuePath(branchSlug) {
  const slug = String(branchSlug || '').trim()
  return slug ? `/queue/${encodeURIComponent(slug)}` : '/queue'
}

export function customerQueuePath(branchSlug) {
  const slug = String(branchSlug || '').trim()
  return slug ? `${CUSTOMER_QUEUE_PATH}?branch=${encodeURIComponent(slug)}` : CUSTOMER_QUEUE_PATH
}

export function queueCountsFromRow(row) {
  return {
    waiting: Number(row?.waiting_count || 0),
    in_progress: Number(row?.in_progress_count || 0),
    final_checking: Number(row?.final_checking_count || 0),
    total: Number(row?.total_active_count || 0),
  }
}

/** Homepage cards show every vehicle currently in the active service flow. */
export function branchQueueTotal(row) {
  return queueCountsFromRow(row).total
}
