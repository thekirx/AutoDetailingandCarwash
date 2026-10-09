-- Finance accounts (expense_categories): archive instead of delete once used, unique account codes,
-- and protect account 14, which review_daily_sheet posts shift-close salaries to (by code) and
-- run_payroll falls back to (first kind = 'payroll').

alter table public.expense_categories
  add column if not exists is_archived boolean not null default false;

create unique index if not exists expense_categories_code_key
  on public.expense_categories (code)
  where code is not null;

create or replace function public.guard_salary_expense_category()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.code = '14' then
      raise exception 'Account 14 (salaries) is used by shift-close payroll and cannot be deleted'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;
  if old.code = '14' and (new.code is distinct from '14' or new.kind <> 'payroll' or new.is_archived) then
    raise exception 'Account 14 (salaries) must keep code 14, kind Payroll, and stay active'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists expense_categories_guard_salary on public.expense_categories;
create trigger expense_categories_guard_salary
  before update or delete on public.expense_categories
  for each row execute function public.guard_salary_expense_category();
