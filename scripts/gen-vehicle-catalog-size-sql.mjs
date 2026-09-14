import { writeFileSync } from 'node:fs'
import { flattenVehicleCatalog } from '../src/lib/phVehicles.js'

const rows = flattenVehicleCatalog()
const vals = rows
  .map((r) => `  ('${r.make.replace(/'/g, "''")}', '${r.model.replace(/'/g, "''")}', '${r.size_slug}')`)
  .join(',\n')

const sql = `-- Bay/pricing size on the Super Admin cars catalog (Small/Medium/Large/Extra Large).
-- Same slugs as service_size_prices + bookings.vehicle_type.

alter table public.vehicle_catalog
  add column if not exists size_slug text not null default 'medium';

alter table public.vehicle_catalog drop constraint if exists vehicle_catalog_size_slug_check;
alter table public.vehicle_catalog
  add constraint vehicle_catalog_size_slug_check
  check (size_slug = any (array['small', 'medium', 'large', 'extra_large']));

comment on column public.vehicle_catalog.size_slug is
  'PH bay size used to auto-select pricing on queue/book; staff can override per ticket.';

update public.vehicle_catalog vc
set size_slug = v.size_slug,
    updated_at = now()
from (values
${vals}
) as v(make, model, size_slug)
where lower(vc.make) = lower(v.make)
  and lower(vc.model) = lower(v.model);
`

writeFileSync(new URL('../supabase/migrations/20260914220000_vehicle_catalog_size_slug.sql', import.meta.url), sql)
console.log(`Wrote ${rows.length} pairs`)
