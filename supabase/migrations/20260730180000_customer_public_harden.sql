-- Customer public surface harden (CUST-C1 / CUST-H3 / CUST-H5 / CUST-H8)
-- 1) Public queue views as security definer so signed-in customers still see full board
-- 2) Drop anon SELECT/INSERT on bookings (PII + spam); API uses service role
-- 3) Unique active customer phone (blocks hijack / guest-link targeting)
-- Note: keep bookings in supabase_realtime for authenticated ops boards; anon no longer has SELECT so Realtime is not delivered to guests.

create or replace view public.public_queue_counts
with (security_invoker = false)
as
select
  b.branch,
  count(*) filter (where b.status = 'waiting')::integer as waiting_count,
  count(*) filter (where b.status = 'in_progress')::integer as in_progress_count,
  count(*) filter (where b.status = 'final_checking')::integer as final_checking_count,
  count(*)::integer as total_active_count
from public.bookings b
where b.status in ('waiting', 'in_progress', 'final_checking')
  and coalesce(b.is_archived, false) = false
group by b.branch;

create or replace view public.public_queue_numbers
with (security_invoker = false)
as
select
  b.branch,
  b.queue_number,
  b.status
from public.bookings b
where b.status in ('waiting', 'in_progress', 'final_checking')
  and coalesce(b.is_archived, false) = false;

revoke all on public.public_queue_counts from public, anon, authenticated;
revoke all on public.public_queue_numbers from public, anon, authenticated;
grant select on public.public_queue_counts to anon, authenticated;
grant select on public.public_queue_numbers to anon, authenticated;

drop policy if exists "Public can read safe active queue rows" on public.bookings;
drop policy if exists "Public can submit pending bookings" on public.bookings;

revoke insert on public.bookings from anon;

create unique index if not exists customers_active_phone_uidx
  on public.customers (phone)
  where role = 'customer'
    and coalesce(is_archived, false) = false
    and phone is not null
    and length(trim(phone)) > 0;
