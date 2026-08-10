/**
 * Mark due ceramic / PPF maintenance rows and send push/SMS reminders.
 * Run on a schedule (Render cron / GitHub Action): node scripts/notify-maintenance-due.mjs
 *
 * Reminder basis: next_due_at = (last_maintenance_at || coated_at) + frequency_months.
 * Channel / custom copy / scope come from notification_settings.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { busybeeSendSms } from '../server/busybee.mjs'
import { sendWebPushToUsers } from '../server/webPush.mjs'
import { renderNotificationMessage } from '../src/lib/notificationCopy.js'

const envPath = resolve(process.cwd(), '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const k = trimmed.slice(0, eq).trim()
    const v = trimmed.slice(eq + 1).trim()
    if (!process.env[k]) process.env[k] = v
  }
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing env')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

const { data, error } = await admin
  .from('vehicle_maintenance_schedules')
  .select('id, plate_number, customer_name, customer_phone, customer_id, next_due_at, status, service_slug, branch_slug')
  .lte('next_due_at', today)
  .in('status', ['scheduled', 'notified'])
  .limit(200)

if (error) {
  console.error(error.message)
  process.exit(1)
}

console.log('Due maintenance rows:', (data || []).length)

const { data: settings } = await admin
  .from('notification_settings')
  .select('scope, service_id, branch_slug, channel, frequency_months, enabled, title, message')
  .eq('enabled', true)

const { data: services } = await admin.from('services').select('id, slug, name')
const serviceBySlug = new Map((services || []).map((s) => [String(s.slug || '').toLowerCase(), s]))

/**
 * Most specific matching rule wins:
 * per_service_branch > per_service > per_branch > whole
 */
function settingFor(serviceSlug, branchSlug) {
  const svc = serviceBySlug.get(String(serviceSlug || '').toLowerCase())
  const svcId = svc?.id || null
  const rows = settings || []
  const match =
    rows.find((s) => s.scope === 'per_service_branch' && s.service_id === svcId && s.branch_slug === branchSlug) ||
    rows.find((s) => s.scope === 'per_service' && s.service_id === svcId) ||
    rows.find((s) => s.scope === 'per_branch' && s.branch_slug === branchSlug) ||
    rows.find((s) => s.scope === 'whole') ||
    null
  return match || { channel: 'push', title: null, message: null }
}

let sentCount = 0
let failedCount = 0

for (const row of data || []) {
  const setting = settingFor(row.service_slug, row.branch_slug)
  const channel = setting.channel || 'push'
  const svc = serviceBySlug.get(String(row.service_slug || '').toLowerCase())
  const title =
    String(setting.title || '').trim() || 'Hakum Auto Care: Time for your maintenance'
  const message = renderNotificationMessage(setting.message, {
    plate: row.plate_number,
    service: svc?.name || row.service_slug || 'detailing',
    name: row.customer_name,
    branch: row.branch_slug,
  })

  if (channel === 'push' || channel === 'both') {
    if (row.customer_id) {
      try {
        const result = await sendWebPushToUsers({
          userIds: [row.customer_id],
          title,
          body: message,
          url: '/book',
          tag: `maintenance-${row.id}`,
          kind: 'maintenance_reminder',
        })
        sentCount += result?.sent || 0
        failedCount += result?.failed || 0
      } catch (err) {
        console.error('[maintenance] push failed', row.id, err?.message || err)
        failedCount += 1
      }
    }
  }

  if (channel === 'sms' || channel === 'both') {
    if (row.customer_phone) {
      try {
        await busybeeSendSms({ phone: row.customer_phone, message: `${title}\n${message}`.slice(0, 160) })
        sentCount += 1
      } catch (err) {
        console.error('[maintenance] sms failed', row.id, err?.message || err)
        failedCount += 1
      }
    }
  }

  const { error: upErr } = await admin
    .from('vehicle_maintenance_schedules')
    .update({ status: 'notified', last_notified_at: new Date().toISOString() })
    .eq('id', row.id)
  if (upErr) console.error(row.id, upErr.message)
  else console.log('notified', row.plate_number, row.next_due_at, row.customer_phone || '(no phone)')
}

console.log(`Done. sent=${sentCount} failed=${failedCount}`)
