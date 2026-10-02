/** Build UPDATE SQL for rows where live dump differs from seed chart. */
import { writeFileSync } from 'node:fs'
import { flattenVehicleCatalog } from '../src/lib/phVehicles.js'

const dump = process.argv[2]
if (!dump) {
  console.error('Usage: node scripts/apply-size-diff-from-dump.mjs <dump-file>')
  process.exit(1)
}
const { readFileSync } = await import('node:fs')
const text = readFileSync(dump, 'utf8')
const live = new Map()
for (const line of text.split(/\n+/)) {
  const [make, model, size] = line.trim().split('|')
  if (!make || !model || !size) continue
  live.set(`${make}|${model}`, size)
}
const seed = flattenVehicleCatalog()
const changes = []
for (const row of seed) {
  const key = `${row.make.toLowerCase()}|${row.model.toLowerCase()}`
  const cur = live.get(key)
  if (cur && cur !== row.size_slug) {
    changes.push({ make: row.make, model: row.model, from: cur, to: row.size_slug })
  }
}
console.log(`changes=${changes.length}`)
const vals = changes
  .map((c) => `('${c.make.replace(/'/g, "''")}', '${c.model.replace(/'/g, "''")}', '${c.to}')`)
  .join(',\n')
const sql = `update public.vehicle_catalog vc
set size_slug = v.size_slug, updated_at = now()
from (values
${vals}
) as v(make, model, size_slug)
where lower(vc.make) = lower(v.make) and lower(vc.model) = lower(v.model);`
writeFileSync('tmp-size-updates.sql', sql)
writeFileSync('tmp-size-changes.json', JSON.stringify(changes, null, 2))
console.log(changes.slice(0, 20).map((c) => `${c.make} ${c.model}: ${c.from}→${c.to}`).join('\n'))
