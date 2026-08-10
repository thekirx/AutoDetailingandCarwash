/**
 * Mark due ceramic / PPF paint-maintenance rows and send push/SMS reminders.
 * Run on a schedule: node scripts/notify-maintenance-due.mjs
 *
 * Dedup: only status=scheduled is sent. After send → notified (cron will not re-send
 * until Paint Maintenance resets status to scheduled with a new next_due_at).
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { busybeeSendSms } from '../server/busybee.mjs'
import { sendWebPushToUsers } from '../server/webPush.mjs'
import { renderNotificationMessage } from '../src/lib/notificationCopy.js'
import { PAINT_MAINTENANCE_SLUG } from '../src/lib/paintMaintenance.js'

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
  .select(
    'id, plate_number, customer_name, customer_phone, customer_id, next_due_at, status, service_slug, branch_slug, program_key, last_notified_at',
  )
  .lte('next_due_at', today)
  .eq('status', 'scheduled')
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
 * Paint program prefers paint-maintenance rules, then the install slug on the row.
 */
function settingFor(serviceSlug, branchSlug, programKey) {
  const lookupSlugs = []
  if (programKey === 'paint_maintenance' || String(serviceSlug).includes('ceramic') || String(serviceSlug).includes('paint-protection')) {
    lookupSlugs.push(PAINT_MAINTENANCE_SLUG)
  }
  lookupSlugs.push(String(serviceSlug || '').toLowerCase())

  const rows = settings || []
  for (const slug of lookupSlugs) {
    const svc = serviceBySlug.get(slug)
    const svcId = svc?.id || null
    if (!svcId && slug !== String(serviceSlug || '').toLowerCase()) continue
    const match =
      rows.find((s) => s.scope === 'per_service_branch' && s.service_id === svcId && s.branch_slug === branchSlug) ||
      rows.find((s) => s.scope === 'per_service' && s.service_id === svcId)
    if (match) return match
  }
  return (
    rows.find((s) => s.scope === 'per_branch' && s.branch_slug === branchSlug) ||
    rows.find((s) => s.scope === 'whole') ||
    { channel: 'push', title: null, message: null }
  )
}

let sentCount = 0
let failedCount = 0

for (const row of data || []) {
  const setting = settingFor(row.service_slug, row.branch_slug, row.program_key)
  const channel = setting.channel || 'push'
  const svc =
    serviceBySlug.get(PAINT_MAINTENANCE_SLUG) ||
    serviceBySlug.get(String(row.service_slug || '').toLowerCase())
  const title =
    String(setting.title || '').trim() || 'Hakum Auto Care: Time for paint maintenance'
  const message = renderNotificationMessage(setting.message, {
    plate: row.plate_number,
    service: svc?.name || 'Paint Maintenance',
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
          tag: `maintenance-${row.id}-${row.next_due_at}`,
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
    .eq('status', 'scheduled')
  if (upErr) console.error(row.id, upErr.message)
  else console.log('notified', row.plate_number, row.next_due_at, row.customer_phone || '(no phone)')
}

console.log(`Done. sent=${sentCount} failed=${failedCount}`)
