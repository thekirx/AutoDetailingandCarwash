/** Diff live catalog vs seed and print UPDATE SQL batches. */
import { writeFileSync } from 'node:fs'
import { flattenVehicleCatalog } from '../src/lib/phVehicles.js'

const seed = flattenVehicleCatalog()
const seedMap = new Map(seed.map((r) => [`${r.make.toLowerCase()}|${r.model.toLowerCase()}`, r.size_slug]))

// Live snapshot from MCP (paste path) — or accept argv JSON path
const livePath = process.argv[2]
if (!livePath) {
  console.error('Usage: node scripts/diff-vehicle-sizes.mjs <live.json>')
  process.exit(1)
}
const { readFileSync } = await import('node:fs')
const live = JSON.parse(readFileSync(livePath, 'utf8'))
const changes = []
for (const row of live) {
  const key = `${String(row.make).toLowerCase()}|${String(row.model).toLowerCase()}`
  const want = seedMap.get(key)
  if (want && want !== row.size_slug) {
    changes.push({ make: row.make, model: row.model, from: row.size_slug, to: want })
  }
}
console.log(`changes=${changes.length}`)
const vals = changes
  .map((c) => `  ('${c.make.replace(/'/g, "''")}', '${c.model.replace(/'/g, "''")}', '${c.to}')`)
  .join(',\n')
const sql = changes.length
  ? `update public.vehicle_catalog vc
set size_slug = v.size_slug, updated_at = now()
from (values
${vals}
) as v(make, model, size_slug)
where lower(vc.make) = lower(v.make) and lower(vc.model) = lower(v.model);`
  : '-- no changes'
writeFileSync('tmp-size-updates.sql', sql)
writeFileSync('tmp-size-changes.json', JSON.stringify(changes, null, 2))
console.log(changes.slice(0, 15))
