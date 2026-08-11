-- Finance P&L + branch rollup views. Real POS income + real expenses, no fake data.
-- security_invoker = true so RLS on sales/expenses/customers still applies.
-- query: filter paid/posted before GROUP BY so unpaid drafts never appear as 0-amount rows.
-- security: revoke anon/public; authenticated SELECT only.

-- Partial indexes for the view predicates (paid books only).
create index if not exists expenses_paid_posted_branch_created_idx
  on public.expenses (branch, created_at desc)
  where status in ('paid', 'posted');

create index if not exists sales_paid_customer_occurred_idx
  on public.sales (customer_id, occurred_at desc)
  where status = 'paid' and customer_id is not null;

-- 1) Daily P&L by branch: income from POS paid sales, expenses from paid/posted expenses.
drop view if exists public.finance_daily_pl;
create view public.finance_daily_pl
with (security_invoker = true)
as
select
  s.branch,
  (s.occurred_at at time zone 'Asia/Manila')::date as period_date,
  'income'::text as kind,
  'POS sales'::text as category,
  coalesce(sum(s.total_minor), 0)::bigint as amount_minor
from public.sales s
where s.status = 'paid'
group by 1, 2
union all
select
  e.branch,
  (e.created_at at time zone 'Asia/Manila')::date as period_date,
  'expense'::text as kind,
  coalesce(ec.name, 'Uncategorized')::text as category,
  coalesce(sum(e.total_minor), 0)::bigint as amount_minor
from public.expenses e
left join public.expense_categories ec on ec.id = e.category_id
where e.status in ('paid', 'posted')
group by 1, 2, 4;

revoke all on public.finance_daily_pl from public, anon, authenticated;
grant select on public.finance_daily_pl to authenticated;

-- 2) Branch summary: totals + payment-method breakdown (paid only).
drop view if exists public.finance_branch_summary;
create view public.finance_branch_summary
with (security_invoker = true)
as
select
  s.branch,
  count(*) filter (where s.status = 'paid') as paid_count,
  count(*) as transaction_count,
  coalesce(sum(s.total_minor) filter (where s.status = 'paid'), 0)::bigint as total_sales_minor,
  coalesce(sum(s.total_minor) filter (where s.status = 'paid' and s.payment_method = 'cash'), 0)::bigint as cash_minor,
  coalesce(sum(s.total_minor) filter (where s.status = 'paid' and s.payment_method = 'gcash'), 0)::bigint as gcash_minor,
  coalesce(sum(s.total_minor) filter (where s.status = 'paid' and s.payment_method in ('card', 'online')), 0)::bigint as card_minor
from public.sales s
group by 1;

revoke all on public.finance_branch_summary from public, anon, authenticated;
grant select on public.finance_branch_summary to authenticated;

-- 3) Expense category rollup (paid + posted only).
drop view if exists public.finance_expense_by_category;
create view public.finance_expense_by_category
with (security_invoker = true)
as
select
  e.branch,
  coalesce(ec.id, '00000000-0000-0000-0000-000000000000'::uuid) as category_id,
  coalesce(ec.name, 'Uncategorized') as category_name,
  coalesce(ec.kind, 'general') as kind,
  count(*) as row_count,
  coalesce(sum(e.total_minor), 0)::bigint as total_minor
from public.expenses e
left join public.expense_categories ec on ec.id = e.category_id
where e.status in ('paid', 'posted')
group by 1, 2, 3, 4;

revoke all on public.finance_expense_by_category from public, anon, authenticated;
grant select on public.finance_expense_by_category to authenticated;

-- 4) Customer retention: paid sales only.
drop view if exists public.finance_customer_retention;
create view public.finance_customer_retention
with (security_invoker = true)
as
select
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
group by 1, 2, 3;

revoke all on public.finance_customer_retention from public, anon, authenticated;
grant select on public.finance_customer_retention to authenticated;
