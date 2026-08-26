-- Preserve package_* line kinds for My Pay; allow ca_repayment expenses on POS close.

-- 1) payroll_run_lines.kind — keep package_fixed / package_hybrid (and explicit adj kinds)
alter table public.payroll_run_lines
  drop constraint if exists payroll_run_lines_kind_check;

alter table public.payroll_run_lines
  add constraint payroll_run_lines_kind_check
  check (kind in (
    'wash_pool',
    'ceramic_crew',
    'ceramic_detailer',
    'adjustment',
    'adjustment_add',
    'adjustment_deduct',
    'package_fixed',
    'package_hybrid'
  ));

-- 2) expenses.expense_kind — CA repayment is drawer money in, not salary
alter table public.expenses
  drop constraint if exists expenses_expense_kind_check;

alter table public.expenses
  add constraint expenses_expense_kind_check
  check (expense_kind is null or expense_kind in (
    'daily',
    'monthly',
    'salary_carwash',
    'salary_detailer',
    'salary_tinter',
    'other_branch',
    'cash_advance',
    'ca_repayment',
    'other'
  ));

-- 3) run_payroll: stop collapsing package kinds to adjustment
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
  v_store_kind text;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  caller_role := public.current_user_role();
  if caller_role is distinct from 'BossMich'
     and not (caller_role = 'assistant_super_admin' and public.asa_has_grant('finance_write')) then
    raise exception using errcode = '42501',
      message = 'Only Super Admin or ASA with finance write may run payroll';
  end if;

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
      select 1 from public.payroll_run_sales prs where prs.sale_id = v_sale
    ) then
      raise exception 'Sale % already claimed by another payroll run', v_sale;
    end if;
  end loop;

  select id into v_payroll_cat
  from public.expense_categories
  where kind = 'payroll'
  order by sort_order nulls last
  limit 1;

  insert into public.payroll_runs (
    branch, frequency, period_start, period_end, status,
    wash_pool_pct, notes, confirmed_by, confirmed_at, run_kind
  ) values (
    v_branch, v_frequency, v_start, v_end, 'confirmed',
    v_pct, v_notes, caller, clock_timestamp(), v_run_kind
  )
  returning id into v_run;

  for sale in select * from jsonb_array_elements(coalesce(payload->'sales', '[]'::jsonb)) loop
    v_sale := (sale->>'sale_id')::uuid;
    if v_sale is null then continue; end if;
    insert into public.payroll_run_sales (run_id, sale_id, branch, total_minor)
    values (
      v_run,
      v_sale,
      coalesce(sale->>'branch', v_branch),
      coalesce((sale->>'total_minor')::integer, (sale->>'wash_pool_minor')::integer, 0)
    );
    v_pos := v_pos + coalesce((sale->>'total_minor')::integer, (sale->>'wash_pool_minor')::integer, 0);
  end loop;

  for line in select * from jsonb_array_elements(payload->'lines') loop
    v_staff := nullif(line->>'staff_id', '')::uuid;
    v_line_branch := line->>'branch';
    v_kind := lower(coalesce(nullif(trim(line->>'kind'), ''), 'adjustment'));
    v_amount := coalesce((line->>'amount_minor')::integer, 0);
    v_source := nullif(trim(coalesce(line->>'source_key', '')), '');
    v_sale := nullif(line->>'source_sale_id', '')::uuid;
    v_direction := lower(coalesce(nullif(trim(line->>'direction'), ''), 'add'));
    v_label := nullif(trim(coalesce(line->>'label', '')), '');

    if v_staff is null then raise exception 'Each payout line needs staff_id'; end if;
    if v_line_branch is null then raise exception 'Each payout line needs a branch'; end if;
    if v_amount <= 0 then raise exception 'Payout amounts must be positive'; end if;
    if caller_role is distinct from 'BossMich'
       and not public.user_has_branch_access(v_line_branch) then
      raise exception using errcode = '42501',
        message = 'Payroll is limited to your assigned branch(es)';
    end if;

    if v_kind not in (
      'wash_pool', 'ceramic_crew', 'ceramic_detailer', 'adjustment',
      'package_fixed', 'package_hybrid', 'adjustment_add', 'adjustment_deduct'
    ) then
      raise exception 'Invalid payout line kind: %', v_kind;
    end if;

    if v_kind in ('adjustment', 'adjustment_add', 'adjustment_deduct')
       and v_label is null and v_source is null then
      raise exception 'Adjustment lines need a label or source_key';
    end if;

    -- Store package kinds as-is for My Pay; map add/deduct direction for signed total
    if v_kind in ('adjustment_deduct') or v_direction = 'deduct' then
      v_store_kind := 'adjustment';
      v_direction := 'deduct';
      v_source := coalesce(v_source, concat('deduct:', coalesce(v_label, 'adjustment')));
      v_signed := -v_amount;
      v_expense := null;
    elsif v_kind in ('package_fixed', 'package_hybrid') then
      v_store_kind := v_kind;
      v_direction := 'add';
      v_signed := v_amount;
      v_source := coalesce(v_source, concat('package:', coalesce(v_label, v_kind)));
      v_exp_kind := 'salary_carwash';
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
    else
      if v_kind = 'adjustment_add' then
        v_store_kind := 'adjustment';
        v_source := coalesce(v_source, concat('add:', coalesce(v_label, 'adjustment')));
      else
        v_store_kind := v_kind;
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
      v_run, v_staff, v_line_branch, v_store_kind, coalesce(v_source, v_label), v_sale,
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

comment on function public.run_payroll(jsonb) is
  'Confirm payroll run; preserves package_fixed/package_hybrid kinds for My Pay labels.';
