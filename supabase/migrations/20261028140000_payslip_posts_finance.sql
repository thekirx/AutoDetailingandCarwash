-- Finance already allows salary_carwash and salary_detailer. Office pay uses salary_monthly.
alter table public.expenses drop constraint if exists expenses_expense_kind_check;
alter table public.expenses
  add constraint expenses_expense_kind_check
  check (
    expense_kind is null
    or expense_kind = any (array[
      'daily', 'monthly', 'salary_carwash', 'salary_detailer', 'salary_tinter',
      'salary_monthly', 'other_branch', 'cash_advance', 'ca_repayment', 'other'
    ])
  );

-- One save writes the payslip and the paid Finance salary.
-- Lucy (General Admin with finance write) can change a sent slip until the period is locked
-- or the employee marks it received.

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
  if exists (
    select 1 from public.payroll_period_locks
     where branch = p_branch and period_start = p_start and period_end = p_end
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
  if p_end < p_start or (p_end - p_start) > 16 then
    raise exception 'A payslip covers 14 days.';
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
    p_staff, p_branch, p_start, p_end,
    p_salary, coalesce(p_incentive, 0), p_paid_from, v_note, auth.uid()
  )
  returning id into v_id;

  insert into public.expenses (
    title, description, quantity, unit_cost_minor, total_minor, branch,
    category_id, status, expense_kind, paid_from, created_by, approved_by, paid_by
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
    auth.uid()
  );

  return jsonb_build_object('ok', true, 'id', v_id, 'total_minor', v_take);
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
         description = 'payslip:' || p_id::text || coalesce(' · ' || v_note, '')
   where description like 'payslip:' || p_id::text || '%'
     and expense_kind = 'salary_monthly';

  return jsonb_build_object('ok', true, 'id', p_id, 'total_minor', v_take);
end;
$$;

revoke all on function public.update_office_payslip(uuid, integer, integer, text, text) from public, anon;
grant execute on function public.update_office_payslip(uuid, integer, integer, text, text) to authenticated;
