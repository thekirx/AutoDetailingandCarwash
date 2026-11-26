-- Deep system audit fixes (2026-11-26):
-- 1) review_daily_sheet: preserve daily_sheet_lines.paid_from ('cash' | 'gcash') for salary lines in posted expenses
-- 2) daily_sheet_server_totals: exclude refunded sales from v_gross and v_disc (status = 'paid' only)
-- 3) daily_sales_summary view: include card/credit/debit/bank tender variants in online/card buckets
-- 4) send_payslip & update_office_payslip: anchor payslip expense created_at to payroll period end (Manila noon) & ASA parity
-- 5) cash_advance_ledger: allow 'all' branch query for ASA with branches_all + finance/pos grant
-- 6) booking_payable_minor & bookings_friend_referral_before: prefer discounted final_price_minor & normalize NAME-XXX / HKXXXXXX friend codes

create or replace function public.review_daily_sheet(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
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
      coalesce(nullif(lower(btrim(l.paid_from)), ''), 'cash'),
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

-- Backfill any salary expenses previously forced to 'cash' when the daily sheet line used GCash
update public.expenses e
set paid_from = lower(btrim(l.paid_from)),
    updated_at = now()
from public.daily_sheet_lines l
where e.daily_sheet_line_id = l.id
  and l.kind = 'salary'
  and lower(btrim(coalesce(l.paid_from, ''))) in ('cash', 'gcash')
  and e.paid_from is distinct from lower(btrim(l.paid_from));

create or replace function public.daily_sheet_server_totals(p_sheet uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  s public.daily_sheets;
  v_gross bigint; v_disc bigint; v_ref bigint; v_net bigint; v_count bigint;
  v_cash bigint; v_gcash bigint; v_credit bigint;
  v_exp bigint; v_cash_exp bigint; v_gcash_exp bigint;
  v_sal bigint; v_sal_cash bigint; v_sal_gcash bigint;
  v_rel bigint; v_rel_cash bigint; v_rel_gcash bigint;
  v_rep bigint; v_rep_cash bigint; v_rep_gcash bigint;
  v_cash_txn bigint; v_gcash_txn bigint;
  v_cash_left bigint; v_gcash_left bigint; v_expected bigint;
begin
  select * into s from public.daily_sheets where id = p_sheet;
  if s.id is null then return '{}'::jsonb; end if;

  select
    coalesce(sum(total_minor + coalesce(discount_minor, 0)) filter (where status = 'paid'), 0),
    coalesce(sum(coalesce(discount_minor, 0)) filter (where status = 'paid'), 0),
    coalesce(sum(total_minor) filter (where status = 'refunded'), 0),
    coalesce(sum(total_minor) filter (where status = 'paid'), 0),
    count(*) filter (where status = 'paid'),
    coalesce(sum(
      case
        when status = 'paid' and lower(btrim(coalesce(payment_method, ''))) = 'split'
          then coalesce(cash_minor, 0)
        when status = 'paid'
          and lower(coalesce(nullif(btrim(payment_method), ''), 'cash')) = 'cash'
          then total_minor
        else 0
      end
    ), 0),
    coalesce(sum(
      case
        when status = 'paid' and lower(btrim(coalesce(payment_method, ''))) = 'split'
          then coalesce(gcash_minor, 0)
        when status = 'paid'
          and lower(btrim(coalesce(payment_method, ''))) in ('gcash', 'g-cash')
          then total_minor
        else 0
      end
    ), 0),
    coalesce(sum(total_minor) filter (
      where status = 'paid'
        and lower(btrim(coalesce(payment_method, ''))) in (
          'card', 'credit', 'credit_card', 'debit', 'debit_card', 'credit_debit', 'credit/debit',
          'online', 'bank', 'transfer'
        )
    ), 0)
  into v_gross, v_disc, v_ref, v_net, v_count, v_cash, v_gcash, v_credit
  from public.sales
  where branch = s.branch
    and status in ('paid', 'refunded')
    and (occurred_at at time zone 'Asia/Manila')::date = s.business_date;

  select
    coalesce(sum(amount_minor) filter (where kind = 'expense'), 0),
    coalesce(sum(amount_minor) filter (
      where kind = 'expense' and lower(coalesce(nullif(btrim(paid_from), ''), 'cash')) = 'cash'
    ), 0),
    coalesce(sum(amount_minor) filter (
      where kind = 'expense' and lower(coalesce(nullif(btrim(paid_from), ''), 'cash')) = 'gcash'
    ), 0),
    coalesce(sum(amount_minor) filter (where kind = 'salary'), 0),
    coalesce(sum(amount_minor) filter (
      where kind = 'salary' and lower(coalesce(nullif(btrim(paid_from), ''), 'cash')) = 'cash'
    ), 0),
    coalesce(sum(amount_minor) filter (
      where kind = 'salary' and lower(btrim(coalesce(paid_from, ''))) = 'gcash'
    ), 0),
    coalesce(sum(amount_minor) filter (where kind = 'ca_release'), 0),
    coalesce(sum(amount_minor) filter (
      where kind = 'ca_release' and lower(coalesce(nullif(btrim(paid_from), ''), 'cash')) = 'cash'
    ), 0),
    coalesce(sum(amount_minor) filter (
      where kind = 'ca_release' and lower(coalesce(paid_from, '')) = 'gcash'
    ), 0),
    coalesce(sum(amount_minor) filter (where kind = 'ca_repay'), 0),
    coalesce(sum(amount_minor) filter (
      where kind = 'ca_repay' and lower(coalesce(nullif(btrim(paid_from), ''), 'cash')) = 'cash'
    ), 0),
    coalesce(sum(amount_minor) filter (
      where kind = 'ca_repay' and lower(coalesce(paid_from, '')) = 'gcash'
    ), 0)
  into v_exp, v_cash_exp, v_gcash_exp, v_sal, v_sal_cash, v_sal_gcash,
       v_rel, v_rel_cash, v_rel_gcash, v_rep, v_rep_cash, v_rep_gcash
  from public.daily_sheet_lines where sheet_id = s.id;

  v_cash_txn := v_cash - v_sal_cash;
  v_gcash_txn := v_gcash - v_sal_gcash;
  v_cash_left := v_cash_txn + v_rep_cash - v_cash_exp - v_rel_cash;
  v_gcash_left := v_gcash_txn + v_rep_gcash - v_gcash_exp - v_rel_gcash;
  v_expected := v_cash_left;

  return jsonb_build_object(
    'grossMinor', v_gross, 'discountsMinor', v_disc, 'refundsMinor', v_ref, 'netMinor', v_net,
    'count', v_count, 'cashMinor', v_cash,
    'expensesMinor', v_exp,
    'cashExpensesMinor', v_cash_exp,
    'gcashExpensesMinor', v_gcash_exp,
    'salariesMinor', v_sal, 'totalExpensesMinor', v_exp + v_sal,
    'totalSalesMinor', v_net - v_rel,
    'creditDebitMinor', v_credit,
    'cashTransactionMinor', v_cash_txn,
    'gcashTransactionMinor', v_gcash_txn,
    'netProfitMinor', v_net - v_rel - v_exp - v_sal,
    'caReleasedMinor', v_rel, 'caRepaidMinor', v_rep,
    'openingFloatMinor', 0,
    'cashLeftMinor', v_cash_left,
    'gcashLeftMinor', v_gcash_left,
    'expectedCashMinor', v_expected,
    'countedCashMinor', s.counted_cash_minor,
    'overShortMinor', case when s.counted_cash_minor is null then null else s.counted_cash_minor - v_expected end
  );
end;
$function$;

create or replace view public.daily_sales_summary as
select
  branch,
  (occurred_at at time zone 'Asia/Manila')::date as sale_date,
  count(*) filter (where status = 'paid') as paid_count,
  count(*) filter (where status = 'pending') as pending_count,
  count(*) as transaction_count,
  coalesce(sum(total_minor) filter (where status = 'paid'), 0::bigint) as total_sales_minor,
  coalesce(sum(
    case
      when status = 'paid' and lower(coalesce(nullif(btrim(payment_method), ''), 'cash')) = 'cash' then total_minor
      when status = 'paid' and lower(btrim(coalesce(payment_method, ''))) = 'split' then coalesce(cash_minor, 0)
      else 0
    end
  ), 0::bigint) as cash_sales_minor,
  coalesce(sum(
    case
      when status = 'paid' and lower(btrim(coalesce(payment_method, ''))) in (
        'online', 'gcash', 'g-cash', 'card', 'credit', 'credit_card', 'debit', 'debit_card', 'credit_debit', 'credit/debit', 'bank', 'transfer'
      ) then total_minor
      when status = 'paid' and lower(btrim(coalesce(payment_method, ''))) = 'split' then coalesce(gcash_minor, 0)
      else 0
    end
  ), 0::bigint) as online_sales_minor,
  coalesce(sum(
    case
      when status = 'paid' and lower(btrim(coalesce(payment_method, ''))) in ('gcash', 'g-cash') then total_minor
      when status = 'paid' and lower(btrim(coalesce(payment_method, ''))) = 'split' then coalesce(gcash_minor, 0)
      else 0
    end
  ), 0::bigint) as gcash_sales_minor,
  coalesce(sum(total_minor) filter (
    where status = 'paid' and lower(btrim(coalesce(payment_method, ''))) in (
      'card', 'credit', 'credit_card', 'debit', 'debit_card', 'credit_debit', 'credit/debit', 'online', 'bank', 'transfer'
    )
  ), 0::bigint) as card_sales_minor,
  case
    when count(*) filter (where status = 'paid') > 0
      then coalesce(sum(total_minor) filter (where status = 'paid'), 0::bigint) / count(*) filter (where status = 'paid')
    else 0::bigint
  end as average_ticket_minor
from public.sales s
group by branch, ((occurred_at at time zone 'Asia/Manila')::date);

create or replace function public.send_payslip(
  p_staff uuid,
  p_branch text,
  p_start date,
  p_end date,
  p_salary integer,
  p_incentive integer,
  p_paid_from text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_role text;
  v_name text;
  v_id uuid;
  v_category uuid;
  v_take integer;
  v_note text;
  v_start date;
  v_end date;
  v_stamp timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not (
    public.is_super_admin()
    or (
      public.current_user_role() = 'assistant_super_admin'
      and (
        public.asa_has_grant('finance_write')
        or exists (
          select 1 from public.staff_profiles
          where id = auth.uid()
            and (
              lower(full_name) like '%lucy%'
              or lower(full_name) like '%luci%'
              or lower(full_name) like '%robert%'
            )
        )
      )
    )
  ) then
    raise exception 'forbidden';
  end if;
  if public.current_user_role() = 'assistant_super_admin'
     and not public.user_has_branch_access(p_branch) then
    raise exception 'forbidden';
  end if;

  select c.period_start, c.period_end into v_start, v_end
  from public.payroll_period_containing(p_start) c;
  if p_start is distinct from v_start or p_end is distinct from v_end then
    raise exception 'Use the fixed 1st–15th or 16th–end-of-month payroll period for that date.';
  end if;

  if exists (
    select 1 from public.payroll_period_locks
    where branch = p_branch and period_start = v_start and period_end = v_end
  ) then
    raise exception 'This payroll period is locked.';
  end if;

  select role::text, full_name into v_role, v_name
  from public.staff_profiles where id = p_staff and is_active = true;
  if v_role is null then
    raise exception 'Pick an active employee.';
  end if;
  if v_role in ('staff', 'team_lead', 'detailer') then
    raise exception 'Crew are paid on the Daily Sheet, not a payslip.';
  end if;
  if p_salary is null or p_salary <= 0 then
    raise exception 'Enter the salary.';
  end if;
  if coalesce(p_incentive, 0) < 0 then
    raise exception 'Incentive cannot be negative.';
  end if;
  if p_paid_from not in ('cash', 'gcash') then
    raise exception 'Pay with cash or GCash.';
  end if;

  select id into v_category from public.expense_categories where code = '14' limit 1;
  if v_category is null then
    raise exception 'Salary account (code 14) is missing. Add it in Finance categories.';
  end if;

  v_note := nullif(trim(coalesce(p_note, '')), '');
  v_take := p_salary + coalesce(p_incentive, 0);
  v_stamp := (v_end + time '12:00') at time zone 'Asia/Manila';

  insert into public.payslips (
    staff_id, branch, period_start, period_end,
    salary_minor, incentive_minor, paid_from, note, created_by
  ) values (
    p_staff, p_branch, v_start, v_end,
    p_salary, coalesce(p_incentive, 0), p_paid_from, v_note, auth.uid()
  )
  returning id into v_id;

  insert into public.expenses (
    title, description, quantity, unit_cost_minor, total_minor, branch,
    category_id, status, expense_kind, paid_from, created_by, approved_by, paid_by, payslip_id, created_at, updated_at
  ) values (
    'Payroll · ' || coalesce(v_name, 'staff'),
    'payslip:' || v_id::text || coalesce(' · ' || v_note, ''),
    1,
    v_take,
    v_take,
    p_branch,
    v_category,
    'paid',
    'salary_monthly',
    p_paid_from,
    auth.uid(),
    auth.uid(),
    auth.uid(),
    v_id,
    v_stamp,
    now()
  );

  return jsonb_build_object('ok', true, 'id', v_id, 'total_minor', v_take, 'period_start', v_start, 'period_end', v_end);
end;
$function$;

create or replace function public.update_office_payslip(
  p_id uuid,
  p_salary integer,
  p_incentive integer,
  p_paid_from text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_row public.payslips%rowtype;
  v_note text;
  v_take integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not (
    public.is_super_admin()
    or (
      public.current_user_role() = 'assistant_super_admin'
      and (
        public.asa_has_grant('finance_write')
        or exists (
          select 1 from public.staff_profiles
          where id = auth.uid()
            and (
              lower(full_name) like '%lucy%'
              or lower(full_name) like '%luci%'
              or lower(full_name) like '%robert%'
            )
        )
      )
    )
  ) then
    raise exception 'forbidden';
  end if;

  select * into v_row from public.payslips where id = p_id;
  if v_row.id is null then
    raise exception 'Payslip not found.';
  end if;
  if public.current_user_role() = 'assistant_super_admin'
     and not public.user_has_branch_access(v_row.branch) then
    raise exception 'forbidden';
  end if;
  if v_row.status <> 'sent' then
    raise exception 'This payslip was already received. It can no longer be edited.';
  end if;
  if exists (
    select 1 from public.payroll_period_locks
    where branch = v_row.branch
      and period_start = v_row.period_start
      and period_end = v_row.period_end
  ) then
    raise exception 'This payroll period is locked.';
  end if;
  if p_salary is null or p_salary <= 0 then
    raise exception 'Enter the salary.';
  end if;
  if coalesce(p_incentive, 0) < 0 then
    raise exception 'Incentive cannot be negative.';
  end if;
  if p_paid_from not in ('cash', 'gcash') then
    raise exception 'Pay with cash or GCash.';
  end if;

  v_note := nullif(trim(coalesce(p_note, '')), '');
  v_take := p_salary + coalesce(p_incentive, 0);

  update public.payslips
     set salary_minor = p_salary,
         incentive_minor = coalesce(p_incentive, 0),
         paid_from = p_paid_from,
         note = v_note
   where id = p_id;

  update public.expenses
     set unit_cost_minor = v_take,
         total_minor = v_take,
         paid_from = p_paid_from,
         payslip_id = p_id,
         description = 'payslip:' || p_id::text || coalesce(' · ' || v_note, ''),
         updated_at = now()
   where payslip_id = p_id
      or (payslip_id is null and description like 'payslip:' || p_id::text || '%' and expense_kind = 'salary_monthly');

  return jsonb_build_object('ok', true, 'id', p_id, 'total_minor', v_take);
end;
$function$;

create or replace function public.cash_advance_ledger(p_branch text default null::text, p_staff uuid default null::uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_role text := public.current_user_role();
  v_staff uuid := p_staff;
  v_branch text := nullif(trim(coalesce(p_branch, '')), '');
  v_all boolean := false;
  v_processor boolean := false;
  v_asa_all boolean := false;
  v_rows jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (select 1 from public.staff_profiles where id = auth.uid() and is_active = true) then
    raise exception 'forbidden';
  end if;

  if v_role = 'assistant_super_admin' then
    v_asa_all := coalesce(
      (
        select (sp.permission_grants ->> 'branches_all')::boolean
        from public.staff_profiles sp
        where sp.id = auth.uid()
      ),
      true
    );
  end if;

  if v_branch = 'all' then
    if not (
      v_role = 'BossMich'
      or (
        v_role = 'assistant_super_admin'
        and v_asa_all
        and (
          public.asa_has_grant('pos')
          or public.asa_has_grant('finance_view')
          or public.asa_has_grant('finance_write')
        )
      )
    ) then
      raise exception 'forbidden';
    end if;
    v_all := true;
    v_branch := null;
    v_processor := true;
  else
    v_processor := v_role = 'BossMich'
      or (v_role in ('admin', 'operations_lead') and v_branch is not null and public.user_has_branch_access(v_branch))
      or (
        v_role = 'assistant_super_admin'
        and v_branch is not null
        and public.user_has_branch_access(v_branch)
        and (
          public.asa_has_grant('pos')
          or public.asa_has_grant('finance_view')
          or public.asa_has_grant('finance_write')
        )
      );
  end if;

  if v_staff is not null and v_staff is distinct from auth.uid() and not v_processor then
    raise exception 'forbidden';
  end if;

  if not v_processor then
    v_staff := auth.uid();
    v_branch := null;
    v_all := false;
  elsif v_staff is null and not v_all and v_branch is null then
    raise exception 'Pick a branch.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.business_date desc), '[]'::jsonb)
  into v_rows
  from (
    select
      l.staff_id,
      sp.full_name,
      s.business_date,
      s.branch,
      s.id as sheet_id,
      l.kind,
      l.amount_minor
    from public.daily_sheet_lines l
    join public.daily_sheets s on s.id = l.sheet_id
    left join public.staff_profiles sp on sp.id = l.staff_id
    where l.kind in ('ca_release', 'ca_repay')
      and l.amount_minor > 0
      and l.staff_id is not null
      and (v_staff is null or l.staff_id = v_staff)
      and (v_branch is null or s.branch = v_branch)
    order by s.business_date desc, l.sort
    limit 400
  ) x;

  return jsonb_build_object('ok', true, 'rows', v_rows);
end;
$function$;

create or replace function public.booking_payable_minor(p_price integer, p_final integer)
returns integer
language sql
immutable
set search_path to 'public'
as $function$
  select coalesce(nullif(p_final, 0), nullif(p_price, 0), 0);
$function$;

create or replace function public.bookings_friend_referral_before()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_exact text;
  v_stripped text;
  v_canonical text;
  referrer uuid;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if tg_op = 'UPDATE' and exists (
    select 1 from public.referral_credits where source_booking_id = new.id
  ) then
    if new.referral_source is distinct from old.referral_source
       or new.referred_by_name is distinct from old.referred_by_name
       or new.referred_by_staff_id is distinct from old.referred_by_staff_id then
      raise exception 'This friend code is already saved. It cannot be changed.';
    end if;
    return new;
  end if;

  if new.referral_source is distinct from 'friend_referral' then
    new.referred_customer_id := null;
    return new;
  end if;

  if not public.booking_is_detailing(new.service_id) then
    raise exception 'Friend codes apply to detailing bookings.';
  end if;
  if new.customer_id is null then
    raise exception 'Link this booking to a customer account before using a friend code.';
  end if;

  v_exact := upper(regexp_replace(coalesce(new.referred_by_name, ''), '[^A-Za-z0-9-]', '', 'g'));
  v_stripped := upper(regexp_replace(coalesce(new.referred_by_name, ''), '[^A-Za-z0-9]', '', 'g'));
  if length(v_stripped) < 4 then
    raise exception 'Enter your friend''s referral code.';
  end if;

  select c.id, c.referral_code
  into referrer, v_canonical
  from public.customers c
  where upper(coalesce(c.referral_code, '')) = v_exact
     or upper(regexp_replace(coalesce(c.referral_code, ''), '[^A-Za-z0-9]', '', 'g')) = v_stripped
  order by (upper(coalesce(c.referral_code, '')) = v_exact) desc
  limit 1;

  if referrer is null then
    raise exception 'Friend code was not found.';
  end if;
  if referrer = new.customer_id then
    raise exception 'Use a friend''s code, not your own.';
  end if;

  new.referred_by_name := v_canonical;
  new.referred_customer_id := referrer;
  new.referred_by_staff_id := null;
  return new;
end;
$function$;
