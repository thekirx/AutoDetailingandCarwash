/**
 * Live parity check: anon-readable vehicle_catalog vs seed catalog size.
 * Run: node --input-type=module scripts/verify-vehicle-catalog-parity.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { flattenVehicleCatalog, PH_VEHICLE_MAKES } from '../src/lib/phVehicles.js'
import { catalogMakes, catalogRowsToMap } from '../src/lib/vehicleCatalog.js'

const env = {}
for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (!m) continue
  env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const { data, error } = await sb
  .from('vehicle_catalog')
  .select('make, model')
  .eq('is_active', true)
  .order('make')
  .order('sort_order')

if (error) {
  console.error(error.message)
  process.exit(1)
}

const map = catalogRowsToMap(data)
const makes = catalogMakes(map)
const flat = flattenVehicleCatalog()

console.log(
  JSON.stringify(
    {
      anon_rows: data.length,
      anon_makes: makes.length,
      static_makes: PH_VEHICLE_MAKES.length,
      static_pairs: flat.length,
      makes_match_seed: makes.length === PH_VEHICLE_MAKES.length && makes.every((m) => PH_VEHICLE_MAKES.includes(m)),
      sample: makes.slice(0, 6),
      toyota_models: (map.Toyota || []).slice(0, 5),
    },
    null,
    2,
  ),
)

if (data.length < 400 || makes.length < 35) {
  console.error('FAIL: catalog under-populated for public pickers')
  process.exit(1)
}
console.log('verify-vehicle-catalog-parity: PASS')
