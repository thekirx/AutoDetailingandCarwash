-- Pricing by car size: Small / Medium / Large / Extra Large
-- service_size_prices holds per-size catalog prices; services.price_minor stays Medium (compat).

insert into public.vehicle_sizes (slug, label, sort_order, is_active) values
  ('small', 'Small', 1, true),
  ('medium', 'Medium', 2, true),
  ('large', 'Large', 3, true),
  ('extra_large', 'Extra Large', 4, true)
on conflict (slug) do update
  set label = excluded.label,
      sort_order = excluded.sort_order,
      is_active = true;

-- Prefer pricing sizes on new tickets; keep body-style rows for historical bookings
update public.vehicle_sizes
set is_active = false
where slug in ('sedan', 'suv', 'pickup', 'van', 'motorcycle', 'other');

alter table public.bookings drop constraint if exists bookings_vehicle_type_check;
alter table public.bookings
  add constraint bookings_vehicle_type_check
  check (vehicle_type = any (array[
    'small', 'medium', 'large', 'extra_large',
    'sedan', 'suv', 'pickup', 'van', 'motorcycle', 'other'
  ]));

create table if not exists public.service_size_prices (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  size_slug text not null
    check (size_slug = any (array['small', 'medium', 'large', 'extra_large'])),
  price_minor integer not null check (price_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, size_slug)
);

create index if not exists service_size_prices_service_idx
  on public.service_size_prices (service_id);

-- Backfill: all four sizes = current catalog price
insert into public.service_size_prices (service_id, size_slug, price_minor)
select s.id, sz.slug, coalesce(s.price_minor, 0)
from public.services s
cross join (values
  ('small'), ('medium'), ('large'), ('extra_large')
) as sz(slug)
on conflict (service_id, size_slug) do nothing;

alter table public.service_size_prices enable row level security;

drop policy if exists service_size_prices_select on public.service_size_prices;
create policy service_size_prices_select on public.service_size_prices
  for select to authenticated using (true);

drop policy if exists service_size_prices_write on public.service_size_prices;
create policy service_size_prices_write on public.service_size_prices
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.service_size_prices to authenticated;
grant insert, update, delete on public.service_size_prices to authenticated;

-- ASA + Admin can manage vehicle sizes (was Super Admin only)
drop policy if exists vehicle_sizes_write on public.vehicle_sizes;
create policy vehicle_sizes_write on public.vehicle_sizes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
