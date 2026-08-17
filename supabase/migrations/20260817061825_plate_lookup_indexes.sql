-- Team Lead / public plate lookup: match JS normalizePlate, drop duplicate
-- unique-covered index, and stop scanning bookings by created_at.

create or replace function public.normalize_plate_number(input_plate text)
returns text
language sql
immutable
set search_path to 'pg_catalog', 'public'
as $$
  select upper(regexp_replace(trim(coalesce(input_plate, '')), '[^A-Za-z0-9]', '', 'g'));
$$;

drop index if exists public.idx_vehicles_normalized_plate;

create index if not exists bookings_vehicle_id_created_idx
  on public.bookings (vehicle_id, created_at desc)
  where vehicle_id is not null;

create index if not exists bookings_normalized_plate_created_idx
  on public.bookings (public.normalize_plate_number(vehicle_plate), created_at desc);

create index if not exists bookings_service_id_idx
  on public.bookings (service_id)
  where service_id is not null;

create index if not exists vehicle_maint_customer_id_idx
  on public.vehicle_maintenance_schedules (customer_id)
  where customer_id is not null;

create index if not exists vehicle_maint_vehicle_id_idx
  on public.vehicle_maintenance_schedules (vehicle_id)
  where vehicle_id is not null;

create or replace view public.customer_vehicle_masterlist
with (security_invoker = true)
as
select
  v.id as vehicle_id,
  coalesce(c.id, lb.customer_id) as customer_id,
  v.plate_number,
  v.normalized_plate_number,
  coalesce(c.full_name, lb.customer_name) as customer_name,
  coalesce(c.phone, lb.customer_phone) as customer_phone,
  coalesce(c.email, lb.customer_email) as customer_email,
  coalesce(c.loyalty_points, 0) as loyalty_points,
  coalesce(v.vehicle_make, lb.vehicle_make) as vehicle_make,
  coalesce(v.vehicle_model, lb.vehicle_model) as vehicle_model,
  coalesce(v.vehicle_year, lb.vehicle_year) as vehicle_year,
  coalesce(v.vehicle_type, lb.vehicle_type) as vehicle_type,
  v.color as vehicle_color,
  v.first_branch,
  coalesce(v.last_branch, lb.branch) as last_branch,
  v.last_visit_at,
  coalesce(v.total_visits, 0) as total_visits,
  lb.id as last_booking_id,
  s.name as last_service_name,
  lb.created_at as last_service_date,
  t.amount_minor as last_amount_paid,
  t.payment_method as last_payment_method
from public.vehicles v
left join public.customers c on c.id = v.customer_id
left join lateral (
  select hit.id, hit.customer_id, hit.service_id, hit.customer_name, hit.customer_email,
         hit.customer_phone, hit.vehicle_make, hit.vehicle_model, hit.vehicle_year,
         hit.vehicle_type, hit.created_at, hit.branch
  from (
    (
      select b.id, b.customer_id, b.service_id, b.customer_name, b.customer_email,
             b.customer_phone, b.vehicle_make, b.vehicle_model, b.vehicle_year,
             b.vehicle_type, b.created_at, b.branch
      from public.bookings b
      where b.vehicle_id = v.id
      order by b.created_at desc
      limit 1
    )
    union all
    (
      select b.id, b.customer_id, b.service_id, b.customer_name, b.customer_email,
             b.customer_phone, b.vehicle_make, b.vehicle_model, b.vehicle_year,
             b.vehicle_type, b.created_at, b.branch
      from public.bookings b
      where b.vehicle_id is null
        and public.normalize_plate_number(b.vehicle_plate) = v.normalized_plate_number
      order by b.created_at desc
      limit 1
    )
  ) hit
  order by hit.created_at desc
  limit 1
) lb on true
left join public.services s on s.id = lb.service_id
left join lateral (
  select tr.amount_minor, tr.payment_method
  from public.transactions tr
  where tr.booking_id = lb.id
    and coalesce(tr.is_archived, false) = false
  order by tr.created_at desc
  limit 1
) t on true
where v.is_archived = false;

grant select on public.customer_vehicle_masterlist to authenticated;

analyze public.vehicles;
analyze public.bookings;
analyze public.vehicle_maintenance_schedules;
analyze public.transactions;
