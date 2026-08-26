-- ASA submit_expense_report: require branch access (SA unrestricted).

create or replace function public.submit_expense_report(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid := auth.uid();
  caller_role text;
  v_id uuid := (payload->>'id')::uuid;
  v_status text;
  v_branch text;
  line record;
  v_expense uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  caller_role := public.current_user_role();
  if caller_role is distinct from 'BossMich'
     and not (caller_role = 'assistant_super_admin' and public.asa_has_grant('finance_write')) then
    raise exception using errcode = '42501',
      message = 'Only SA or ASA finance write may submit expense reports';
  end if;
  if v_id is null then raise exception 'Report id required'; end if;

  select status, branch into v_status, v_branch
  from public.expense_reports
  where id = v_id
  for update;

  if v_status is null then raise exception 'Expense report not found'; end if;
  if v_status not in ('draft', 'rejected') then raise exception 'Report already submitted'; end if;

  if caller_role is distinct from 'BossMich'
     and not public.user_has_branch_access(v_branch) then
    raise exception using errcode = '42501',
      message = 'Expense report is limited to your assigned branch(es)';
  end if;

  if not exists (select 1 from public.expense_report_lines where report_id = v_id) then
    raise exception 'Add at least one line before submit';
  end if;

  for line in
    select l.*, c.name as category_name, r.branch
    from public.expense_report_lines l
    join public.expense_categories c on c.id = l.category_id
    join public.expense_reports r on r.id = l.report_id
    where l.report_id = v_id
  loop
    if line.expense_id is not null then
      continue;
    end if;
    insert into public.expenses (
      title, description, quantity, unit_cost_minor, total_minor,
      branch, category_id, status, expense_kind, created_by
    ) values (
      coalesce(line.notes, line.category_name, 'Expense report line'),
      concat('expense_report:', v_id::text, ':', line.id::text),
      1,
      line.amount_minor,
      line.amount_minor,
      line.branch,
      line.category_id,
      'pending_approval',
      'other',
      caller
    ) returning id into v_expense;
    update public.expense_report_lines set expense_id = v_expense where id = line.id;
  end loop;

  update public.expense_reports set
    status = 'submitted',
    submitted_by = caller,
    submitted_at = now(),
    updated_at = now()
  where id = v_id;

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, summary, meta)
  values (
    caller, caller_role, 'expense_report.submit', 'expense_reports', v_id::text,
    'Submitted expense report', '{}'::jsonb
  );

  return jsonb_build_object('id', v_id, 'status', 'submitted');
end;
$$;

revoke all on function public.submit_expense_report(jsonb) from public, anon;
grant execute on function public.submit_expense_report(jsonb) to authenticated;
