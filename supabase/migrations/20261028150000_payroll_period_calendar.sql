-- The 14-day payroll block is chosen here, from the same Monday as payBiweek.
-- A page that sends 1–15 or any other span is refused.
-- Roster reads use (branch, period). The Finance row points at the payslip.

create or replace function public.payroll_period_containing(p_on date)
returns table (period_start date, period_end date)
language sql
immutable
as $$
  select
    (date '2026-01-05' + (floor((p_on - date '2026-01-05')::numeric / 14)::int * 14))::date,
    (date '2026-01-05' + (floor((p_on - date '2026-01-05')::numeric / 14)::int * 14) + 13)::date
$$;

revoke all on function public.payroll_period_containing(date) from public, anon;
grant execute on function public.payroll_period_containing(date) to authenticated;

create index if not exists payslips_branch_period_idx
  on public.payslips (branch, period_start, period_end);

alter table public.expenses
  add column if not exists payslip_id uuid references public.payslips (id);

create unique index if not exists expenses_one_payslip_idx
  on public.expenses (payslip_id)
  where payslip_id is not null;

create or replace function public.send_payslip(
  p_staff uuid,
  p_branch text,
  p_start date,
  p_end date,
  p_salary integer,
  p_incentive integer,
  p_paid_from text,
  p_note text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_role text;
  v_name text;
  v_id uuid;
  v_category uuid;
  v_take integer;
  v_note text;
  v_start date;
  v_end date;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not (
    public.is_super_admin()
    or (
      public.current_user_role() = 'assistant_super_admin'
      and public.asa_has_grant('finance_write')
    )
  ) then
    raise exception 'forbidden';
  end if;
  if public.current_user_role() = 'assistant_super_admin'
     and not public.user_has_branch_access(p_branch) then
    raise exception 'forbidden';
  end if;

  select c.period_start, c.period_end into v_start, v_end
    from public.payroll_period_containing(p_start) c;
  if p_start is distinct from v_start or p_end is distinct from v_end then
    raise exception 'Use the 14-day payroll block for that date.';
  end if;

  if exists (
    select 1 from public.payroll_period_locks
     where branch = p_branch and period_start = v_start and period_end = v_end
  ) then
    raise exception 'This payroll period is locked.';
  end if;

  select role::text, full_name into v_role, v_name
    from public.staff_profiles where id = p_staff and is_active = true;
  if v_role is null then
    raise exception 'Pick an active employee.';
  end if;
  if v_role in ('staff', 'team_lead', 'detailer') then
    raise exception 'Crew are paid on the Daily Sheet, not a payslip.';
  end if;
  if p_salary is null or p_salary <= 0 then
    raise exception 'Enter the salary.';
  end if;
  if coalesce(p_incentive, 0) < 0 then
    raise exception 'Incentive cannot be negative.';
  end if;
  if p_paid_from not in ('cash', 'gcash') then
    raise exception 'Pay with cash or GCash.';
  end if;

  select id into v_category from public.expense_categories where code = '14' limit 1;
  if v_category is null then
    raise exception 'Salary account (code 14) is missing. Add it in Finance categories.';
  end if;

  v_note := nullif(trim(coalesce(p_note, '')), '');
  v_take := p_salary + coalesce(p_incentive, 0);

  insert into public.payslips (
    staff_id, branch, period_start, period_end,
    salary_minor, incentive_minor, paid_from, note, created_by
  ) values (
    p_staff, p_branch, v_start, v_end,
    p_salary, coalesce(p_incentive, 0), p_paid_from, v_note, auth.uid()
  )
  returning id into v_id;

  insert into public.expenses (
    title, description, quantity, unit_cost_minor, total_minor, branch,
    category_id, status, expense_kind, paid_from, created_by, approved_by, paid_by, payslip_id
  ) values (
    'Payroll · ' || coalesce(v_name, 'staff'),
    'payslip:' || v_id::text || coalesce(' · ' || v_note, ''),
    1,
    v_take,
    v_take,
    p_branch,
    v_category,
    'paid',
    'salary_monthly',
    p_paid_from,
    auth.uid(),
    auth.uid(),
    auth.uid(),
    v_id
  );

  return jsonb_build_object('ok', true, 'id', v_id, 'total_minor', v_take, 'period_start', v_start, 'period_end', v_end);
end;
$$;

create or replace function public.update_office_payslip(
  p_id uuid,
  p_salary integer,
  p_incentive integer,
  p_paid_from text,
  p_note text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row public.payslips%rowtype;
  v_note text;
  v_take integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not (
    public.is_super_admin()
    or (
      public.current_user_role() = 'assistant_super_admin'
      and public.asa_has_grant('finance_write')
    )
  ) then
    raise exception 'forbidden';
  end if;

  select * into v_row from public.payslips where id = p_id;
  if v_row.id is null then
    raise exception 'Payslip not found.';
  end if;
  if public.current_user_role() = 'assistant_super_admin'
     and not public.user_has_branch_access(v_row.branch) then
    raise exception 'forbidden';
  end if;
  if v_row.status <> 'sent' then
    raise exception 'This payslip was already received. It can no longer be edited.';
  end if;
  if exists (
    select 1 from public.payroll_period_locks
     where branch = v_row.branch
       and period_start = v_row.period_start
       and period_end = v_row.period_end
  ) then
    raise exception 'This payroll period is locked.';
  end if;
  if p_salary is null or p_salary <= 0 then
    raise exception 'Enter the salary.';
  end if;
  if coalesce(p_incentive, 0) < 0 then
    raise exception 'Incentive cannot be negative.';
  end if;
  if p_paid_from not in ('cash', 'gcash') then
    raise exception 'Pay with cash or GCash.';
  end if;

  v_note := nullif(trim(coalesce(p_note, '')), '');
  v_take := p_salary + coalesce(p_incentive, 0);

  update public.payslips
     set salary_minor = p_salary,
         incentive_minor = coalesce(p_incentive, 0),
         paid_from = p_paid_from,
         note = v_note
   where id = p_id;

  update public.expenses
     set unit_cost_minor = v_take,
         total_minor = v_take,
         paid_from = p_paid_from,
         payslip_id = p_id,
         description = 'payslip:' || p_id::text || coalesce(' · ' || v_note, '')
   where payslip_id = p_id
      or (payslip_id is null and description like 'payslip:' || p_id::text || '%' and expense_kind = 'salary_monthly');

  return jsonb_build_object('ok', true, 'id', p_id, 'total_minor', v_take);
end;
$$;

create or replace function public.set_payroll_period_lock(
  p_branch text,
  p_start date,
  p_end date,
  p_lock boolean
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_start date;
  v_end date;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select c.period_start, c.period_end into v_start, v_end
    from public.payroll_period_containing(p_start) c;
  if p_start is distinct from v_start or p_end is distinct from v_end then
    raise exception 'Use the 14-day payroll block for that date.';
  end if;
  if p_lock then
    if not (
      public.is_super_admin()
      or (
        public.current_user_role() = 'assistant_super_admin'
        and public.asa_has_grant('finance_write')
        and public.user_has_branch_access(p_branch)
      )
    ) then
      raise exception 'forbidden';
    end if;
    insert into public.payroll_period_locks (branch, period_start, period_end, locked_by)
    values (p_branch, v_start, v_end, auth.uid())
    on conflict (branch, period_start, period_end) do nothing;
    return jsonb_build_object('ok', true, 'locked', true);
  end if;
  if not public.is_super_admin() then
    raise exception 'Only Super Admin can unlock a payroll period.';
  end if;
  delete from public.payroll_period_locks
   where branch = p_branch and period_start = v_start and period_end = v_end;
  return jsonb_build_object('ok', true, 'locked', false);
end;
$$;
