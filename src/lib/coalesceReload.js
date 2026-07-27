/**
 * Coalesce bursty realtime events into one reload (critical for 50+ concurrent floor users).
 * Debounces, then runs at most one load at a time; queues a follow-up if events arrive mid-flight.
 */
export function createCoalescedReload(fn, debounceMs = 400) {
  let timer = null
  let running = null
  let queued = false

  const invoke = () => {
    if (running) {
      queued = true
      return running
    }
    running = Promise.resolve()
      .then(() => fn())
      .catch(() => {})
      .finally(() => {
        running = null
        if (queued) {
          queued = false
          schedule()
        }
      })
    return running
  }

  const schedule = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      invoke()
    }, debounceMs)
  }

  const trigger = () => {
    schedule()
  }

  trigger.flush = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    return invoke()
  }

  trigger.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
    queued = false
  }

  return trigger
}

/** Tiny in-memory TTL cache for shared read-mostly catalogs (branches, services, settings). */
export function createTtlCache(ttlMs = 60_000) {
  let entry = null
  return {
    get() {
      if (!entry) return undefined
      if (Date.now() > entry.exp) {
        entry = null
        return undefined
      }
      return entry.value
    },
    set(value) {
      entry = { value, exp: Date.now() + ttlMs }
      return value
    },
    clear() {
      entry = null
    },
  }
}
