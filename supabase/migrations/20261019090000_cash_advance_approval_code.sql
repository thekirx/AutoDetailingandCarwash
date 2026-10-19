-- Cash advance: SA/ASA approve mints a code. A given-out Daily Sheet line
-- must carry that code before drawer cash is recorded.

create or replace function public.assert_cash_advance_release(
  p_branch text,
  p_reason text,
  p_amount integer,
  p_sheet uuid
) returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_code text := upper(trim(coalesce(p_reason, '')));
begin
  if v_code !~ '^CA[A-Z0-9]{4}$' then
    raise exception 'Type the approval code before cash leaves the drawer.';
  end if;
  if exists (
    select 1
    from public.daily_sheet_lines l
    join public.daily_sheets sh on sh.id = l.sheet_id
    where l.kind = 'ca_release'
      and l.amount_minor > 0
      and upper(trim(coalesce(l.reason, ''))) = v_code
      and sh.id is distinct from p_sheet
  ) then
    raise exception 'That approval code was already used on another daily sheet.';
  end if;
  if (
    select count(*)
    from public.daily_sheet_lines l
    where l.sheet_id = p_sheet
      and l.kind = 'ca_release'
      and l.amount_minor > 0
      and upper(trim(coalesce(l.reason, ''))) = v_code
  ) > 1 then
    raise exception 'That approval code is already on this sheet.';
  end if;
  if not exists (
    select 1
    from public.ops_form_submissions s
    join public.ops_forms f on f.id = s.form_id
    where f.kind = 'cash_advance'
      and s.status = 'resolved'
      and upper(coalesce(s.payload->>'approval_code', '')) = v_code
      and lower(coalesce(s.payload->>'branch', '')) = lower(p_branch)
      and round((s.payload->>'amount')::numeric * 100)::integer = p_amount
  ) then
    raise exception 'That approval code does not match an approved cash advance for this branch and amount.';
  end if;
end;
$$;

revoke all on function public.assert_cash_advance_release(text, text, integer, uuid) from public, anon;
grant execute on function public.assert_cash_advance_release(text, text, integer, uuid) to authenticated;

create or replace function public.approve_cash_advance(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid := auth.uid();
  v_id uuid := nullif(payload->>'id', '')::uuid;
  v_action text := lower(coalesce(payload->>'action', ''));
  sub public.ops_form_submissions;
  v_kind text;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_i integer;
  v_n integer;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if public.current_user_role() not in ('BossMich', 'assistant_super_admin') then
    raise exception using errcode = '42501', message = 'Only Super Admin or Assistant Super Admin can approve a cash advance';
  end if;
  if v_action not in ('approve', 'decline') then raise exception 'action must be approve or decline'; end if;

  select s.* into sub
  from public.ops_form_submissions s
  where s.id = v_id
  for update;
  if sub.id is null then raise exception 'Cash advance not found'; end if;
  select f.kind into v_kind from public.ops_forms f where f.id = sub.form_id;
  if v_kind is distinct from 'cash_advance' then raise exception 'Not a cash advance'; end if;

  if v_action = 'decline' then
    update public.ops_form_submissions set status = 'archived' where id = sub.id;
    insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, summary, meta)
    values (caller, public.current_user_role(), 'cash_advance.decline', 'ops_form_submissions', sub.id::text, 'Declined cash advance', '{}'::jsonb);
    return jsonb_build_object('id', sub.id, 'status', 'archived');
  end if;

  v_code := nullif(upper(trim(coalesce(sub.payload->>'approval_code', ''))), '');
  if v_code is null then
    loop
      v_code := 'CA';
      for v_i in 1..4 loop
        v_n := 1 + floor(random() * length(v_alphabet))::int;
        v_code := v_code || substr(v_alphabet, v_n, 1);
      end loop;
      exit when not exists (
        select 1 from public.ops_form_submissions existing
        where upper(coalesce(existing.payload->>'approval_code', '')) = v_code
      );
    end loop;
  end if;

  update public.ops_form_submissions set
    status = 'resolved',
    payload = sub.payload || jsonb_build_object(
      'approval_code', v_code,
      'approved_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'approved_by', caller
    )
  where id = sub.id;

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, summary, meta)
  values (
    caller, public.current_user_role(), 'cash_advance.approve', 'ops_form_submissions', sub.id::text,
    'Approved cash advance', jsonb_build_object('approval_code', v_code)
  );

  return jsonb_build_object('id', sub.id, 'status', 'resolved', 'approval_code', v_code);
end;
$$;

revoke all on function public.approve_cash_advance(jsonb) from public, anon;
grant execute on function public.approve_cash_advance(jsonb) to authenticated;

-- save_daily_sheet: same body as 20261001090000, plus the code check on given-out lines.
create or replace function public.save_daily_sheet(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid := auth.uid();
  v_branch text := nullif(trim(coalesce(payload->>'branch', '')), '');
  v_date date := nullif(payload->>'business_date', '')::date;
  v_lines jsonb := coalesce(payload->'lines', '[]'::jsonb);
  v_id uuid;
  v_status text;
  v_line jsonb;
  v_kind text;
  v_amount integer;
  v_code text;
  v_seen text[] := '{}';
  v_i integer := 0;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if v_branch is null or v_date is null then raise exception 'Branch and business date are required'; end if;
  if not public.daily_sheet_can_edit(v_branch) then
    raise exception using errcode = '42501', message = 'Daily sheet is limited to your branch';
  end if;
  if jsonb_typeof(v_lines) is distinct from 'array' then raise exception 'lines must be an array'; end if;

  select id, status into v_id, v_status from public.daily_sheets
  where branch = v_branch and business_date = v_date for update;
  if v_status in ('submitted', 'approved') then
    raise exception 'This sheet is % — it can no longer be edited', v_status;
  end if;

  if v_id is null then
    insert into public.daily_sheets (branch, business_date, created_by)
    values (v_branch, v_date, caller) returning id into v_id;
    v_status := 'draft';
  end if;

  update public.daily_sheets set
    opening_float_minor = nullif(payload->>'opening_float_minor', '')::integer,
    counted_cash_minor = nullif(payload->>'counted_cash_minor', '')::integer,
    notes = nullif(trim(coalesce(payload->>'notes', '')), ''),
    totals = coalesce(payload->'totals', totals),
    updated_at = now()
  where id = v_id;

  delete from public.daily_sheet_lines where sheet_id = v_id;
  for v_line in select * from jsonb_array_elements(v_lines) loop
    v_kind := v_line->>'kind';
    if v_kind not in ('expense', 'salary', 'ca_release', 'ca_repay') then
      raise exception 'Unknown line kind %', v_kind;
    end if;
    v_amount := coalesce((v_line->>'amount_minor')::integer, 0);
    if v_amount < 0 then
      raise exception 'Amounts cannot be negative';
    end if;
    if v_kind = 'ca_release' and v_amount > 0 then
      v_code := upper(trim(coalesce(v_line->>'reason', '')));
      if v_code = any(v_seen) then
        raise exception 'That approval code is already on this sheet.';
      end if;
      v_seen := v_seen || v_code;
      perform public.assert_cash_advance_release(v_branch, v_line->>'reason', v_amount, v_id);
    end if;
    insert into public.daily_sheet_lines (
      id, sheet_id, kind, staff_id, account_id, description, suggested_minor, amount_minor, reason, receipt_path, sort
    ) values (
      coalesce(nullif(v_line->>'id', '')::uuid, gen_random_uuid()),
      v_id,
      v_kind,
      nullif(v_line->>'staff_id', '')::uuid,
      nullif(v_line->>'account_id', '')::uuid,
      nullif(trim(coalesce(v_line->>'description', '')), ''),
      case when v_kind = 'salary' then greatest(coalesce((v_line->>'suggested_minor')::integer, 0), 0) end,
      v_amount,
      nullif(trim(coalesce(v_line->>'reason', '')), ''),
      nullif(v_line->>'receipt_path', ''),
      v_i
    );
    v_i := v_i + 1;
  end loop;

  return jsonb_build_object('id', v_id, 'status', v_status);
end;
$$;

-- submit_daily_sheet: same body as 20261001090000, plus a re-check of given-out codes.
create or replace function public.submit_daily_sheet(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid := auth.uid();
  v_id uuid := nullif(payload->>'id', '')::uuid;
  s public.daily_sheets;
  v_totals jsonb;
  v_bad integer;
  v_line public.daily_sheet_lines;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select * into s from public.daily_sheets where id = v_id for update;
  if s.id is null then raise exception 'Daily sheet not found'; end if;
  if not public.daily_sheet_can_edit(s.branch) then
    raise exception using errcode = '42501', message = 'Daily sheet is limited to your branch';
  end if;
  if s.status not in ('draft', 'returned') then
    raise exception 'Only draft or returned sheets can be submitted';
  end if;
  if s.opening_float_minor is null then raise exception 'Enter the opening float'; end if;
  if s.counted_cash_minor is null then raise exception 'Count the cash in the drawer'; end if;

  select count(*) into v_bad from public.daily_sheet_lines
  where sheet_id = s.id and (
    (kind = 'expense' and (description is null or account_id is null or amount_minor <= 0))
    or (kind = 'salary' and (staff_id is null or (amount_minor is distinct from suggested_minor and reason is null)))
    or (kind in ('ca_release', 'ca_repay') and (staff_id is null or amount_minor <= 0))
  );
  if v_bad > 0 then
    raise exception 'Finish % line(s): expenses need what/account/amount, changed salaries need a reason, cash advances need staff and amount', v_bad;
  end if;

  for v_line in
    select * from public.daily_sheet_lines
    where sheet_id = s.id and kind = 'ca_release' and amount_minor > 0
  loop
    perform public.assert_cash_advance_release(s.branch, v_line.reason, v_line.amount_minor, s.id);
  end loop;

  v_totals := public.daily_sheet_server_totals(s.id);
  if coalesce((v_totals->>'overShortMinor')::bigint, 0) <> 0 and s.notes is null then
    raise exception 'Cash is over or short — add a note before submitting';
  end if;

  update public.daily_sheets set
    status = 'submitted',
    totals = coalesce(s.totals, '{}'::jsonb) || v_totals,
    submitted_by = caller,
    submitted_at = now(),
    updated_at = now()
  where id = s.id;

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, summary, meta)
  values (caller, public.current_user_role(), 'daily_sheet.submit', 'daily_sheets', s.id::text,
    'Submitted daily sheet', jsonb_build_object('branch', s.branch, 'business_date', s.business_date, 'totals', v_totals));

  return jsonb_build_object('id', s.id, 'status', 'submitted', 'totals', v_totals);
end;
$$;
