-- run_payroll (package-kinds migration) orders expense_categories by sort_order,
-- but the column was never added. Without it, Boss confirm raises:
--   column "sort_order" does not exist
alter table public.expense_categories
  add column if not exists sort_order integer not null default 100;

update public.expense_categories
set sort_order = case lower(coalesce(kind, ''))
  when 'payroll' then 10
  when 'chemicals' then 20
  when 'utilities' then 30
  when 'marketing' then 40
  when 'equipment' then 50
  else 100
end
where true;
