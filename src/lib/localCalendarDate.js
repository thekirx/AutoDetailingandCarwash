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
