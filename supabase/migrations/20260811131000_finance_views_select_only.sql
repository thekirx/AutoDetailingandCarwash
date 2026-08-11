-- Default privileges grant ALL on new views to authenticated.
-- Tighten finance rollup views to SELECT only.

revoke insert, update, delete, truncate, references, trigger on public.finance_daily_pl from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.finance_branch_summary from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.finance_expense_by_category from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.finance_customer_retention from authenticated;

grant select on public.finance_daily_pl to authenticated;
grant select on public.finance_branch_summary to authenticated;
grant select on public.finance_expense_by_category to authenticated;
grant select on public.finance_customer_retention to authenticated;
