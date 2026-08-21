-- Package composition + seed real Hakum bay/detailing catalog for POS tabs.

alter table public.services
  add column if not exists included_service_ids uuid[] not null default '{}';

comment on column public.services.included_service_ids is
  'For pay_category=package: component service ids (mixed bundle). Empty = custom package price only.';

create index if not exists services_active_kind_idx
  on public.services (pay_category, display_order)
  where is_active and not is_archived;

-- Normalize live bay / detailing catalog
update public.services set pay_category = 'wash', display_order = 10, is_active = true, is_archived = false
where slug = 'premium-car-wash';

update public.services set pay_category = 'general', display_order = 20, is_active = true, is_archived = false
where slug = 'interior-detailing';

update public.services set pay_category = 'general', display_order = 30, is_active = true, is_archived = false
where slug = 'full-exterior-detailing';

update public.services set pay_category = 'addon', display_order = 40, is_active = true, is_archived = false
where slug = 'glass-detailing';

update public.services set pay_category = 'addon', display_order = 50, is_active = true, is_archived = false
where slug = 'engine-wash';

update public.services set pay_category = 'detailing', display_order = 100, is_active = true, is_archived = false
where slug = 'ceramic-coating';

update public.services set pay_category = 'detailing', display_order = 110, is_active = true, is_archived = false
where slug = 'paint-maintenance';

update public.services set pay_category = 'detailing', display_order = 120, is_active = true, is_archived = false
where slug = 'nano-ceramic-tint';

update public.services set pay_category = 'detailing', display_order = 130, is_active = true, is_archived = false
where slug = 'paint-protection-film';

-- Flat bay add-ons: drop redundant flat size matrices (optional sizing only when set)
delete from public.service_size_prices ssp
using public.services s
where ssp.service_id = s.id
  and s.slug in ('premium-car-wash', 'interior-detailing', 'full-exterior-detailing', 'glass-detailing', 'engine-wash')
  and not exists (
    select 1
    from public.service_size_prices x
    where x.service_id = s.id
    group by x.service_id
    having min(x.price_minor) is distinct from max(x.price_minor)
  );

-- Mixed packages (bundle of existing services) + one custom package
insert into public.services (
  name, slug, description, price_minor, duration_minutes, pay_category,
  display_order, is_active, is_archived, included_service_ids
)
select
  'Express Wash Package',
  'express-wash-package',
  'Carwash + Glass Detailing — same-day bay package.',
  80000,
  60,
  'package',
  60,
  true,
  false,
  array_agg(s.id)
from public.services s
where s.slug in ('premium-car-wash', 'glass-detailing')
  and not exists (select 1 from public.services p where p.slug = 'express-wash-package')
having count(*) = 2;

insert into public.services (
  name, slug, description, price_minor, duration_minutes, pay_category,
  display_order, is_active, is_archived, included_service_ids
)
select
  'Full Care Package',
  'full-care-package',
  'Carwash + Interior Detailing + Engine Wash.',
  450000,
  120,
  'package',
  70,
  true,
  false,
  array_agg(s.id)
from public.services s
where s.slug in ('premium-car-wash', 'interior-detailing', 'engine-wash')
  and not exists (select 1 from public.services p where p.slug = 'full-care-package')
having count(*) = 3;

insert into public.services (
  name, slug, description, price_minor, duration_minutes, pay_category,
  display_order, is_active, is_archived, included_service_ids
)
select
  'Hakum Custom Package',
  'hakum-custom-package',
  'Custom same-day package — price set at create; compose lines on the ticket as needed.',
  100000,
  60,
  'package',
  80,
  true,
  false,
  '{}'::uuid[]
where not exists (select 1 from public.services p where p.slug = 'hakum-custom-package');

-- Refresh package includes if rows already existed from a partial seed
update public.services p
set included_service_ids = sub.ids,
    description = coalesce(nullif(p.description, ''), sub.desc),
    price_minor = case when p.price_minor > 0 then p.price_minor else sub.price end,
    pay_category = 'package',
    is_active = true,
    is_archived = false
from (
  select
    'express-wash-package'::text as slug,
    'Carwash + Glass Detailing — same-day bay package.'::text as desc,
    80000 as price,
    array_agg(s.id) as ids
  from public.services s
  where s.slug in ('premium-car-wash', 'glass-detailing')
) sub
where p.slug = sub.slug and cardinality(sub.ids) = 2;

update public.services p
set included_service_ids = sub.ids,
    description = coalesce(nullif(p.description, ''), sub.desc),
    price_minor = case when p.price_minor > 0 then p.price_minor else sub.price end,
    pay_category = 'package',
    is_active = true,
    is_archived = false
from (
  select
    'full-care-package'::text as slug,
    'Carwash + Interior Detailing + Engine Wash.'::text as desc,
    450000 as price,
    array_agg(s.id) as ids
  from public.services s
  where s.slug in ('premium-car-wash', 'interior-detailing', 'engine-wash')
) sub
where p.slug = sub.slug and cardinality(sub.ids) = 3;
