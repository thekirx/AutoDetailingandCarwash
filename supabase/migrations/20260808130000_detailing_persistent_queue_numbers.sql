-- Detailing services keep persistent queue numbers (no Manila daily reset).
-- Same-day services/packages continue to use assign_daily_queue_number.
-- Board view exposes service_pay_category for floor filtering + D- vs Q- labels.

create table if not exists public.queue_number_counters_persistent (
  branch text primary key,
  last_value integer not null default 0,
  constraint queue_number_counters_persistent_last_value_nonneg check (last_value >= 0)
);

comment on table public.queue_number_counters_persistent is
  'ponytail: ceiling = one counter row per branch for multi-day detailing; upgrade = partitioned sequence if needed';

alter table public.queue_number_counters_persistent enable row level security;

revoke all on public.queue_number_counters_persistent from public, anon, authenticated;

create or replace function public.assign_persistent_queue_number(p_branch text)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_branch text := nullif(trim(p_branch), '');
  v_next integer;
begin
  if v_branch is null then
    raise exception 'branch is required to assign a persistent queue number';
  end if;

  insert into public.queue_number_counters_persistent (branch, last_value)
  values (v_branch, 0)
  on conflict (branch) do nothing;

  select c.last_value + 1
  into v_next
  from public.queue_number_counters_persistent c
  where c.branch = v_branch
  for update;

  update public.queue_number_counters_persistent
  set last_value = v_next
  where branch = v_branch;

  return v_next;
end;
$$;

revoke all on function public.assign_persistent_queue_number(text) from public, anon;
grant execute on function public.assign_persistent_queue_number(text) to authenticated, service_role;

-- Seed from existing detailing bookings so new numbers continue the series
insert into public.queue_number_counters_persistent (branch, last_value)
select
  b.branch,
  max(nullif(regexp_replace(coalesce(b.queue_number::text, '0'), '[^0-9]', '', 'g'), '')::integer)
from public.bookings b
join public.services s on s.id = b.service_id
where b.branch is not null
  and coalesce(b.is_archived, false) = false
  and lower(coalesce(s.pay_category, '')) = 'detailing'
  and nullif(regexp_replace(coalesce(b.queue_number::text, ''), '[^0-9]', '', 'g'), '') is not null
group by 1
on conflict (branch) do update
set last_value = greatest(public.queue_number_counters_persistent.last_value, excluded.last_value);

create or replace function public.trg_assign_booking_queue_number()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_pay_category text;
begin
  if new.queue_date is null then
    new.queue_date := (timezone('Asia/Manila', coalesce(new.created_at, now())))::date;
  end if;

  if new.queue_number is null and new.branch is not null then
    select lower(coalesce(s.pay_category, 'general'))
    into v_pay_category
    from public.services s
    where s.id = new.service_id;

    if v_pay_category = 'detailing' then
      -- Multi-day detailing: never bind to daily counter reset
      new.queue_number := public.assign_persistent_queue_number(new.branch);
    else
      new.queue_number := public.assign_daily_queue_number(new.branch, new.queue_date);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assign_booking_queue_number on public.bookings;
create trigger trg_assign_booking_queue_number
  before insert on public.bookings
  for each row
  execute function public.trg_assign_booking_queue_number();

-- CREATE OR REPLACE cannot insert a new column mid-list; drop + recreate.
drop view if exists public.operations_queue_board;

create view public.operations_queue_board
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
  b.redo_reason,
  s.pay_category as service_pay_category
from public.bookings b
left join public.services s on s.id = b.service_id
left join public.staff_profiles sp on sp.id = b.assigned_staff_id
where coalesce(b.is_archived, false) = false;

grant select on public.operations_queue_board to authenticated;
