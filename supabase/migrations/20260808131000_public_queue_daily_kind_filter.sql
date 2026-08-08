-- Public board: same-day services/packages drop stale waiting tickets overnight.
-- Detailing (and any started bay work) stays visible across Manila days.

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
left join public.services s on s.id = b.service_id
where b.status in ('waiting', 'in_progress', 'final_checking')
  and coalesce(b.is_archived, false) = false
  and (
    lower(coalesce(s.pay_category, 'general')) = 'detailing'
    or b.status in ('in_progress', 'final_checking')
    or coalesce(b.queue_date, (timezone('Asia/Manila', b.created_at))::date)
      = (timezone('Asia/Manila', now()))::date
  )
group by b.branch;

drop view if exists public.public_queue_numbers;

create view public.public_queue_numbers
with (security_invoker = false)
as
select
  b.branch,
  b.queue_number,
  b.status,
  s.pay_category as service_pay_category
from public.bookings b
left join public.services s on s.id = b.service_id
where b.status in ('waiting', 'in_progress', 'final_checking')
  and coalesce(b.is_archived, false) = false
  and (
    lower(coalesce(s.pay_category, 'general')) = 'detailing'
    or b.status in ('in_progress', 'final_checking')
    or coalesce(b.queue_date, (timezone('Asia/Manila', b.created_at))::date)
      = (timezone('Asia/Manila', now()))::date
  );

revoke all on public.public_queue_counts from public, anon, authenticated;
revoke all on public.public_queue_numbers from public, anon, authenticated;
grant select on public.public_queue_counts to anon, authenticated;
grant select on public.public_queue_numbers to anon, authenticated;
