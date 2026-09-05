-- Aggregate counters for the public homepage.
--
-- The homepage prints a base figure for the work done before this system
-- existed, and adds what the database can actually count on top of it. Only the
-- two totals are exposed — never the booking rows behind them — following the
-- same shape as public.public_queue_counts.
--
-- Archived bookings are counted. Archiving clears a job off the board; it does
-- not mean the work never happened, and this is a historical total.

create or replace view public.public_home_stats as
with done as (
  select
    b.customer_id,
    nullif(btrim(b.customer_phone), '') as phone,
    nullif(btrim(b.vehicle_plate), '')  as plate
  from public.bookings b
  where b.status::text in ('completed', 'for_payment')
),
identified as (
  -- A returning customer is not always a signed-up one: most walk-ins are only
  -- ever identified by phone or plate, so identity falls back through both
  -- before the visit is given up on.
  select coalesce(customer_id::text, phone, plate) as identity
  from done
)
select
  (select count(*) from done)::integer as services_done,
  (
    select count(*)::integer
    from (
      select identity
      from identified
      where identity is not null
      group by identity
      having count(*) > 1
    ) repeats
  ) as returning_clients;

comment on view public.public_home_stats is
  'Two aggregate counters for the public homepage. Exposes no booking rows.';

revoke all on public.public_home_stats from public;
revoke all on public.public_home_stats from anon, authenticated;
grant select on public.public_home_stats to anon, authenticated;
