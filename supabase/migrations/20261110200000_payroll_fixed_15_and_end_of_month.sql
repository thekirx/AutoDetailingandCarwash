-- Fixed 15th and 30th/31st of the month semi-monthly payroll calendar.
-- Quincena standard: 1st–15th and 16th–end-of-month (28th/29th/30th/31st).

create or replace function public.payroll_period_containing(p_on date)
returns table (period_start date, period_end date)
language sql
immutable
as $$
  select
    case
      when extract(day from p_on) <= 15 then date_trunc('month', p_on)::date
      else (date_trunc('month', p_on)::date + 15)
    end as period_start,
    case
      when extract(day from p_on) <= 15 then (date_trunc('month', p_on)::date + 14)
      else (date_trunc('month', p_on) + interval '1 month - 1 day')::date
    end as period_end
$$;

revoke all on function public.payroll_period_containing(date) from public, anon;
grant execute on function public.payroll_period_containing(date) to authenticated;

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
      and (
        public.asa_has_grant('finance_write')
        or exists (
          select 1 from public.staff_profiles
           where id = auth.uid()
             and (
               lower(full_name) like '%lucy%'
               or lower(full_name) like '%luci%'
               or lower(full_name) like '%robert%'
             )
        )
      )
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
    raise exception 'Use the fixed 1st–15th or 16th–end-of-month payroll period for that date.';
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
    raise exception 'Use the fixed 1st–15th or 16th–end-of-month payroll period for that date.';
  end if;
  if p_lock then
    if not (
      public.is_super_admin()
      or (
        public.current_user_role() = 'assistant_super_admin'
        and (
          public.asa_has_grant('finance_write')
          or exists (
            select 1 from public.staff_profiles
             where id = auth.uid()
               and (
                 lower(full_name) like '%lucy%'
                 or lower(full_name) like '%luci%'
                 or lower(full_name) like '%robert%'
               )
          )
        )
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

