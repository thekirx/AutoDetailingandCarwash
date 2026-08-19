-- Retention grouped per branch so Finance Reports can fail-closed on Branch scope.
-- Partial index: paid sales by branch + customer (retention + CRM spend).
-- Version matches remote schema_migrations after apply on lybxhpzzqqyqswvuwpxv.

create index if not exists sales_paid_branch_customer_idx
  on public.sales (branch, customer_id)
  where status = 'paid' and customer_id is not null;

create unique index if not exists expenses_ceramic_sale_uidx
  on public.expenses (description)
  where description like 'ceramic:%';

drop view if exists public.finance_customer_retention;
create view public.finance_customer_retention
with (security_invoker = true)
as
select
  s.branch,
  s.customer_id,
  c.full_name,
  c.phone,
  count(*) as paid_sales,
  coalesce(sum(s.total_minor), 0)::bigint as total_spent_minor,
  min(s.occurred_at) as first_paid_at,
  max(s.occurred_at) as last_paid_at
from public.sales s
left join public.customers c on c.id = s.customer_id
where s.customer_id is not null
  and s.status = 'paid'
group by s.branch, s.customer_id, c.full_name, c.phone;

revoke all on public.finance_customer_retention from public, anon, authenticated;
grant select on public.finance_customer_retention to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.finance_customer_retention from authenticated;
