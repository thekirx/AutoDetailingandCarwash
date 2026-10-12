/**
 * Presentation-only helpers for the Daylight time clock. They read the
 * attendance row the page already loads; they never fetch or decide pay.
 */

function timeLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })
}

const STATUS_WORD = { present: 'On time', late: 'Late', absent: 'Absent' }

/** What the clock card says, and which button leads. */
export function describeClock(today) {
  const status = today?.status || null
  const inAt = today?.checked_in_at || null
  const outAt = today?.checked_out_at || null
  if (inAt && outAt) {
    return {
      state: 'done',
      title: "You've clocked out",
      detail: `In ${timeLabel(inAt)} · out ${timeLabel(outAt)}`,
      status: STATUS_WORD[status] || null,
      primary: null,
    }
  }
  if (inAt) {
    return {
      state: 'in',
      title: "You're clocked in",
      detail: `Since ${timeLabel(inAt)}`,
      status: STATUS_WORD[status] || null,
      primary: 'out',
    }
  }
  if (status === 'absent') {
    return { state: 'absent', title: 'Marked absent today', detail: 'Ask your team lead if this is wrong.', status: 'Absent', primary: 'in' }
  }
  return {
    state: 'out',
    title: "You're not clocked in",
    detail: 'Tap the button when you arrive at the branch.',
    status: null,
    primary: 'in',
  }
}

const DAY = new Intl.DateTimeFormat('en-PH', { weekday: 'short', timeZone: 'UTC' })

/** One cell per date in the loaded period for this person: on time, late, absent or empty. */
export function myWeek(attendance = [], dates = [], staffId) {
  if (!staffId) return []
  const mine = new Map((attendance || []).filter((r) => r.staff_id === staffId).map((r) => [r.attendance_date, r.status]))
  return (dates || []).map((date) => ({
    date,
    day: DAY.format(new Date(`${date}T00:00:00Z`)),
    status: mine.get(date) || null,
  }))
}
