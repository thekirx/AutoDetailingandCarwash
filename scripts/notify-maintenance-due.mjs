/**
 * Mark due ceramic / PPF paint-maintenance rows and send push/SMS reminders.
 * The daily cron calls the same runMaintenanceReminders function.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { runMaintenanceReminders } from '../server/maintenanceReminders.mjs'

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
const result = await runMaintenanceReminders(admin)
console.log(`Done. due=${result.due} sent=${result.sent} failed=${result.failed}`)
