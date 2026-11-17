import { OPS_LOGIN_ROLES } from '../auth/permissions.js'
import { notificationHref } from './notificationUrl.js'

const MAX_SEEN_IDS = 150

/** Default app home fallback for inbox/toast links based on profile role. */
export function defaultNotificationHome(role = '') {
  return role && OPS_LOGIN_ROLES.includes(role) ? '/operations' : '/account'
}

/** Track shown notification IDs per browser session so realtime reconnects never double-toast. */
export function rememberNotificationId(seenSet, id) {
  if (!id || !(seenSet instanceof Set)) return false
  if (seenSet.has(id)) return false
  if (seenSet.size >= MAX_SEEN_IDS) {
    const first = seenSet.values().next().value
    if (first !== undefined) seenSet.delete(first)
  }
  seenSet.add(id)
  return true
}

export function buildForegroundToastData(row, role = '') {
  if (!row || !row.title) return null
  const fallback = defaultNotificationHome(role)
  const href = notificationHref(row.url, fallback, row.kind || '')
  return {
    id: row.id || undefined,
    title: String(row.title).trim(),
    body: String(row.body || '').trim(),
    href,
    kind: row.kind || 'system',
  }
}

/** Gentle two-note Web Audio chime when active tab allows audio; safe no-op otherwise. */
export function playGentleNotificationChime() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (document.visibilityState !== 'visible') return
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    if (ctx.state === 'suspended') {
      void ctx.close().catch(() => {})
      return
    }
    const now = ctx.currentTime
    ;[587.33, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + idx * 0.08)
      gain.gain.setValueAtTime(0.001, now + idx * 0.08)
      gain.gain.exponentialRampToValueAtTime(0.045, now + idx * 0.08 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.18)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + idx * 0.08)
      osc.stop(now + idx * 0.08 + 0.19)
    })
    window.setTimeout(() => {
      void ctx.close().catch(() => {})
    }, 350)
  } catch {
    /* blocked by autoplay policy — safe to ignore */
  }
}
