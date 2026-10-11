/**
 * The landing url on a broadcast or a push is free text typed by a staff member
 * into the "Tap URL" field. `/api/notification-broadcast` and `/api/push` accept
 * it verbatim and then persist it — into `notification_broadcasts`, and into
 * `user_notifications` for the inbox.
 *
 * Both consumers already refuse to leave the app (`notificationHref` for the
 * inbox link, the `notificationclick` handler for the tap), so this is not the
 * boundary that keeps a user safe. It exists because the value is *stored*: a
 * future surface that renders a broadcast-history row with a plain href would
 * otherwise reopen a hole that is closed in two other places today.
 *
 * Rule: an internal path, or the fallback. Same-origin absolute urls are allowed
 * through as paths because every legitimate caller in this repo already sends a
 * path, and guessing the public origin server-side is how this goes wrong.
 */
export function safeNotificationPath(raw, fallback = '/account') {
  const fb = String(fallback || '/account').trim() || '/account'
  const value = String(raw ?? '').trim()
  if (!value || value === '/') return fb
  // `//host` and `/\host` are protocol-relative: no scheme to filter on, yet a
  // browser resolves both to a foreign origin.
  if (/^\/[/\\]/.test(value)) return fb
  if (!value.startsWith('/')) return fb
  return value
}