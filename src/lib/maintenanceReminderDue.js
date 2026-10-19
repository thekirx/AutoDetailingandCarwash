import { daysUntilDue, manilaTodayDateOnly } from './paintMaintenance.js'

/** Monthly texts start a month before the due date and continue until the visit. */
export function maintenanceReminderDue(row, today = manilaTodayDateOnly(), { leadDays = 30, intervalDays = 30 } = {}) {
  const status = String(row?.status || '')
  if (status !== 'scheduled' && status !== 'notified') return false
  const until = daysUntilDue(row?.next_due_at, today)
  if (until == null || until > leadDays) return false
  if (!row?.last_notified_at) return true
  const lastDay = manilaTodayDateOnly(new Date(row.last_notified_at))
  const since = daysUntilDue(today, lastDay)
  return since != null && since >= intervalDays
}
