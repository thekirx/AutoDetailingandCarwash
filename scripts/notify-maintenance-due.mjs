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
import { sendPaintMaintenanceReminder } from '../server/paintMaintenanceNotify.mjs'

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
const servicesBySlug = new Map((services || []).map((s) => [String(s.slug || '').toLowerCase(), s]))

let sentCount = 0
let failedCount = 0

for (const row of data || []) {
  const result = await sendPaintMaintenanceReminder({
    db: admin,
    row,
    settings: settings || [],
    servicesBySlug,
    force: false,
    markNotified: true,
  })
  if (!result.ok) {
    failedCount += 1
    console.error(row.id, result.error)
    continue
  }
  if (result.push?.sent) sentCount += result.push.sent
  if (result.sms?.ok) sentCount += 1
  if (result.push?.failed) failedCount += result.push.failed
  if (result.sms?.ok === false) failedCount += 1
  console.log('notified', row.plate_number, row.next_due_at, row.customer_phone || '(no phone)')
}

console.log(`Done. sent=${sentCount} failed=${failedCount}`)
