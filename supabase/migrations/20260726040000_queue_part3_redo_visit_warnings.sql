-- Part 3: redo status, visit groups (multi-service), timing warning settings, board columns
-- Split: enum value must commit before use in views (see 20260726040001).

alter type public.booking_status add value if not exists 'redo';

alter table public.bookings
  add column if not exists visit_group_id uuid,
  add column if not exists redo_at timestamptz,
  add column if not exists redo_by uuid references public.staff_profiles (id),
  add column if not exists redo_reason text;

alter table public.bookings add column if not exists in_progress_at timestamptz;
alter table public.bookings add column if not exists final_checking_at timestamptz;

create index if not exists bookings_visit_group_id_idx on public.bookings (visit_group_id) where visit_group_id is not null;
create index if not exists bookings_status_branch_created_idx on public.bookings (branch, status, created_at desc);

insert into public.app_settings (key, value, updated_at)
values (
  'queue_timing_warnings',
  jsonb_build_object('min_seconds_in_progress', 120, 'enabled', true),
  now()
)
on conflict (key) do nothing;

create or replace view public.operations_queue_board
with (security_invoker = true)
as
select
  b.id as booking_id,
  b.branch,
  b.queue_number,
  b.queue_date,
  b.status,
  b.customer_id,
  b.vehicle_id,
  b.customer_name,
  b.customer_phone,
  b.customer_email,
  b.vehicle_plate,
  b.vehicle_make,
  b.vehicle_model,
  b.vehicle_year,
  b.vehicle_type,
  b.service_id,
  s.name as service_name,
  s.price_minor as base_price_minor,
  b.final_price_minor,
  b.assigned_staff_id,
  sp.full_name as assigned_staff_name,
  b.scheduled_start,
  b.scheduled_end,
  b.estimated_start,
  b.estimated_end,
  b.actual_start,
  b.actual_end,
  b.created_at,
  b.notes,
  b.visit_group_id,
  b.in_progress_at,
  b.final_checking_at,
  b.redo_at,
  b.redo_reason
from public.bookings b
left join public.services s on s.id = b.service_id
left join public.staff_profiles sp on sp.id = b.assigned_staff_id
where coalesce(b.is_archived, false) = false;

grant select on public.operations_queue_board to authenticated;
