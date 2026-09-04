/** Shared realtime fan-out: one channel per user, N React subscribers. */
let bellChannel = null
let bellUserId = null
const bellListeners = new Set()

function fanout() {
  for (const fn of [...bellListeners]) {
    try {
      fn()
    } catch {
      /* never break the socket for one listener */
    }
  }
}

/**
 * Subscribe to `user_notifications` changes for `userId`.
 * Safe to call from multiple mounts (bell + settings) — only one `postgres_changes` binding.
 * @param {string} userId
 * @param {() => void} listener
 * @param {{ channel: Function, removeChannel: Function }} client Supabase client (required; inject for tests)
 * @returns {() => void} unsubscribe
 */
export function subscribeUserNotificationRealtime(userId, listener, client) {
  if (!userId || typeof listener !== 'function' || !client) return () => {}

  bellListeners.add(listener)

  if (bellUserId && bellUserId !== userId) {
    if (bellChannel) void client.removeChannel(bellChannel)
    bellChannel = null
    bellUserId = null
  }

  bellUserId = userId

  // Claim the channel before .on/.subscribe so a second sync caller skips (Strict Mode / dual mounts).
  if (!bellChannel) {
    const ch = client.channel(`user-notifications-bell:${userId}`)
    bellChannel = ch
    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${userId}` },
      fanout,
    ).subscribe()
  }

  return () => {
    bellListeners.delete(listener)
    if (bellListeners.size === 0 && bellChannel) {
      void client.removeChannel(bellChannel)
      bellChannel = null
      bellUserId = null
    }
  }
}

/** Test seam — reset module state between cases. */
export function __resetUserNotificationRealtimeForTests() {
  bellChannel = null
  bellUserId = null
  bellListeners.clear()
}

export function __userNotificationRealtimeDebug() {
  return {
    userId: bellUserId,
    listenerCount: bellListeners.size,
    hasChannel: Boolean(bellChannel),
  }
}
