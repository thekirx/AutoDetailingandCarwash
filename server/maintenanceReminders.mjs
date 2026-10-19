import { addDaysISO, manilaTodayISO } from '../src/lib/bookingLead.js'
import { maintenanceReminderDue } from '../src/lib/maintenanceReminderDue.js'
import { sendPaintMaintenanceReminder } from './paintMaintenanceNotify.mjs'

/** Monthly paint-maintenance reminders. The script and the cron call this. */
export async function runMaintenanceReminders(admin, now = new Date()) {
  const today = manilaTodayISO(now)
  const horizon = addDaysISO(today, 30)
  const { data, error } = await admin
    .from('vehicle_maintenance_schedules')
    .select(
      'id, plate_number, customer_name, customer_phone, customer_id, next_due_at, status, service_slug, branch_slug, program_key, last_notified_at',
    )
    .lte('next_due_at', horizon)
    .in('status', ['scheduled', 'notified'])
    .limit(200)
  if (error) throw new Error(error.message)

  const { data: settings } = await admin
    .from('notification_settings')
    .select('scope, service_id, branch_slug, channel, frequency_months, enabled, title, message')
    .eq('enabled', true)
  const { data: services } = await admin.from('services').select('id, slug, name')
  const servicesBySlug = new Map((services || []).map((row) => [String(row.slug || '').toLowerCase(), row]))

  const dueRows = (data || []).filter((item) => maintenanceReminderDue(item, today))
  let sent = 0
  let failed = 0
  for (const row of dueRows) {
    const result = await sendPaintMaintenanceReminder({
      db: admin,
      row,
      settings: settings || [],
      servicesBySlug,
      force: false,
      markNotified: true,
    })
    if (!result.ok) {
      failed += 1
      continue
    }
    if (result.push?.sent) sent += result.push.sent
    if (result.sms?.ok) sent += 1
    if (result.push?.failed) failed += result.push.failed
    if (result.sms?.ok === false) failed += 1
  }
  return { due: dueRows.length, sent, failed }
}
