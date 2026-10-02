-- Daily Sheet: one sheet per branch per Manila day replaces End of shift + Payroll + My pay.
-- BA saves/submits at POS; SA (or ASA with finance_view) approves/returns in Finance.
-- Approve posts paid expenses once per line (salaries → account 14) so finance_daily_pl picks them up.
-- Legacy shift_close_reports / payroll_* stay as read-only history (no drops).

-- ── Chart of accounts (Xero codes) ─────────────────────────────────────────
alter table public.expense_categories add column if not exists code text;
create unique index if not exists expense_categories_code_key on public.expense_categories (code) where code is not null;

-- Map legacy categories onto Xero accounts (keeps ids, so old expenses keep their account).
update public.expense_categories set name = 'Chemical and Other Inventory', code = '12', kind = 'chemicals', sort_order = 12 where name = 'Chemicals';
update public.expense_categories set name = 'Rent and Operating Utilities', code = '19', kind = 'utilities', sort_order = 19 where name = 'Utilities';
update public.expense_categories set name = 'Employee Salary and Incentives', code = '14', kind = 'payroll', sort_order = 14 where name = 'Payroll';
update public.expense_categories set name = 'Equipments and Tools', code = '15', kind = 'equipment', sort_order = 15 where name = 'Equipment';
update public.expense_categories set name = 'Marketing Expenses', code = '17', kind = 'marketing', sort_order = 17 where name = 'Marketing';
update public.expense_categories set name = 'Online Expenses and Others', code = '18', kind = 'general', sort_order = 18 where name = 'General';

insert into public.expense_categories (name, code, kind, sort_order, is_chemical) values
  ('Meals and Entertainment', '10', 'general', 10, false),
  ('Apparel Inventory', '11', 'general', 11, false),
  ('Chemical and Other Inventory', '12', 'chemicals', 12, true),
  ('Coffee and Other Supplies', '13', 'general', 13, false),
  ('Employee Salary and Incentives', '14', 'payroll', 14, false),
  ('Equipments and Tools', '15', 'equipment', 15, false),
  ('Labor and Repair Maintenance', '16', 'general', 16, false),
  ('Marketing Expenses', '17', 'marketing', 17, false),
  ('Online Expenses and Others', '18', 'general', 18, false),
  ('Rent and Operating Utilities', '19', 'utilities', 19, false),
  ('Shipping and/or Delivery Fees', '20', 'general', 20, false),
  ('Taxes and Accounting Fees', '21', 'general', 21, false)
on conflict (name) do update set code = excluded.code, kind = excluded.kind, sort_order = excluded.sort_order;

-- ── Team Lead (or any staff) daily rate used to prefill salary ─────────────
alter table public.staff_profiles
  add column if not exists daily_rate_minor integer not null default 0 check (daily_rate_minor >= 0);

-- Branch Admins / Team Leads may edit staff rows (RLS), but the rate prefills salaries, so only
-- Super Admin or ASA with finance write may set it. Service role / migrations (no auth.uid()) pass.
create or replace function public.guard_staff_daily_rate()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_super_admin() or public.asa_has_grant('finance_write') then
    return new;
  end if;
  if (tg_op = 'INSERT' and new.daily_rate_minor <> 0)
     or (tg_op = 'UPDATE' and new.daily_rate_minor is distinct from old.daily_rate_minor) then
    raise exception 'Only Super Admin or ASA with finance write can set a daily rate';
  end if;
  return new;
end;
$$;
drop trigger if exists staff_profiles_guard_daily_rate on public.staff_profiles;
create trigger staff_profiles_guard_daily_rate
  before insert or update on public.staff_profiles
  for each row execute function public.guard_staff_daily_rate();

-- ── Tables ─────────────────────────────────────────────────────────────────
create table if not exists public.daily_sheets (
  id uuid primary key default gen_random_uuid(),
  branch text not null references public.branches (slug),
  business_date date not null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'returned')),
  opening_float_minor integer check (opening_float_minor >= 0),
  counted_cash_minor integer check (counted_cash_minor >= 0),
  totals jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references public.staff_profiles (id) on delete set null,
  submitted_by uuid references public.staff_profiles (id) on delete set null,
  submitted_at timestamptz,
  reviewed_by uuid references public.staff_profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch, business_date)
);

create index if not exists daily_sheets_status_date_idx on public.daily_sheets (status, business_date desc);
create index if not exists daily_sheets_created_by_idx on public.daily_sheets (created_by);
create index if not exists daily_sheets_submitted_by_idx on public.daily_sheets (submitted_by);
create index if not exists daily_sheets_reviewed_by_idx on public.daily_sheets (reviewed_by);

create table if not exists public.daily_sheet_lines (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.daily_sheets (id) on delete cascade,
  kind text not null check (kind in ('expense', 'salary', 'ca_release', 'ca_repay')),
  staff_id uuid references public.staff_profiles (id) on delete set null,
  account_id uuid references public.expense_categories (id) on delete set null,
  description text,
  suggested_minor integer check (suggested_minor >= 0),
  amount_minor integer not null default 0 check (amount_minor >= 0),
  reason text,
  receipt_path text,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists daily_sheet_lines_sheet_idx on public.daily_sheet_lines (sheet_id, sort);
create index if not exists daily_sheet_lines_staff_idx on public.daily_sheet_lines (staff_id);
create index if not exists daily_sheet_lines_account_idx on public.daily_sheet_lines (account_id);

-- Idempotent posting: one expense per sheet line.
alter table public.expenses
  add column if not exists daily_sheet_line_id uuid references public.daily_sheet_lines (id) on delete set null;
create unique index if not exists expenses_daily_sheet_line_key on public.expenses (daily_sheet_line_id) where daily_sheet_line_id is not null;

-- Xero-style bills: the lines of one bill share vendor, date (created_at), reference and due date.
alter table public.expenses
  add column if not exists bill_reference text check (bill_reference is null or length(bill_reference) <= 80),
  add column if not exists due_date date;
create index if not exists expenses_bill_reference_idx on public.expenses (bill_reference) where bill_reference is not null;

-- ── RLS: reads only; every write goes through the security-definer RPCs ────
alter table public.daily_sheets enable row level security;
alter table public.daily_sheet_lines enable row level security;

drop policy if exists daily_sheets_select on public.daily_sheets;
create policy daily_sheets_select on public.daily_sheets for select to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('finance_view')
    or (
      public.current_user_role() in ('admin', 'assistant_super_admin')
      and public.user_has_branch_access(branch)
    )
  );

drop policy if exists daily_sheet_lines_select on public.daily_sheet_lines;
create policy daily_sheet_lines_select on public.daily_sheet_lines for select to authenticated
  using (exists (select 1 from public.daily_sheets s where s.id = sheet_id));

revoke all on public.daily_sheets, public.daily_sheet_lines from anon;
revoke insert, update, delete on public.daily_sheets, public.daily_sheet_lines from authenticated;
grant select on public.daily_sheets, public.daily_sheet_lines to authenticated;

-- ── Helpers ────────────────────────────────────────────────────────────────
create or replace function public.daily_sheet_can_edit(p_branch text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and (
    public.current_user_role() = 'BossMich'
    or (
      public.current_user_role() = 'admin'
      and public.user_has_branch_access(p_branch)
    )
    or (
      public.current_user_role() = 'assistant_super_admin'
      and (public.asa_has_grant('pos') or public.asa_has_grant('finance_write'))
      and public.user_has_branch_access(p_branch)
    )
  );
$$;

create or replace function public.daily_sheet_can_review()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and (
    public.current_user_role() = 'BossMich'
    or (public.current_user_role() = 'assistant_super_admin' and public.asa_has_grant('finance_view'))
  );
$$;

revoke all on function public.daily_sheet_can_edit(text) from public, anon;
revoke all on function public.daily_sheet_can_review() from public, anon;
grant execute on function public.daily_sheet_can_edit(text) to authenticated;
grant execute on function public.daily_sheet_can_review() to authenticated;

-- Server-side sales + cash numbers for one branch/day (same definitions as src/lib/dailySheet.js).
create or replace function public.daily_sheet_server_totals(p_sheet uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  s public.daily_sheets;
  v_gross bigint; v_disc bigint; v_ref bigint; v_net bigint; v_count bigint; v_cash bigint;
  v_exp bigint; v_sal bigint; v_rel bigint; v_rep bigint; v_expected bigint;
begin
  select * into s from public.daily_sheets where id = p_sheet;
  if s.id is null then return '{}'::jsonb; end if;
  select
    coalesce(sum(total_minor + coalesce(discount_minor, 0)), 0),
    coalesce(sum(coalesce(discount_minor, 0)), 0),
    coalesce(sum(total_minor) filter (where status = 'refunded'), 0),
    coalesce(sum(total_minor) filter (where status = 'paid'), 0),
    count(*) filter (where status = 'paid'),
    coalesce(sum(total_minor) filter (where status = 'paid' and lower(coalesce(payment_method, 'cash')) = 'cash'), 0)
  into v_gross, v_disc, v_ref, v_net, v_count, v_cash
  from public.sales
  where branch = s.branch
    and status in ('paid', 'refunded')
    and (occurred_at at time zone 'Asia/Manila')::date = s.business_date;
  select
    coalesce(sum(amount_minor) filter (where kind = 'expense'), 0),
    coalesce(sum(amount_minor) filter (where kind = 'salary'), 0),
    coalesce(sum(amount_minor) filter (where kind = 'ca_release'), 0),
    coalesce(sum(amount_minor) filter (where kind = 'ca_repay'), 0)
  into v_exp, v_sal, v_rel, v_rep
  from public.daily_sheet_lines where sheet_id = s.id;
  v_expected := coalesce(s.opening_float_minor, 0) + v_cash + v_rep - v_exp - v_sal - v_rel;
  return jsonb_build_object(
    'grossMinor', v_gross, 'discountsMinor', v_disc, 'refundsMinor', v_ref, 'netMinor', v_net,
    'count', v_count, 'cashMinor', v_cash,
    'expensesMinor', v_exp, 'salariesMinor', v_sal, 'totalExpensesMinor', v_exp + v_sal,
    'netProfitMinor', v_net - v_exp - v_sal,
    'caReleasedMinor', v_rel, 'caRepaidMinor', v_rep,
    'openingFloatMinor', coalesce(s.opening_float_minor, 0),
    'expectedCashMinor', v_expected,
    'countedCashMinor', s.counted_cash_minor,
    'overShortMinor', case when s.counted_cash_minor is null then null else s.counted_cash_minor - v_expected end
  );
end;
$$;

revoke all on function public.daily_sheet_server_totals(uuid) from public, anon, authenticated;

-- ── save_daily_sheet: BA draft/returned only, own branch; replaces lines ───
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
    if coalesce((v_line->>'amount_minor')::integer, 0) < 0 then
      raise exception 'Amounts cannot be negative';
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
      coalesce((v_line->>'amount_minor')::integer, 0),
      nullif(trim(coalesce(v_line->>'reason', '')), ''),
      nullif(v_line->>'receipt_path', ''),
      v_i
    );
    v_i := v_i + 1;
  end loop;

  return jsonb_build_object('id', v_id, 'status', v_status);
end;
$$;

-- ── submit_daily_sheet: server re-checks completeness + over/short note ────
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

-- ── review_daily_sheet: approve (posts paid expenses once) or return ──────
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

-- ── reopen_daily_sheet: SA only; voids posted rows, back to returned ──────
create or replace function public.reopen_daily_sheet(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid := auth.uid();
  v_id uuid := nullif(payload->>'id', '')::uuid;
  v_note text := nullif(trim(coalesce(payload->>'review_note', '')), '');
  s public.daily_sheets;
  v_voided integer := 0;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if public.current_user_role() is distinct from 'BossMich' then
    raise exception using errcode = '42501', message = 'Only Super Admin may reopen an approved sheet';
  end if;
  if v_note is null or char_length(v_note) < 3 then raise exception 'Reopen needs a note'; end if;
  select * into s from public.daily_sheets where id = v_id for update;
  if s.id is null then raise exception 'Daily sheet not found'; end if;
  if s.status <> 'approved' then raise exception 'Only approved sheets can be reopened'; end if;

  delete from public.expenses
  where daily_sheet_line_id in (select id from public.daily_sheet_lines where sheet_id = s.id);
  get diagnostics v_voided = row_count;

  update public.daily_sheets set
    status = 'returned', review_note = v_note, reviewed_by = caller, reviewed_at = now(), updated_at = now()
  where id = s.id;

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, summary, meta)
  values (caller, 'BossMich', 'daily_sheet.reopen', 'daily_sheets', s.id::text, 'Reopened daily sheet',
    jsonb_build_object('branch', s.branch, 'business_date', s.business_date, 'voided', v_voided, 'note', v_note));

  return jsonb_build_object('id', s.id, 'status', 'returned', 'voided', v_voided);
end;
$$;

revoke all on function public.save_daily_sheet(jsonb) from public, anon;
revoke all on function public.submit_daily_sheet(jsonb) from public, anon;
revoke all on function public.review_daily_sheet(jsonb) from public, anon;
revoke all on function public.reopen_daily_sheet(jsonb) from public, anon;
grant execute on function public.save_daily_sheet(jsonb) to authenticated;
grant execute on function public.submit_daily_sheet(jsonb) to authenticated;
grant execute on function public.review_daily_sheet(jsonb) to authenticated;
grant execute on function public.reopen_daily_sheet(jsonb) to authenticated;

-- ── Receipt photos: private bucket, path = {branch}/{business_date}/{file} ─
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('daily-sheet-receipts', 'daily-sheet-receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

drop policy if exists daily_sheet_receipts_select on storage.objects;
create policy daily_sheet_receipts_select on storage.objects for select to authenticated
  using (
    bucket_id = 'daily-sheet-receipts'
    and (public.daily_sheet_can_review() or public.daily_sheet_can_edit(split_part(name, '/', 1)))
  );

drop policy if exists daily_sheet_receipts_insert on storage.objects;
create policy daily_sheet_receipts_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'daily-sheet-receipts'
    and public.daily_sheet_can_edit(split_part(name, '/', 1))
  );

-- ── Retire payroll + End of shift writes (tables kept as history) ─────────
revoke execute on function public.run_payroll(jsonb) from authenticated, public, anon;
revoke execute on function public.submit_shift_close(jsonb) from authenticated, public, anon;
revoke execute on function public.review_shift_close(jsonb) from authenticated, public, anon;
revoke insert, update, delete on public.payroll_runs, public.payroll_run_lines, public.payroll_run_sales from authenticated, anon;
revoke insert, update, delete on public.shift_close_reports from authenticated, anon;
