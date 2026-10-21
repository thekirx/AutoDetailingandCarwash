-- Sir, 21 Oct 2026. No morning float. Salary comes out of the channel transaction.
-- Cash advances given out come off total sales and off the channel that paid them.
-- A ticket may be split between cash and GCash (cash_minor + gcash_minor = total).

alter table public.sales add column if not exists cash_minor integer;
alter table public.sales add column if not exists gcash_minor integer;

alter table public.sales drop constraint if exists sales_cash_gcash_split;
alter table public.sales add constraint sales_cash_gcash_split check (
  (cash_minor is null and gcash_minor is null)
  or (
    cash_minor > 0
    and gcash_minor > 0
    and cash_minor + gcash_minor = total_minor
  )
);

comment on column public.sales.cash_minor is
  'Cash portion of a split ticket. Null on a single-method sale.';
comment on column public.sales.gcash_minor is
  'GCash portion of a split ticket. Null on a single-method sale.';

do $patch$
declare
  def text;
  old text := $old$
  if s.opening_float_minor is null then raise exception 'Enter the opening float'; end if;
  if s.counted_cash_minor is null then raise exception 'Count the cash in the drawer'; end if;$old$;
  neu text := $neu$
  if s.counted_cash_minor is null then raise exception 'Count the cash in the drawer'; end if;$neu$;
begin
  def := pg_get_functiondef('public.submit_daily_sheet(jsonb)'::regprocedure);
  if position('Enter the opening float' in def) = 0 then
    return;
  end if;
  if position(old in def) = 0 then
    raise exception 'submit_daily_sheet float check changed; update this migration';
  end if;
  execute replace(def, old, neu);
end
$patch$;

do $patch$
declare
  def text;
  old text := $old$
  select exists (
    select 1
    from jsonb_array_elements(v_methods) as m
    where lower(trim(coalesce(
      case when jsonb_typeof(m) = 'object' then m->>'value' else m #>> '{}' end,
      ''
    ))) = v_method
  ) into v_allowed;

  if not coalesce(v_allowed, false) then
    raise exception 'Payment method is not enabled in POS settings';
  end if;$old$;
  neu text := $neu$
  if v_method = 'split' then
    if coalesce((payload->>'cash_minor')::int, 0) <= 0
       or coalesce((payload->>'gcash_minor')::int, 0) <= 0 then
      raise exception 'Split the ticket between cash and GCash';
    end if;
    v_allowed := true;
  else
    select exists (
      select 1
      from jsonb_array_elements(v_methods) as m
      where lower(trim(coalesce(
        case when jsonb_typeof(m) = 'object' then m->>'value' else m #>> '{}' end,
        ''
      ))) = v_method
    ) into v_allowed;
  end if;

  if not coalesce(v_allowed, false) then
    raise exception 'Payment method is not enabled in POS settings';
  end if;$neu$;
begin
  def := pg_get_functiondef('public.assert_pos_sale_integrity(jsonb)'::regprocedure);
  if position('v_method = ''split''' in def) > 0 then
    return;
  end if;
  if position(old in def) = 0 then
    raise exception 'assert_pos_sale_integrity payment check changed; update this migration';
  end if;
  execute replace(def, old, neu);
end
$patch$;

do $patch$
declare
  def text;
  old_decl text := $old$v_method text := coalesce(payload->>'payment_method', 'cash');$old$;
  neu_decl text := $neu$v_method text := coalesce(payload->>'payment_method', 'cash');
  v_split_cash integer := coalesce((payload->>'cash_minor')::int, 0);
  v_split_gcash integer := coalesce((payload->>'gcash_minor')::int, 0);$neu$;
  old_upd text := $old$update public.sales
  set subtotal_minor = subtotal, total_minor = subtotal, updated_at = clock_timestamp()
  where id = sale_id;$old$;
  neu_upd text := $neu$if v_method = 'split' and (v_split_cash <= 0 or v_split_gcash <= 0 or v_split_cash + v_split_gcash <> subtotal) then
    raise exception 'Cash and GCash must both be used and add up to the ticket';
  end if;

  update public.sales
  set subtotal_minor = subtotal,
      total_minor = subtotal,
      cash_minor = case when v_method = 'split' then v_split_cash else null end,
      gcash_minor = case when v_method = 'split' then v_split_gcash else null end,
      updated_at = clock_timestamp()
  where id = sale_id;$neu$;
begin
  def := pg_get_functiondef('public.complete_pos_sale_impl(jsonb)'::regprocedure);
  if position('v_split_cash' in def) > 0 then
    return;
  end if;
  if position(old_decl in def) = 0 or position(old_upd in def) = 0 then
    raise exception 'complete_pos_sale_impl changed; update this migration';
  end if;
  def := replace(def, old_decl, neu_decl);
  def := replace(def, old_upd, neu_upd);
  execute def;
end
$patch$;

create or replace function public.daily_sheet_server_totals(p_sheet uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
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
    coalesce(sum(total_minor + coalesce(discount_minor, 0)), 0),
    coalesce(sum(coalesce(discount_minor, 0)), 0),
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
      where kind = 'ca_release' and lower(btrim(coalesce(paid_from, ''))) = 'gcash'
    ), 0),
    coalesce(sum(amount_minor) filter (where kind = 'ca_repay'), 0),
    coalesce(sum(amount_minor) filter (
      where kind = 'ca_repay' and lower(coalesce(nullif(btrim(paid_from), ''), 'cash')) = 'cash'
    ), 0),
    coalesce(sum(amount_minor) filter (
      where kind = 'ca_repay' and lower(btrim(coalesce(paid_from, ''))) = 'gcash'
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
$$;

comment on function public.daily_sheet_server_totals(uuid) is
  '21 Oct 2026: no morning float. Salary is deducted in the channel transaction. Cash advances given out come off total sales and off the channel that paid them. Expected cash is cash left.';
