-- Break out GCash vs Credit Cards on daily_sales_summary (Cash already separate).
-- Keep online_sales_minor as gcash + card (+ legacy online) for older callers.

drop view if exists public.daily_sales_summary;

create view public.daily_sales_summary
with (security_invoker = true)
as
select
  s.branch,
  (s.occurred_at at time zone 'Asia/Manila')::date as sale_date,
  count(*) filter (where s.status = 'paid') as paid_count,
  count(*) filter (where s.status = 'pending') as pending_count,
  count(*) as transaction_count,
  coalesce(sum(s.total_minor) filter (where s.status = 'paid'), 0)::bigint as total_sales_minor,
  coalesce(sum(s.total_minor) filter (where s.status = 'paid' and s.payment_method = 'cash'), 0)::bigint as cash_sales_minor,
  coalesce(sum(s.total_minor) filter (where s.status = 'paid' and s.payment_method in ('online', 'gcash', 'card')), 0)::bigint as online_sales_minor,
  coalesce(sum(s.total_minor) filter (where s.status = 'paid' and s.payment_method = 'gcash'), 0)::bigint as gcash_sales_minor,
  coalesce(sum(s.total_minor) filter (where s.status = 'paid' and s.payment_method in ('card', 'online')), 0)::bigint as card_sales_minor,
  case
    when count(*) filter (where s.status = 'paid') > 0
    then (coalesce(sum(s.total_minor) filter (where s.status = 'paid'), 0)
      / (count(*) filter (where s.status = 'paid')))::bigint
    else 0
  end as average_ticket_minor
from public.sales s
group by 1, 2;

grant select on public.daily_sales_summary to authenticated;
