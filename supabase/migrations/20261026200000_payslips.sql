-- Bi-monthly payslips for office staff. Day crew are rejected.
-- Take-home is salary plus incentive. There is no tax column.
-- ponytail: one row per person per half-month. A second send raises unique_violation.

create table if not exists public.payslips (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles (id),
  branch text not null,
  period_start date not null,
  period_end date not null,
  salary_minor integer not null check (salary_minor > 0),
  incentive_minor integer not null default 0 check (incentive_minor >= 0),
  paid_from text not null check (paid_from in ('cash', 'gcash')),
  note text,
  status text not null default 'sent' check (status in ('sent', 'received', 'signed')),
  signed_name text,
  signed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint payslips_half check (period_end >= period_start and (period_end - period_start) <= 16),
  constraint payslips_one_half unique (staff_id, period_start, period_end)
);

alter table public.payslips enable row level security;

drop policy if exists payslips_select on public.payslips;
create policy payslips_select on public.payslips
  for select to authenticated
  using (
    staff_id = auth.uid()
    or public.is_super_admin()
    or (
      public.current_user_role() = 'assistant_super_admin'
      and public.asa_has_grant('finance_write')
    )
  );

revoke all on table public.payslips from public, anon;
grant select on table public.payslips to authenticated;

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

create or replace function public.mark_payslip_received(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  update public.payslips
     set status = 'received'
   where id = p_id
     and staff_id = auth.uid()
     and status = 'sent'
  returning id into v_id;
  if v_id is null then
    raise exception 'This payslip is not waiting to be received.';
  end if;
  return jsonb_build_object('ok', true, 'status', 'received');
end;
$$;

create or replace function public.sign_payslip(p_id uuid, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if v_name is null or char_length(v_name) < 2 then
    raise exception 'Type your name to sign.';
  end if;
  update public.payslips
     set status = 'signed',
         signed_name = v_name,
         signed_at = now()
   where id = p_id
     and staff_id = auth.uid()
     and status = 'received'
  returning id into v_id;
  if v_id is null then
    raise exception 'Mark the payslip received before you sign.';
  end if;
  return jsonb_build_object('ok', true, 'status', 'signed');
end;
$$;

revoke all on function public.send_payslip(uuid, text, date, date, integer, integer, text, text) from public, anon;
revoke all on function public.mark_payslip_received(uuid) from public, anon;
revoke all on function public.sign_payslip(uuid, text) from public, anon;
grant execute on function public.send_payslip(uuid, text, date, date, integer, integer, text, text) to authenticated;
grant execute on function public.mark_payslip_received(uuid) to authenticated;
grant execute on function public.sign_payslip(uuid, text) to authenticated;
