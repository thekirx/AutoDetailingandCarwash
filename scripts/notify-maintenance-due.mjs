/**
 * Mark due ceramic / PPF maintenance rows and (optionally) queue SMS via BusyBee later.
 * Run on a schedule (Render cron / GitHub Action): node scripts/notify-maintenance-due.mjs
 *
 * Reminder basis: next_due_at = (last_maintenance_at || coated_at) + 6 months.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const envPath = resolve(process.cwd(), '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
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
  .select('id, plate_number, customer_name, customer_phone, next_due_at, status, service_slug')
  .lte('next_due_at', today)
  .in('status', ['scheduled', 'notified'])
  .limit(200)

if (error) {
  console.error(error.message)
  process.exit(1)
}

console.log('Due maintenance rows:', (data || []).length)
for (const row of data || []) {
  // ponytail: mark notified; wire BusyBee SMS template when production SMS copy is approved
  const { error: upErr } = await admin
    .from('vehicle_maintenance_schedules')
    .update({ status: 'notified', last_notified_at: new Date().toISOString() })
    .eq('id', row.id)
  if (upErr) console.error(row.id, upErr.message)
  else console.log('notified', row.plate_number, row.next_due_at, row.customer_phone || '(no phone)')
}
console.log('Done.')
