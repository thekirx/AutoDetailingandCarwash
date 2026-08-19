-- Payroll runs: POS-proofed payouts with per-employee lines.
-- query-missing-indexes: filters on status, period, staff_id, sale_id.
-- security-rls: employees read own lines; SA/ASA finance grants for the register.

alter table public.compensation_settings
  add column if not exists payout_frequency text not null default 'weekly';

alter table public.compensation_settings
  add column if not exists payout_weekday smallint not null default 5;

alter table public.compensation_settings
  drop constraint if exists compensation_settings_payout_frequency_check;

alter table public.compensation_settings
  add constraint compensation_settings_payout_frequency_check
  check (payout_frequency in ('daily', 'weekly', 'biweekly', 'monthly'));

alter table public.compensation_settings
  drop constraint if exists compensation_settings_payout_weekday_check;

alter table public.compensation_settings
  add constraint compensation_settings_payout_weekday_check
  check (payout_weekday between 0 and 6);

create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  branch text references public.branches (slug),
  frequency text not null check (frequency in ('daily', 'weekly', 'biweekly', 'monthly')),
  period_start date not null,
  period_end date not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'paid', 'void')),
  wash_pool_pct numeric not null default 35,
  pos_sales_minor integer not null default 0 check (pos_sales_minor >= 0),
  total_payout_minor integer not null default 0 check (total_payout_minor >= 0),
  notes text,
  created_by uuid,
  confirmed_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint payroll_runs_period_ok check (period_end >= period_start)
);

create index if not exists payroll_runs_period_idx
  on public.payroll_runs (period_start desc, period_end desc);

create index if not exists payroll_runs_status_idx
  on public.payroll_runs (status)
  where status in ('confirmed', 'paid');

create index if not exists payroll_runs_branch_period_idx
  on public.payroll_runs (branch, period_start desc)
  where branch is not null;

create table if not exists public.payroll_run_lines (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.payroll_runs (id) on delete cascade,
  staff_id uuid not null references public.staff_profiles (id) on delete restrict,
  branch text not null references public.branches (slug),
  kind text not null check (kind in ('wash_pool', 'ceramic_crew', 'ceramic_detailer', 'adjustment')),
  source_key text,
  source_sale_id uuid,
  attendance_weight numeric,
  amount_minor integer not null check (amount_minor >= 0),
  expense_id uuid references public.expenses (id) on delete set null,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists payroll_run_lines_staff_idx
  on public.payroll_run_lines (staff_id, created_at desc);

create index if not exists payroll_run_lines_run_idx
  on public.payroll_run_lines (run_id);

create index if not exists payroll_run_lines_branch_idx
  on public.payroll_run_lines (branch);

create table if not exists public.payroll_run_sales (
  run_id uuid not null references public.payroll_runs (id) on delete cascade,
  sale_id uuid not null references public.sales (id) on delete restrict,
  branch text not null,
  total_minor integer not null default 0,
  wash_pool_minor integer not null default 0,
  primary key (run_id, sale_id)
);

create unique index if not exists payroll_run_sales_sale_uidx
  on public.payroll_run_sales (sale_id);

create index if not exists payroll_run_sales_sale_idx
  on public.payroll_run_sales (sale_id);

alter table public.payroll_runs enable row level security;
alter table public.payroll_run_lines enable row level security;
alter table public.payroll_run_sales enable row level security;

drop policy if exists payroll_runs_select on public.payroll_runs;
create policy payroll_runs_select on public.payroll_runs
for select to authenticated
using (
  public.is_super_admin()
  or (
    public.is_assistant_super_admin()
    and public.asa_has_grant('finance_view')
  )
  or exists (
    select 1 from public.payroll_run_lines l
    where l.run_id = payroll_runs.id
      and l.staff_id = auth.uid()
  )
);

drop policy if exists payroll_run_lines_select on public.payroll_run_lines;
create policy payroll_run_lines_select on public.payroll_run_lines
for select to authenticated
using (
  staff_id = auth.uid()
  or public.is_super_admin()
  or (
    public.is_assistant_super_admin()
    and public.asa_has_grant('finance_view')
  )
);

drop policy if exists payroll_run_sales_select on public.payroll_run_sales;
create policy payroll_run_sales_select on public.payroll_run_sales
for select to authenticated
using (
  public.is_super_admin()
  or (
    public.is_assistant_super_admin()
    and public.asa_has_grant('finance_view')
  )
  or exists (
    select 1 from public.payroll_run_lines l
    where l.run_id = payroll_run_sales.run_id
      and l.staff_id = auth.uid()
  )
);

revoke all on public.payroll_runs from public, anon;
revoke all on public.payroll_run_lines from public, anon;
revoke all on public.payroll_run_sales from public, anon;
grant select on public.payroll_runs to authenticated;
grant select on public.payroll_run_lines to authenticated;
grant select on public.payroll_run_sales to authenticated;

create or replace function public.run_payroll(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid := auth.uid();
  caller_role text;
  v_branch text := nullif(payload->>'branch', '');
  v_frequency text := coalesce(payload->>'frequency', 'weekly');
  v_start date := (payload->>'period_start')::date;
  v_end date := (payload->>'period_end')::date;
  v_pct numeric := coalesce((payload->>'wash_pool_pct')::numeric, 35);
  v_notes text := nullif(trim(coalesce(payload->>'notes', '')), '');
  v_run uuid;
  v_total integer := 0;
  v_pos integer := 0;
  line jsonb;
  sale jsonb;
  v_staff uuid;
  v_line_branch text;
  v_kind text;
  v_amount integer;
  v_source text;
  v_sale uuid;
  v_expense uuid;
  v_payroll_cat uuid;
  v_exp_kind text;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  caller_role := public.current_user_role();
  if caller_role is distinct from 'BossMich'
     and not (
       caller_role = 'assistant_super_admin'
       and public.asa_has_grant('finance_write')
     ) then
    raise exception using errcode = '42501',
      message = 'Only Super Admin or ASA with finance write may run payroll';
  end if;

  if v_frequency not in ('daily', 'weekly', 'biweekly', 'monthly') then
    raise exception 'Invalid payout frequency';
  end if;
  if v_start is null or v_end is null or v_end < v_start then
    raise exception 'Invalid payroll period';
  end if;
  if jsonb_typeof(payload->'lines') is distinct from 'array'
     or jsonb_array_length(payload->'lines') < 1 then
    raise exception 'At least one payout line is required';
  end if;

  if v_branch is not null then
    if not exists (
      select 1 from public.branches b
      where b.slug = v_branch and b.is_active and not b.is_archived
    ) then
      raise exception 'Invalid branch';
    end if;
    if caller_role is distinct from 'BossMich'
       and not public.user_has_branch_access(v_branch) then
      raise exception using errcode = '42501',
        message = 'Payroll is limited to your assigned branch(es)';
    end if;
  end if;

  for line in select * from jsonb_array_elements(payload->'lines')
  loop
    v_line_branch := line->>'branch';
    if v_line_branch is null then
      raise exception 'Each payout line needs a branch';
    end if;
    if exists (
      select 1
      from public.payroll_runs r
      join public.payroll_run_lines l on l.run_id = r.id
      where r.status in ('confirmed', 'paid')
        and l.branch = v_line_branch
        and r.period_start <= v_end
        and r.period_end >= v_start
    ) then
      raise exception 'Overlapping payroll run already exists for %', v_line_branch;
    end if;
  end loop;

  for sale in
    select * from jsonb_array_elements(coalesce(payload->'sales', '[]'::jsonb))
  loop
    v_sale := (sale->>'sale_id')::uuid;
    if v_sale is not null and exists (
      select 1 from public.payroll_run_sales s where s.sale_id = v_sale
    ) then
      raise exception 'sale already paid in another payroll run';
    end if;
  end loop;

  select c.id into v_payroll_cat
  from public.expense_categories c
  where lower(c.name) = 'payroll'
  limit 1;

  insert into public.payroll_runs (
    branch, frequency, period_start, period_end, status, wash_pool_pct,
    pos_sales_minor, total_payout_minor, notes, created_by
  ) values (
    v_branch, v_frequency, v_start, v_end, 'confirmed', v_pct,
    0, 0, v_notes, caller
  ) returning id into v_run;

  for sale in
    select * from jsonb_array_elements(coalesce(payload->'sales', '[]'::jsonb))
  loop
    v_sale := (sale->>'sale_id')::uuid;
    if v_sale is null then
      continue;
    end if;
    insert into public.payroll_run_sales (run_id, sale_id, branch, total_minor, wash_pool_minor)
    values (
      v_run,
      v_sale,
      coalesce(sale->>'branch', v_branch),
      coalesce((sale->>'total_minor')::int, 0),
      coalesce((sale->>'wash_pool_minor')::int, 0)
    );
    v_pos := v_pos + coalesce((sale->>'wash_pool_minor')::int, (sale->>'total_minor')::int, 0);
  end loop;

  for line in select * from jsonb_array_elements(payload->'lines')
  loop
    v_staff := (line->>'staff_id')::uuid;
    v_line_branch := line->>'branch';
    v_kind := coalesce(line->>'kind', 'wash_pool');
    v_amount := coalesce((line->>'amount_minor')::int, 0);
    v_source := nullif(line->>'source_key', '');
    v_sale := nullif(line->>'source_sale_id', '')::uuid;
    if v_staff is null then
      raise exception 'Each payout line needs an employee';
    end if;
    if v_kind not in ('wash_pool', 'ceramic_crew', 'ceramic_detailer', 'adjustment') then
      raise exception 'Invalid payout kind';
    end if;
    if v_amount < 0 then
      raise exception 'Payout lines cannot be negative';
    end if;
    if v_amount = 0 then
      continue;
    end if;
    if caller_role is distinct from 'BossMich'
       and not public.user_has_branch_access(v_line_branch) then
      raise exception using errcode = '42501',
        message = 'Payroll is limited to your assigned branch(es)';
    end if;

    v_exp_kind := case
      when v_kind = 'ceramic_detailer' then 'salary_detailer'
      else 'salary_carwash'
    end;
    v_expense := null;

    if v_source is not null then
      select e.id into v_expense
      from public.expenses e
      where e.description = v_source
        and e.branch = v_line_branch
      limit 1;
    end if;

    if v_expense is not null then
      update public.expenses
      set status = 'paid',
          paid_by = caller,
          updated_at = clock_timestamp()
      where id = v_expense
        and status is distinct from 'paid';
    else
      insert into public.expenses (
        title, description, quantity, unit_cost_minor, total_minor,
        branch, category_id, status, expense_kind, created_by, paid_by
      ) values (
        concat('Payroll · ', coalesce(line->>'staff_name', 'crew'), ' · ', v_line_branch),
        concat('payroll:', v_run::text, ':', v_staff::text, ':', coalesce(v_source, v_kind)),
        1,
        v_amount,
        v_amount,
        v_line_branch,
        v_payroll_cat,
        'paid',
        v_exp_kind,
        caller,
        caller
      ) returning id into v_expense;
    end if;

    insert into public.payroll_run_lines (
      run_id, staff_id, branch, kind, source_key, source_sale_id,
      attendance_weight, amount_minor, expense_id
    ) values (
      v_run,
      v_staff,
      v_line_branch,
      v_kind,
      v_source,
      v_sale,
      nullif(line->>'attendance_weight', '')::numeric,
      v_amount,
      v_expense
    );
    v_total := v_total + v_amount;
  end loop;

  if v_total <= 0 then
    raise exception 'Nothing to pay for this period';
  end if;

  update public.payroll_runs
  set pos_sales_minor = v_pos,
      total_payout_minor = v_total,
      updated_at = clock_timestamp()
  where id = v_run;

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, summary, meta)
  values (
    caller,
    caller_role,
    'payroll.run',
    'payroll_runs',
    v_run::text,
    concat('Confirmed payroll ', v_start, ' to ', v_end),
    jsonb_build_object(
      'frequency', v_frequency,
      'total_payout_minor', v_total,
      'pos_sales_minor', v_pos
    )
  );

  return jsonb_build_object(
    'run_id', v_run,
    'total_payout_minor', v_total,
    'pos_sales_minor', v_pos
  );
end;
$$;

revoke all on function public.run_payroll(jsonb) from public, anon;
grant execute on function public.run_payroll(jsonb) to authenticated;
