/** Write + optionally print vehicle size resync migration. */
import { writeFileSync } from 'node:fs'
import { flattenVehicleCatalog } from '../src/lib/phVehicles.js'

const rows = flattenVehicleCatalog()
const vals = rows
  .map((r) => `  ('${r.make.replace(/'/g, "''")}', '${r.model.replace(/'/g, "''")}', '${r.size_slug}')`)
  .join(',\n')

const sql = `-- Resync vehicle_catalog sizes to body-style bay chart + seed S/M/L/XL on bay SKUs.
-- Small=sedan/hatch · Medium=crossover · Large=SUV/pickup/MPV · XL=full-size van/people mover.
-- Bay price ratios match detailing: 0.85 / 1 / 1.2 / 1.4 of Medium (services.price_minor).

update public.vehicle_catalog vc
set size_slug = v.size_slug,
    updated_at = now()
from (values
${vals}
) as v(make, model, size_slug)
where lower(vc.make) = lower(v.make)
  and lower(vc.model) = lower(v.model);

-- Seed size matrix for active catalog rows missing any size price (bay wash/packages/addons).
-- Do not overwrite existing detailing matrices.
insert into public.service_size_prices (service_id, size_slug, price_minor)
select s.id, sz.slug,
  case sz.slug
    when 'small' then round(coalesce(s.price_minor, 0) * 0.85)::int
    when 'medium' then coalesce(s.price_minor, 0)
    when 'large' then round(coalesce(s.price_minor, 0) * 1.2)::int
    when 'extra_large' then round(coalesce(s.price_minor, 0) * 1.4)::int
  end
from public.services s
cross join (values ('small'), ('medium'), ('large'), ('extra_large')) as sz(slug)
where s.is_archived = false
  and not exists (
    select 1 from public.service_size_prices ssp where ssp.service_id = s.id
  )
on conflict (service_id, size_slug) do nothing;
`

const out = new URL('../supabase/migrations/20260915140000_vehicle_size_chart_resync.sql', import.meta.url)
writeFileSync(out, sql)
console.log(`Wrote ${rows.length} pairs → ${out.pathname}`)
