-- On Finance accept of end-of-shift: notify SA + ASA with finance_write (in-app inbox).
-- Aligns with MONEY-CONTRACT: accept unlocks pending floor; SA/ASA confirm payroll (no auto-pay).

create or replace function public.review_shift_close(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid := auth.uid();
  caller_role text;
  v_id uuid := (payload->>'id')::uuid;
  v_action text := lower(nullif(trim(coalesce(payload->>'action', '')), ''));
  v_note text := nullif(trim(coalesce(payload->>'review_note', '')), '');
  v_status text;
  v_next text;
  v_branch text;
  v_date date;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  caller_role := public.current_user_role();
  if caller_role is distinct from 'BossMich'
     and not (
       caller_role = 'assistant_super_admin'
       and public.asa_has_grant('finance_view')
     ) then
    raise exception using errcode = '42501',
      message = 'Only Super Admin or ASA with finance view may review shift close';
  end if;
  if v_id is null or v_action not in ('accept', 'reject', 'lock') then
    raise exception 'id and action (accept|reject|lock) are required';
  end if;
  if v_action = 'reject' and v_note is null then
    raise exception 'Reject requires a review note';
  end if;

  select status, branch, business_date
    into v_status, v_branch, v_date
  from public.shift_close_reports
  where id = v_id
  for update;
  if v_status is null then
    raise exception 'Shift close report not found';
  end if;
  if v_status = 'locked' and v_action is distinct from 'lock' then
    raise exception 'Report is locked';
  end if;
  if v_action = 'accept' then v_next := 'accepted';
  elsif v_action = 'reject' then v_next := 'rejected';
  else v_next := 'locked';
  end if;
  if v_action = 'lock' and v_status is distinct from 'accepted' and v_status is distinct from 'locked' then
    raise exception 'Only accepted reports can be locked';
  end if;
  if v_action in ('accept', 'reject') and v_status is distinct from 'submitted' then
    raise exception 'Only submitted reports can be accepted or rejected';
  end if;

  update public.shift_close_reports set
    status = v_next,
    review_note = coalesce(v_note, review_note),
    reviewed_by = caller,
    reviewed_at = now(),
    updated_at = now()
  where id = v_id;

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, summary, meta)
  values (
    caller, caller_role, 'shift_close.review', 'shift_close_reports', v_id::text,
    'Reviewed end-of-shift close',
    jsonb_build_object('action', v_action, 'status', v_next, 'branch', v_branch, 'business_date', v_date)
  );

  if v_action = 'accept' then
    insert into public.user_notifications (user_id, kind, title, body, url, tag)
    select
      sp.id,
      'payroll.pending_floor',
      'Floor pay ready · ' || coalesce(v_branch, 'branch'),
      'End of shift accepted for ' || coalesce(v_branch, '?') || ' · ' || coalesce(v_date::text, '?')
        || '. Confirm floor payroll on Payroll (does not auto-pay).',
      '/operations/payroll',
      'shift_close:' || v_id::text
    from public.staff_profiles sp
    where coalesce(sp.is_active, true)
      and (
        sp.role = 'BossMich'
        or (
          sp.role = 'assistant_super_admin'
          and coalesce((sp.permission_grants->>'finance_write')::boolean, false)
        )
      )
      and sp.id is distinct from caller;
  end if;

  return jsonb_build_object('id', v_id, 'status', v_next, 'branch', v_branch, 'business_date', v_date);
end;
$$;

revoke all on function public.review_shift_close(jsonb) from public, anon;
grant execute on function public.review_shift_close(jsonb) to authenticated;

update public.compensation_settings
set pending_floor_optional = false,
    cash_advance_auto_deduct = false
where id = 1;
