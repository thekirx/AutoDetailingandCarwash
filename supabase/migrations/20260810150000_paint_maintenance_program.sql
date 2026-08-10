-- Paint maintenance SKU + dedupe-safe schedules for Ceramic/PPF 6-month program.

begin;

-- 1) Bookable Paint Maintenance service (return visit after Ceramic / PPF).
insert into public.services (
  id, name, slug, pay_category, price_minor, duration_minutes,
  display_order, is_active, is_archived, description
)
values (
  '44444444-4444-4444-8444-444444444444',
  'Paint Maintenance',
  'paint-maintenance',
  'detailing',
  350000,
  180,
  15,
  true,
  false,
  'Follow-up paint maintenance for Ceramic Coating and PPF. Resets the 6-month reminder clock.'
)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  pay_category = excluded.pay_category,
  description = excluded.description,
  is_active = true,
  is_archived = false,
  updated_at = now();

-- 2) Program + normalized plate for one active schedule per vehicle program.
alter table public.vehicle_maintenance_schedules
  add column if not exists program_key text not null default 'paint_maintenance';

alter table public.vehicle_maintenance_schedules
  add column if not exists plate_normalized text;

update public.vehicle_maintenance_schedules
set plate_normalized = upper(regexp_replace(coalesce(plate_number, ''), '[^A-Za-z0-9]', '', 'g'))
where plate_normalized is null or plate_normalized = '';

-- Cancel older duplicates so the unique active index can apply.
with ranked as (
  select
    id,
    row_number() over (
      partition by plate_normalized, coalesce(program_key, 'paint_maintenance')
      order by updated_at desc nulls last, created_at desc nulls last
    ) as rn
  from public.vehicle_maintenance_schedules
  where status in ('scheduled', 'notified')
    and plate_normalized is not null
    and plate_normalized <> ''
)
update public.vehicle_maintenance_schedules s
set status = 'cancelled',
    notes = coalesce(s.notes || ' ', '') || 'deduped for paint_maintenance program',
    updated_at = now()
from ranked r
where s.id = r.id and r.rn > 1;

create index if not exists vehicle_maint_plate_norm_idx
  on public.vehicle_maintenance_schedules (plate_normalized);

-- One active reminder per plate + program (blocks duplicate Ceramic/PPF seeds).
drop index if exists vehicle_maint_active_plate_program_uidx;
create unique index vehicle_maint_active_plate_program_uidx
  on public.vehicle_maintenance_schedules (plate_normalized, program_key)
  where status in ('scheduled', 'notified')
    and plate_normalized is not null
    and plate_normalized <> '';

-- Optional: booking+slug uniqueness when booking_id present (secondary safety).
drop index if exists vehicle_maint_booking_service_uidx;
create unique index vehicle_maint_booking_service_uidx
  on public.vehicle_maintenance_schedules (booking_id, service_slug)
  where booking_id is not null;

commit;
