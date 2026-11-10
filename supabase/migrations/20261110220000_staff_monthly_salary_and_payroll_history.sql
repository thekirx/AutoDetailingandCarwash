-- Add monthly_salary_minor to staff_profiles for monthly employees
alter table public.staff_profiles
  add column if not exists monthly_salary_minor integer not null default 0;

-- Expand payslips select policy to allow all Assistant Super Admins (Lucy, Robert) alongside Super Admin
drop policy if exists payslips_select on public.payslips;
create policy payslips_select on public.payslips
for select to authenticated
using (
  staff_id = (select auth.uid())
  or public.is_super_admin()
  or public.current_user_role() = 'assistant_super_admin'
);

-- Expand payroll_period_locks select policy
drop policy if exists payroll_period_locks_select on public.payroll_period_locks;
create policy payroll_period_locks_select on public.payroll_period_locks
for select to authenticated
using (
  public.is_super_admin()
  or public.current_user_role() = 'assistant_super_admin'
);

-- Allow Super Admin, Lucy, and Robert to lock or unlock payroll periods
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
  v_is_authorized boolean;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  v_is_authorized := public.is_super_admin() or (
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
  );

  if not v_is_authorized then
    raise exception 'forbidden';
  end if;

  select c.period_start, c.period_end into v_start, v_end
    from public.payroll_period_containing(p_start) c;
  if v_start is null or v_start <> p_start or v_end <> p_end then
    raise exception 'Invalid payroll period dates.';
  end if;

  if p_lock then
    insert into public.payroll_period_locks (branch, period_start, period_end, locked_by)
    values (p_branch, v_start, v_end, auth.uid())
    on conflict (branch, period_start, period_end) do nothing;
    return jsonb_build_object('ok', true, 'locked', true);
  else
    delete from public.payroll_period_locks
     where branch = p_branch and period_start = v_start and period_end = v_end;
    return jsonb_build_object('ok', true, 'locked', false);
  end if;
end;
$$;

revoke all on function public.set_payroll_period_lock(text, date, date, boolean) from public, anon;
grant execute on function public.set_payroll_period_lock(text, date, date, boolean) to authenticated;

-- Function to set or adjust a monthly employee's base salary
create or replace function public.set_staff_monthly_salary(
  p_staff_id uuid,
  p_monthly_salary_minor integer
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_is_authorized boolean;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  v_is_authorized := public.is_super_admin() or (
    public.current_user_role() = 'assistant_super_admin'
    and (
      public.asa_has_grant('finance_write')
      or public.asa_has_grant('people')
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
  );

  if not v_is_authorized then
    raise exception 'forbidden: only Super Admin, Lucy, or Robert can set employee salary';
  end if;

  if p_monthly_salary_minor is null or p_monthly_salary_minor < 0 then
    raise exception 'Salary must be 0 or greater.';
  end if;

  update public.staff_profiles
     set monthly_salary_minor = p_monthly_salary_minor,
         updated_at = timezone('utc', now())
   where id = p_staff_id;

  return jsonb_build_object('ok', true, 'staff_id', p_staff_id, 'monthly_salary_minor', p_monthly_salary_minor);
end;
$$;

revoke all on function public.set_staff_monthly_salary(uuid, integer) from public, anon;
grant execute on function public.set_staff_monthly_salary(uuid, integer) to authenticated;

