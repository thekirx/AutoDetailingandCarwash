-- A half-month can be locked so no more office payslips are sent.
-- Super Admin can unlock it. Amounts stay editable until the lock.

create table if not exists public.payroll_period_locks (
  id uuid primary key default gen_random_uuid(),
  branch text not null,
  period_start date not null,
  period_end date not null,
  locked_by uuid,
  locked_at timestamptz not null default now(),
  constraint payroll_period_locks_one unique (branch, period_start, period_end),
  constraint payroll_period_locks_span check (period_end >= period_start and (period_end - period_start) <= 16)
);

alter table public.payroll_period_locks enable row level security;

drop policy if exists payroll_period_locks_select on public.payroll_period_locks;
create policy payroll_period_locks_select on public.payroll_period_locks
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.current_user_role() = 'assistant_super_admin'
      and public.asa_has_grant('finance_write')
    )
  );

revoke all on table public.payroll_period_locks from public, anon;
grant select on table public.payroll_period_locks to authenticated;

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
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_end < p_start or (p_end - p_start) > 16 then
    raise exception 'A payroll period is one half of a month.';
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
    values (p_branch, p_start, p_end, auth.uid())
    on conflict (branch, period_start, period_end) do nothing;
    return jsonb_build_object('ok', true, 'locked', true);
  end if;
  if not public.is_super_admin() then
    raise exception 'Only Super Admin can unlock a payroll period.';
  end if;
  delete from public.payroll_period_locks
   where branch = p_branch and period_start = p_start and period_end = p_end;
  return jsonb_build_object('ok', true, 'locked', false);
end;
$$;

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
  v_id uuid;
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

  select role::text into v_role from public.staff_profiles where id = p_staff and is_active = true;
  if v_role is null then
    raise exception 'Pick an active employee.';
  end if;
  if v_role in ('staff', 'team_lead', 'detailer') then
    raise exception 'Crew are paid on the Daily Sheet, not a monthly payslip.';
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
    raise exception 'A payslip covers one half of a month.';
  end if;

  insert into public.payslips (
    staff_id, branch, period_start, period_end,
    salary_minor, incentive_minor, paid_from, note, created_by
  ) values (
    p_staff, p_branch, p_start, p_end,
    p_salary, coalesce(p_incentive, 0), p_paid_from, nullif(trim(coalesce(p_note, '')), ''), auth.uid()
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.set_payroll_period_lock(text, date, date, boolean) from public, anon;
grant execute on function public.set_payroll_period_lock(text, date, date, boolean) to authenticated;
