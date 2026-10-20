-- C2 close: expected drawer cash only subtracts cash-paid expenses.
-- GCash expenses stay in expensesMinor / P&L, matching src/lib/dailySheet.js.

begin;

do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'daily_sheet_server_totals'
  ) then
    raise exception 'public.daily_sheet_server_totals() is missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'daily_sheet_lines' and column_name = 'paid_from'
  ) then
    raise exception 'public.daily_sheet_lines.paid_from is missing — apply 20261019140000 first';
  end if;
end $$;

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
  v_exp bigint; v_cash_exp bigint; v_gcash_exp bigint;
  v_sal bigint; v_rel bigint; v_rep bigint; v_expected bigint;
begin
  select * into s from public.daily_sheets where id = p_sheet;
  if s.id is null then return '{}'::jsonb; end if;
  select
    coalesce(sum(total_minor + coalesce(discount_minor, 0)), 0),
    coalesce(sum(coalesce(discount_minor, 0)), 0),
    coalesce(sum(total_minor) filter (where status = 'refunded'), 0),
    coalesce(sum(total_minor) filter (where status = 'paid'), 0),
    count(*) filter (where status = 'paid'),
    coalesce(sum(total_minor) filter (
      where status = 'paid'
        and lower(coalesce(nullif(btrim(payment_method), ''), 'cash')) = 'cash'
    ), 0)
  into v_gross, v_disc, v_ref, v_net, v_count, v_cash
  from public.sales
  where branch = s.branch
    and status in ('paid', 'refunded')
    and (occurred_at at time zone 'Asia/Manila')::date = s.business_date;
  select
    coalesce(sum(amount_minor) filter (where kind = 'expense'), 0),
    coalesce(sum(amount_minor) filter (
      where kind = 'expense'
        and lower(coalesce(nullif(btrim(paid_from), ''), 'cash')) = 'cash'
    ), 0),
    coalesce(sum(amount_minor) filter (
      where kind = 'expense'
        and lower(coalesce(nullif(btrim(paid_from), ''), 'cash')) = 'gcash'
    ), 0),
    coalesce(sum(amount_minor) filter (where kind = 'salary'), 0),
    coalesce(sum(amount_minor) filter (where kind = 'ca_release'), 0),
    coalesce(sum(amount_minor) filter (where kind = 'ca_repay'), 0)
  into v_exp, v_cash_exp, v_gcash_exp, v_sal, v_rel, v_rep
  from public.daily_sheet_lines where sheet_id = s.id;
  -- Drawer: only cash-paid expenses leave the till. GCash expenses stay in P&L.
  v_expected := coalesce(s.opening_float_minor, 0) + v_cash + v_rep - v_cash_exp - v_sal - v_rel;
  return jsonb_build_object(
    'grossMinor', v_gross, 'discountsMinor', v_disc, 'refundsMinor', v_ref, 'netMinor', v_net,
    'count', v_count, 'cashMinor', v_cash,
    'expensesMinor', v_exp,
    'cashExpensesMinor', v_cash_exp,
    'gcashExpensesMinor', v_gcash_exp,
    'salariesMinor', v_sal, 'totalExpensesMinor', v_exp + v_sal,
    'netProfitMinor', v_net - v_exp - v_sal,
    'caReleasedMinor', v_rel, 'caRepaidMinor', v_rep,
    'openingFloatMinor', coalesce(s.opening_float_minor, 0),
    'expectedCashMinor', v_expected,
    'countedCashMinor', s.counted_cash_minor,
    'overShortMinor', case when s.counted_cash_minor is null then null else s.counted_cash_minor - v_expected end
  );
end;
$$;

commit;
