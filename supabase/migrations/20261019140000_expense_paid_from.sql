-- Per-line cash vs GCash on Daily Sheet expenses (+ copy onto posted expenses).
-- GCash-paid expenses still hit P&L on approve but do not reduce expected drawer cash.

alter table public.daily_sheet_lines
  add column if not exists paid_from text;

alter table public.daily_sheet_lines
  drop constraint if exists daily_sheet_lines_paid_from_check;

alter table public.daily_sheet_lines
  add constraint daily_sheet_lines_paid_from_check
  check (paid_from is null or paid_from in ('cash', 'gcash'));

alter table public.expenses
  add column if not exists paid_from text;

alter table public.expenses
  drop constraint if exists expenses_paid_from_check;

alter table public.expenses
  add constraint expenses_paid_from_check
  check (paid_from is null or paid_from in ('cash', 'gcash'));

comment on column public.daily_sheet_lines.paid_from is 'expense lines: cash (drawer) or gcash; null/other kinds ignored';
comment on column public.expenses.paid_from is 'How the expense was paid: cash or gcash';

-- save_daily_sheet: keep cash-advance assert + duplicate-code guard; persist paid_from.
create or replace function public.save_daily_sheet(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public
as $function$
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
  v_paid text;
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
    v_paid := lower(nullif(trim(coalesce(v_line->>'paid_from', '')), ''));
    if v_kind = 'expense' then
      if v_paid is null then v_paid := 'cash'; end if;
      if v_paid not in ('cash', 'gcash') then
        raise exception 'Expense paid_from must be cash or gcash';
      end if;
    else
      v_paid := null;
    end if;
    insert into public.daily_sheet_lines (
      id, sheet_id, kind, staff_id, account_id, description, suggested_minor, amount_minor, reason, receipt_path, paid_from, sort
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
      v_paid,
      v_i
    );
    v_i := v_i + 1;
  end loop;

  return jsonb_build_object('id', v_id, 'status', v_status);
end;
$function$;


-- review_daily_sheet: same live body + paid_from on posted expenses (keeps BUG-085 SoD).
create or replace function public.review_daily_sheet(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public
as $function$
declare
  caller uuid := auth.uid();
  v_id uuid := nullif(payload->>'id', '')::uuid;
  v_action text := lower(coalesce(payload->>'action', ''));
  v_note text := nullif(trim(coalesce(payload->>'review_note', '')), '');
  s public.daily_sheets;
  v_salary_account uuid;
  v_posted integer := 0;
  v_cleared integer := 0;
  v_stamp timestamptz;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if not public.daily_sheet_can_review() then
    raise exception using errcode = '42501', message = 'Only Super Admin or ASA with finance view may approve daily sheets';
  end if;
  if v_action not in ('approve', 'return') then raise exception 'action must be approve or return'; end if;
  if v_action = 'return' and (v_note is null or char_length(v_note) < 3) then
    raise exception 'Return needs a note for the Branch Admin';
  end if;

  select * into s from public.daily_sheets where id = v_id for update;
  if s.id is null then raise exception 'Daily sheet not found'; end if;
  if s.status = 'approved' and v_action = 'approve' then
    return jsonb_build_object('id', s.id, 'status', 'approved', 'posted', 0);
  end if;
  if s.status <> 'submitted' then raise exception 'Only submitted sheets can be reviewed'; end if;

  if v_action = 'approve'
     and s.submitted_by is not null
     and s.submitted_by = caller
     and public.current_user_role() is distinct from 'BossMich' then
    raise exception using
      errcode = '42501',
      message = 'You cannot approve a daily sheet you submitted yourself';
  end if;

  if v_action = 'approve' then
    select id into v_salary_account from public.expense_categories where code = '14';
    v_stamp := (s.business_date + time '12:00') at time zone 'Asia/Manila';
    insert into public.expenses (
      title, description, quantity, unit_cost_minor, total_minor, branch, category_id, attachment_path,
      status, created_by, approved_by, paid_by, expense_kind, daily_sheet_line_id, paid_from, created_at, updated_at
    )
    select
      case when l.kind = 'salary' then 'Salary · ' || coalesce(sp.full_name, 'staff') else l.description end,
      'daily_sheet:' || s.id::text || ':' || l.id::text,
      1, l.amount_minor, l.amount_minor, s.branch,
      case when l.kind = 'salary' then v_salary_account else l.account_id end,
      l.receipt_path,
      'paid', s.submitted_by, caller, caller,
      case when l.kind = 'salary' then (case when sp.role::text = 'detailer' then 'salary_detailer' else 'salary_carwash' end) else 'daily' end,
      l.id,
      case when l.kind = 'expense' then coalesce(l.paid_from, 'cash') else 'cash' end,
      v_stamp, now()
    from public.daily_sheet_lines l
    left join public.staff_profiles sp on sp.id = l.staff_id
    where l.sheet_id = s.id and l.kind in ('expense', 'salary') and l.amount_minor > 0
    on conflict (daily_sheet_line_id) where daily_sheet_line_id is not null do nothing;
    get diagnostics v_posted = row_count;

    delete from public.expenses
    where branch = s.branch and status = 'draft' and daily_sheet_line_id is null
      and description ~* '^(ceramic|detailing):'
      and (created_at at time zone 'Asia/Manila')::date = s.business_date;
    get diagnostics v_cleared = row_count;
  end if;

  update public.daily_sheets set
    status = case when v_action = 'approve' then 'approved' else 'returned' end,
    review_note = case when v_action = 'return' then v_note else coalesce(v_note, review_note) end,
    reviewed_by = caller,
    reviewed_at = now(),
    updated_at = now()
  where id = s.id;

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, summary, meta)
  values (caller, public.current_user_role(), 'daily_sheet.' || v_action, 'daily_sheets', s.id::text,
    case when v_action = 'approve' then 'Approved daily sheet' else 'Returned daily sheet' end,
    jsonb_build_object('branch', s.branch, 'business_date', s.business_date, 'posted', v_posted, 'cleared_drafts', v_cleared, 'note', v_note));

  return jsonb_build_object('id', s.id, 'status', case when v_action = 'approve' then 'approved' else 'returned' end, 'posted', v_posted);
end;
$function$;
