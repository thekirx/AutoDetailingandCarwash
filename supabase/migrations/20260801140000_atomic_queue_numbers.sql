-- Atomic daily queue numbers (DB-P0-1).
-- Live column bookings.queue_number is integer. Multi-service visits share one number —
-- do NOT UNIQUE on bookings. Counter table + FOR UPDATE is the allocator.

create table if not exists public.queue_number_counters (
  branch text not null,
  queue_date date not null,
  last_value integer not null default 0,
  primary key (branch, queue_date),
  constraint queue_number_counters_last_value_nonneg check (last_value >= 0)
);

comment on table public.queue_number_counters is
  'ponytail: ceiling = one counter row per branch/day; upgrade = hash-partition if 1000+ sites';

alter table public.bookings add column if not exists queue_date date;

alter table public.queue_number_counters enable row level security;

revoke all on public.queue_number_counters from public, anon, authenticated;

drop trigger if exists trg_assign_booking_queue_number on public.bookings;
drop function if exists public.assign_daily_queue_number(text, date);

create or replace function public.assign_daily_queue_number(p_branch text, p_queue_date date default null)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_date date := coalesce(
    p_queue_date,
    (timezone('Asia/Manila', now()))::date
  );
  v_branch text := nullif(trim(p_branch), '');
  v_next integer;
begin
  if v_branch is null then
    raise exception 'branch is required to assign a queue number';
  end if;

  insert into public.queue_number_counters (branch, queue_date, last_value)
  values (v_branch, v_date, 0)
  on conflict (branch, queue_date) do nothing;

  select c.last_value + 1
  into v_next
  from public.queue_number_counters c
  where c.branch = v_branch and c.queue_date = v_date
  for update;

  update public.queue_number_counters
  set last_value = v_next
  where branch = v_branch and queue_date = v_date;

  return v_next;
end;
$$;

revoke all on function public.assign_daily_queue_number(text, date) from public, anon;
grant execute on function public.assign_daily_queue_number(text, date) to authenticated, service_role;

-- Seed counters from existing rows (cast queue_number via ::text for text|int safety)
insert into public.queue_number_counters (branch, queue_date, last_value)
select
  b.branch,
  coalesce(b.queue_date, (timezone('Asia/Manila', b.created_at))::date) as qd,
  max(nullif(regexp_replace(coalesce(b.queue_number::text, '0'), '[^0-9]', '', 'g'), '')::integer)
from public.bookings b
where b.branch is not null
  and coalesce(b.is_archived, false) = false
  and nullif(regexp_replace(coalesce(b.queue_number::text, ''), '[^0-9]', '', 'g'), '') is not null
group by 1, 2
on conflict (branch, queue_date) do update
set last_value = greatest(public.queue_number_counters.last_value, excluded.last_value);

create or replace function public.trg_assign_booking_queue_number()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.queue_date is null then
    new.queue_date := (timezone('Asia/Manila', coalesce(new.created_at, now())))::date;
  end if;

  if new.queue_number is null and new.branch is not null then
    new.queue_number := public.assign_daily_queue_number(new.branch, new.queue_date);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assign_booking_queue_number on public.bookings;
create trigger trg_assign_booking_queue_number
  before insert on public.bookings
  for each row
  execute function public.trg_assign_booking_queue_number();

create index if not exists bookings_branch_queue_date_number_idx
  on public.bookings (branch, queue_date, queue_number)
  where coalesce(is_archived, false) = false;
