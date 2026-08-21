-- Floor vs fixed payroll runs + indexes for pending-close coverage queries.

alter table public.payroll_runs
  add column if not exists run_kind text;

update public.payroll_runs
set run_kind = case
  when notes ilike '%Fixed salary%' then 'fixed'
  when notes ilike '%Floor pay%' then 'floor'
  when coalesce(pos_sales_minor, 0) > 0 then 'floor'
  else 'floor'
end
where run_kind is null;

alter table public.payroll_runs
  drop constraint if exists payroll_runs_run_kind_check;

alter table public.payroll_runs
  add constraint payroll_runs_run_kind_check
  check (run_kind is null or run_kind in ('floor', 'fixed'));

-- Coverage lookups: confirmed floor runs by branch + period
create index if not exists payroll_runs_floor_coverage_idx
  on public.payroll_runs (branch, period_start, period_end)
  where status in ('confirmed', 'paid') and coalesce(run_kind, 'floor') = 'floor';

-- Pending closes by branch/day for payroll dashboard
create index if not exists shift_close_reports_pending_payroll_idx
  on public.shift_close_reports (branch, business_date desc)
  where status in ('submitted', 'accepted', 'locked');

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
  v_run_kind text := lower(coalesce(nullif(trim(payload->>'run_kind'), ''), 'floor'));
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
  v_direction text;
  v_label text;
  v_signed integer;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  caller_role := public.current_user_role();
  if caller_role is distinct from 'BossMich'
     and not (caller_role = 'assistant_super_admin' and public.asa_has_grant('finance_write')) then
    raise exception using errcode = '42501',
      message = 'Only Super Admin or ASA with finance write may run payroll';
  end if;

  -- ponytail: one payroll confirm at a time (ceiling: global lock; upgrade = per-branch advisory keys)
  perform pg_advisory_xact_lock(87201401);

  if v_run_kind not in ('floor', 'fixed') then
    raise exception 'Invalid payroll run kind';
  end if;
  if v_frequency not in ('daily', 'weekly', 'biweekly', 'semimonthly', 'monthly', 'custom') then
    raise exception 'Invalid payout frequency';
  end if;
  if v_start is null or v_end is null or v_end < v_start then
    raise exception 'Invalid payroll period';
  end if;
  if v_end > v_start + 366 then
    raise exception 'Payroll period cannot exceed 366 days';
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

  for line in select * from jsonb_array_elements(payload->'lines') loop
    v_line_branch := line->>'branch';
    if v_line_branch is null then
      raise exception 'Each payout line needs a branch';
    end if;
    -- Overlap only against the same run_kind so fixed HQ and floor bay can share dates
    if exists (
      select 1
      from public.payroll_runs r
      join public.payroll_run_lines l on l.run_id = r.id
      where r.status in ('confirmed', 'paid')
        and coalesce(r.run_kind, 'floor') = v_run_kind
        and l.branch = v_line_branch
        and r.period_start <= v_end
        and r.period_end >= v_start
    ) then
      raise exception 'Overlapping % payroll run already exists for %', v_run_kind, v_line_branch;
    end if;
  end loop;

  for sale in select * from jsonb_array_elements(coalesce(payload->'sales', '[]'::jsonb)) loop
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
    pos_sales_minor, total_payout_minor, notes, created_by, run_kind
  ) values (
    v_branch, v_frequency, v_start, v_end, 'confirmed', v_pct,
    0, 0, v_notes, caller, v_run_kind
  ) returning id into v_run;

  for sale in select * from jsonb_array_elements(coalesce(payload->'sales', '[]'::jsonb)) loop
    v_sale := (sale->>'sale_id')::uuid;
    if v_sale is null then continue; end if;
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

  for line in select * from jsonb_array_elements(payload->'lines') loop
    v_staff := (line->>'staff_id')::uuid;
    v_line_branch := line->>'branch';
    v_kind := coalesce(line->>'kind', 'wash_pool');
    v_amount := coalesce((line->>'amount_minor')::int, 0);
    v_source := nullif(line->>'source_key', '');
    v_sale := nullif(line->>'source_sale_id', '')::uuid;
    v_direction := lower(coalesce(line->>'direction', 'add'));
    v_label := nullif(trim(coalesce(line->>'label', '')), '');

    if v_staff is null then raise exception 'Each payout line needs an employee'; end if;
    if v_kind not in (
      'wash_pool', 'ceramic_crew', 'ceramic_detailer', 'adjustment',
      'package_fixed', 'package_hybrid', 'adjustment_add', 'adjustment_deduct'
    ) then
      raise exception 'Invalid payout kind';
    end if;
    if v_kind in ('adjustment', 'adjustment_add', 'adjustment_deduct')
       and v_label is null and v_source is null then
      raise exception 'Adjustment lines need a label';
    end if;
    if v_amount < 0 then raise exception 'Payout lines cannot be negative'; end if;
    if v_amount = 0 then continue; end if;

    if caller_role is distinct from 'BossMich'
       and not public.user_has_branch_access(v_line_branch) then
      raise exception using errcode = '42501',
        message = 'Payroll is limited to your assigned branch(es)';
    end if;

    if v_kind in ('adjustment_deduct') or v_direction = 'deduct' then
      v_kind := 'adjustment';
      v_direction := 'deduct';
      v_source := coalesce(v_source, concat('deduct:', coalesce(v_label, 'adjustment')));
      v_signed := -v_amount;
      v_expense := null;
    else
      if v_kind in ('adjustment_add', 'package_fixed', 'package_hybrid') then
        v_kind := 'adjustment';
        v_source := coalesce(v_source, concat('add:', coalesce(v_label, 'package')));
      end if;
      v_direction := 'add';
      v_signed := v_amount;
      v_exp_kind := case when v_kind = 'ceramic_detailer' then 'salary_detailer' else 'salary_carwash' end;
      v_expense := null;
      if v_source is not null then
        select e.id into v_expense
        from public.expenses e
        where e.description = v_source and e.branch = v_line_branch
        limit 1;
      end if;
      if v_expense is not null then
        update public.expenses
        set status = 'paid', paid_by = caller, updated_at = clock_timestamp()
        where id = v_expense and status is distinct from 'paid';
      else
        insert into public.expenses (
          title, description, quantity, unit_cost_minor, total_minor,
          branch, category_id, status, expense_kind, created_by, paid_by
        ) values (
          concat(
            'Payroll · ', coalesce(line->>'staff_name', 'crew'), ' · ', v_line_branch,
            case when v_label is not null then concat(' · ', v_label) else '' end
          ),
          concat('payroll:', v_run::text, ':', v_staff::text, ':', coalesce(v_source, v_kind)),
          1, v_amount, v_amount,
          v_line_branch, v_payroll_cat, 'paid', v_exp_kind, caller, caller
        )
        returning id into v_expense;
      end if;
    end if;

    insert into public.payroll_run_lines (
      run_id, staff_id, branch, kind, source_key, source_sale_id,
      attendance_weight, amount_minor, expense_id
    ) values (
      v_run, v_staff, v_line_branch, v_kind, coalesce(v_source, v_label), v_sale,
      nullif(line->>'attendance_weight', '')::numeric, v_amount, v_expense
    );
    v_total := v_total + v_signed;
  end loop;

  if v_total <= 0 then raise exception 'Nothing to pay for this period'; end if;

  update public.payroll_runs
  set pos_sales_minor = v_pos,
      total_payout_minor = v_total,
      updated_at = clock_timestamp()
  where id = v_run;

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, summary, meta)
  values (
    caller, caller_role, 'payroll.run', 'payroll_runs', v_run::text,
    concat('Confirmed ', v_run_kind, ' payroll ', v_start, ' to ', v_end),
    jsonb_build_object(
      'frequency', v_frequency,
      'run_kind', v_run_kind,
      'total_payout_minor', v_total,
      'pos_sales_minor', v_pos
    )
  );

  return jsonb_build_object(
    'run_id', v_run,
    'run_kind', v_run_kind,
    'total_payout_minor', v_total,
    'pos_sales_minor', v_pos
  );
end;
$$;

revoke all on function public.run_payroll(jsonb) from public;
grant execute on function public.run_payroll(jsonb) to authenticated;
