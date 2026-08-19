/** Ops calendar dates — Philippines floor, not UTC. */

export const OPS_TIME_ZONE = 'Asia/Manila'

/**
 * Local calendar YYYY-MM-DD in the ops timezone (default Asia/Manila).
 * Avoids UTC slice bugs where PH morning maps to the previous day.
 */
export function getLocalCalendarDate(anchor = new Date(), timeZone = OPS_TIME_ZONE) {
  const d = anchor instanceof Date ? anchor : new Date(anchor)
  if (Number.isNaN(d.getTime())) {
    throw new TypeError('getLocalCalendarDate requires a valid date')
  }
  // en-CA yields ISO-like YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/**
 * datetime-local value in ops timezone. Avoids UTC `.slice(0, 16)` shifting PH deadlines.
 * ponytail: Asia/Manila is UTC+8 year-round; if ops ever leaves +08, use a TZ lib.
 */
export function isoToDatetimeLocalValue(iso, timeZone = OPS_TIME_ZONE) {
  const d = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const get = (type) => parts.find((p) => p.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

export function datetimeLocalToIso(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(value || ''))
  if (!m) return null
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+08:00`)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}
