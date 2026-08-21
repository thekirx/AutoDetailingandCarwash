-- Expense report approve → pending_payment (not paid). SA marks paid when cash actually leaves.
-- expenses.status already allows pending_payment (phase1 check constraint).

create or replace function public.review_expense_report(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid := auth.uid();
  caller_role text;
  v_id uuid := (payload->>'id')::uuid;
  v_action text := lower(coalesce(payload->>'action', ''));
  v_note text := nullif(trim(coalesce(payload->>'review_note', '')), '');
  v_status text;
  v_next text;
  v_expense_status text;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  caller_role := public.current_user_role();
  if caller_role is distinct from 'BossMich' then
    raise exception using errcode = '42501', message = 'Only Super Admin may approve expense reports';
  end if;
  -- approve: pending_payment (default). approve_paid: paid now. mark_paid: approved → paid. reject.
  if v_action not in ('approve', 'approve_paid', 'mark_paid', 'reject') then
    raise exception 'action must be approve, approve_paid, mark_paid, or reject';
  end if;
  if v_action = 'reject' and v_note is null then raise exception 'Reject requires a note'; end if;

  select status into v_status from public.expense_reports where id = v_id for update;
  if v_status is null then raise exception 'Expense report not found'; end if;

  if v_action = 'mark_paid' then
    if v_status is distinct from 'approved' then
      raise exception 'Only approved reports can be marked paid';
    end if;
    update public.expenses e
    set status = 'paid',
        paid_by = caller,
        updated_at = now()
    from public.expense_report_lines l
    where l.report_id = v_id
      and l.expense_id = e.id
      and e.status = 'pending_payment';

    update public.expense_reports set
      updated_at = now()
    where id = v_id;

    insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, summary, meta)
    values (
      caller, caller_role, 'expense_report.mark_paid', 'expense_reports', v_id::text,
      'Marked expense report paid', '{}'::jsonb
    );

    return jsonb_build_object('id', v_id, 'status', 'approved', 'expense_status', 'paid');
  end if;

  if v_status is distinct from 'submitted' then
    raise exception 'Only submitted reports can be reviewed';
  end if;

  v_next := case when v_action = 'reject' then 'rejected' else 'approved' end;
  v_expense_status := case
    when v_action = 'approve_paid' then 'paid'
    when v_action = 'approve' then 'pending_payment'
    else null
  end;

  if v_action in ('approve', 'approve_paid') then
    update public.expenses e
    set status = v_expense_status,
        approved_by = caller,
        paid_by = case when v_expense_status = 'paid' then caller else paid_by end,
        updated_at = now()
    from public.expense_report_lines l
    where l.report_id = v_id
      and l.expense_id = e.id
      and e.status is distinct from 'paid'
      and e.status is distinct from 'posted';
  end if;

  update public.expense_reports set
    status = v_next,
    review_note = coalesce(v_note, review_note),
    reviewed_by = caller,
    reviewed_at = now(),
    updated_at = now()
  where id = v_id;

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, summary, meta)
  values (
    caller, caller_role, 'expense_report.review', 'expense_reports', v_id::text,
    'Reviewed expense report',
    jsonb_build_object('action', v_action, 'expense_status', v_expense_status)
  );

  return jsonb_build_object(
    'id', v_id,
    'status', v_next,
    'expense_status', v_expense_status
  );
end;
$$;

revoke all on function public.review_expense_report(jsonb) from public, anon;
grant execute on function public.review_expense_report(jsonb) to authenticated;

-- Partial index for Purchases filter on awaiting payment (query-partial-indexes)
create index if not exists expenses_pending_payment_idx
  on public.expenses (branch, created_at desc)
  where status = 'pending_payment';
