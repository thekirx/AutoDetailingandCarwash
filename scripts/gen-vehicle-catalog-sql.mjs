import { writeFileSync } from 'node:fs'
import { flattenVehicleCatalog } from '../src/lib/phVehicles.js'

const rows = flattenVehicleCatalog()
const vals = rows
  .map((r) => `('${r.make.replace(/'/g, "''")}', '${r.model.replace(/'/g, "''")}', ${r.sort_order})`)
  .join(',\n')

const sql = `-- PH vehicle catalog full seed (1990s–present common market models)
-- Generated from src/lib/phVehicles.js · ${rows.length} make/model pairs

insert into public.vehicle_catalog (make, model, sort_order) values
${vals}
on conflict (make, model) do update
set sort_order = excluded.sort_order,
    is_active = true,
    updated_at = now();
`

writeFileSync(new URL('../supabase/migrations/20260727030000_vehicle_catalog_ph_full.sql', import.meta.url), sql)
console.log(`Wrote ${rows.length} pairs`)
