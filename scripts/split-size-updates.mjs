import { writeFileSync } from 'node:fs'
import { flattenVehicleCatalog } from '../src/lib/phVehicles.js'

const rows = flattenVehicleCatalog()
const chunkSize = Math.ceil(rows.length / 4)
for (let i = 0; i < 4; i += 1) {
  const chunk = rows.slice(i * chunkSize, (i + 1) * chunkSize)
  const vals = chunk
    .map((r) => `('${r.make.replace(/'/g, "''")}', '${r.model.replace(/'/g, "''")}', '${r.size_slug}')`)
    .join(',')
  const sql = `update public.vehicle_catalog vc
set size_slug = v.size_slug, updated_at = now()
from (values ${vals}) as v(make, model, size_slug)
where lower(vc.make) = lower(v.make) and lower(vc.model) = lower(v.model);`
  writeFileSync(`tmp-size-batch-${i}.sql`, sql)
  console.log(i, chunk.length, sql.length)
}
