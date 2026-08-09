/**
 * Import historical ceramic coating bookings into vehicle_maintenance_schedules.
 *
 * CSV columns (header required):
 *   plate,customer_name,customer_phone,coated_at,branch,last_maintenance_at,notes
 *
 * coated_at / last_maintenance_at: YYYY-MM-DD
 * next_due_at = (last_maintenance_at || coated_at) + 6 months
 *
 * Run: node scripts/import-ceramic-coatings.mjs path/to/file.csv
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
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

function addMonths(isoDate, months) {
  const [y, m, d] = String(isoDate).split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCMonth(dt.getUTCMonth() + months)
  return dt.toISOString().slice(0, 10)
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim())
    const row = {}
    headers.forEach((h, i) => {
      row[h] = cols[i] || ''
    })
    return row
  })
}

const file = process.argv[2]
if (!file) {
  console.error('Usage: node scripts/import-ceramic-coatings.mjs <file.csv>')
  process.exit(1)
}

const rows = parseCsv(readFileSync(resolve(file), 'utf8'))
let ok = 0
for (const row of rows) {
  const coated = row.coated_at || row.coating_date
  if (!coated || !row.plate) {
    console.warn('skip row (need plate + coated_at)', row)
    continue
  }
  const last = row.last_maintenance_at || coated
  const next = addMonths(last, 6)
  const { error } = await admin.from('vehicle_maintenance_schedules').insert({
    plate_number: String(row.plate).toUpperCase(),
    customer_name: row.customer_name || null,
    customer_phone: row.customer_phone || null,
    service_slug: 'ceramic-coating',
    coated_at: coated,
    last_maintenance_at: row.last_maintenance_at || null,
    next_due_at: next,
    branch_slug: row.branch || null,
    notes: row.notes || 'Imported ceramic coating history',
    status: 'scheduled',
  })
  if (error) {
    console.error('fail', row.plate, error.message)
    continue
  }
  ok += 1
  console.log('imported', row.plate, 'next due', next)
}
console.log('Done.', ok, '/', rows.length)
