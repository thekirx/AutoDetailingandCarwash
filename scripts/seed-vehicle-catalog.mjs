/**
 * Seed vehicle_catalog from PH_VEHICLE_CATALOG (service role).
 * Usage: node scripts/seed-vehicle-catalog.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { flattenVehicleCatalog } from '../src/lib/phVehicles.js'

function loadEnv() {
  try {
    const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (!m || process.env[m[1]]) continue
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* optional */
  }
}

loadEnv()

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
const rows = flattenVehicleCatalog()

const chunk = 80
let upserted = 0
for (let i = 0; i < rows.length; i += chunk) {
  const slice = rows.slice(i, i + chunk).map((r) => ({
    make: r.make,
    model: r.model,
    sort_order: r.sort_order,
    is_active: true,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await admin
    .from('vehicle_catalog')
    .upsert(slice, { onConflict: 'make,model', count: 'exact' })
  if (error) {
    console.error(error.message)
    process.exit(1)
  }
  upserted += slice.length
  console.log(`upserted ${upserted}/${rows.length}`)
}

const { count } = await admin.from('vehicle_catalog').select('id', { count: 'exact', head: true })
console.log(`seed-vehicle-catalog: PASS (${count} rows in table)`)
