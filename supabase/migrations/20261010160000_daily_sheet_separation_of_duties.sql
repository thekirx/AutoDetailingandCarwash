-- BUG-085: a daily sheet could be approved by the person who submitted it.
--
-- review_daily_sheet (20261001090000_daily_sheet.sql) separates ROLES but never
-- separates PEOPLE. It checks that the caller may review, that the action is
-- legitimate, and that the sheet is in 'submitted' — then approves. Nothing in
-- it compares the caller to s.submitted_by.
--
-- Role separation alone is not a control here, because a single identity can
-- satisfy both roles at once. daily_sheet_can_edit() admits an ASA holding
-- 'pos' or 'finance_write'; daily_sheet_can_review() admits an ASA holding
-- 'finance_view'. And asa_has_grant() denies only three keys when the key is
-- ABSENT:
--
--   when grant_key in ('finance_write', 'planning_edit', 'rbac_edit') then false
--   else true
--
-- 'pos' and 'finance_view' are not on that list, so they default to true, which
-- matches DEFAULT_ASSISTANT_GRANTS in src/auth/permissions.js (pos: true,
-- finance_view: true). A default ASA therefore holds both, and could:
--
--   1. save_daily_sheet      -> writes the expense lines it wants in the books
--   2. submit_daily_sheet    -> sets submitted_by = itself
--   3. review_daily_sheet    -> approve
--
-- producing expense rows with created_by and approved_by set to the same UUID.
-- The audit trail still records 'Approved daily sheet' by a named reviewer, so
-- the books read as independently reviewed while nothing independent happened.
--
-- The guard is scoped as narrowly as the defect allows:
--
--   * It fires on 'approve' only. Returning a sheet you filed is how a Branch
--     Admin corrects it; blocking that would strand a returned sheet with no
--     path back, since submit_daily_sheet is the only way out of 'returned'.
--
--   * BossMich is exempt. Not as a concession: if the owner were blocked too, a
--     sheet the owner filed would sit at 'submitted' forever. reopen_daily_sheet
--     accepts only 'approved' sheets, so there would be no recovery path at all
--     in a shop with no second reviewer. The owner's discretion over the books
--     is also the thing the role exists to exercise.
--
--   * The comparison reads s.submitted_by off the locked server row. A guard
--     keyed on payload->>'submitted_by' would be decided by the caller.
--
-- The Super Admin-only reopen path is untouched, so an approved sheet is still
-- reversible by the owner with a note.
--
-- Guards: aborts if review_daily_sheet is missing or has drifted from the body
-- this migration read, so running it against a database this team has already
-- changed does nothing rather than silently reverting someone else's fix.

begin;

do $$
declare
  v_def text;
  v_missing text;
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'review_daily_sheet'
  ) then
    raise exception 'public.review_daily_sheet(jsonb) is missing — refusing to guess at a function this migration has not read';
  end if;

  v_def := pg_get_functiondef('public.review_daily_sheet(jsonb)'::regprocedure);

  -- Every guard below is carried forward verbatim by the replacement. If one has
  -- gone missing, someone changed this function after 20261001090000 and writing
  -- our copy back would quietly undo their fix.
  v_missing := array_to_string(array_remove(ARRAY[
    case when v_def like '%caller is null%' then null else 'auth check' end,
    case when v_def like '%daily_sheet_can_review()%' then null else 'reviewer predicate' end,
    case when v_def like '%action must be approve or return%' then null else 'action whitelist' end,
    case when v_def like '%Return needs a note%' then null else 'return-note rule' end,
    case when v_def like '%Daily sheet not found%' then null else 'missing-sheet rule' end,
    case when v_def like '%Only submitted sheets can be reviewed%' then null else 'status gate' end,
    case when v_def like '%on conflict (daily_sheet_line_id)%' then null else 'double-post guard' end,
    case when v_def like '%audit_logs%' then null else 'audit log write' end
  ], null), ', ');

  if v_missing is not null then
    raise exception 'review_daily_sheet has drifted from the body this migration verified — missing: %', v_missing;
  end if;

  if v_def like '%you submitted yourself%' then
    raise notice 'review_daily_sheet already refuses self-approval; replacement will be a no-op';
  end if;
end $$;

create or replace function public.review_daily_sheet(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
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

  -- BUG-085: separation of duties. A reviewer must not be the submitter, or the
  -- approval is a signature over their own work and the books carry a review that
  -- never happened. Super Admin is exempt — see the header. Returning your own
  -- sheet stays allowed; that is rework, not an approval.
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
      status, created_by, approved_by, paid_by, expense_kind, daily_sheet_line_id, created_at, updated_at
    )
    select
      case when l.kind = 'salary' then 'Salary · ' || coalesce(sp.full_name, 'staff') else l.description end,
      'daily_sheet:' || s.id::text || ':' || l.id::text,
      1, l.amount_minor, l.amount_minor, s.branch,
      case when l.kind = 'salary' then v_salary_account else l.account_id end,
      l.receipt_path,
      'paid', s.submitted_by, caller, caller,
      case when l.kind = 'salary' then (case when sp.role::text = 'detailer' then 'salary_detailer' else 'salary_carwash' end) else 'daily' end,
      l.id, v_stamp, now()
    from public.daily_sheet_lines l
    left join public.staff_profiles sp on sp.id = l.staff_id
    where l.sheet_id = s.id and l.kind in ('expense', 'salary') and l.amount_minor > 0
    on conflict (daily_sheet_line_id) where daily_sheet_line_id is not null do nothing;
    get diagnostics v_posted = row_count;

    -- Checkout detailing drafts are replaced by the sheet's salary lines.
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
$$;

commit;

-- After:
--   a Branch Admin files the sheet and cannot approve it (unchanged);
--   an ASA who filed a sheet is refused when they try to approve it, and the
--     error names the reason instead of surfacing as a generic save failure;
--   an ASA reviewing someone else's sheet is unaffected;
--   returning your own sheet, and resubmitting it, still work end to end;
--   the Super Admin retains self-approval, which is the only reviewer path in a
--     shop that has one, and retains reopen_daily_sheet as the undo.
--
-- Existing approvals are not disturbed — no sheet is rewritten by this migration.
-- A sheet already approved by its own submitter stays approved; reopen it
-- (Super Admin, with a note) if that needs unwinding.