/**
 * Set shop-wide SMS kill switch (app_settings.sms_notifications).
 * Usage: node scripts/set-sms-shop-gate.mjs off|on
 */
import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { smsNotificationsEnabledFromSetting } from '../src/lib/smsNotificationsToggle.js'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i)
    const v = line.slice(i + 1)
    if (!process.env[k]) process.env[k] = v
  }
}

const arg = String(process.argv[2] || '').toLowerCase()
const enabled = arg === 'on' || arg === 'true' || arg === '1'
if (!['on', 'off', 'true', 'false', '1', '0'].includes(arg)) {
  console.error('Usage: node scripts/set-sms-shop-gate.mjs off|on')
  process.exit(2)
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error(JSON.stringify({ ok: false, reason: 'missing_supabase_service_credentials' }))
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const { data, error } = await db
  .from('app_settings')
  .upsert(
    {
      key: 'sms_notifications',
      value: { enabled },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  )
  .select('key, value')
  .maybeSingle()

if (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }))
  process.exit(1)
}

const shopOn = smsNotificationsEnabledFromSetting(data?.value)
console.log(JSON.stringify({ ok: true, requested: enabled ? 'on' : 'off', shopOn, value: data?.value }, null, 2))
process.exit(shopOn === enabled ? 0 : 1)
