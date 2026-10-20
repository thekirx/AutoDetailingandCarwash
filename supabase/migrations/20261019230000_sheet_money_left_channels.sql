-- FOrmulas.md: cash left / GCash left by channel.
-- Salary and cash-advance lines keep paid_from (cash|gcash). Expenses already did.
-- Expected drawer cash = opening float + cash left.

begin;

do $patch$
declare
  def text;
  old text := $old$
    else
      v_paid := null;
    end if;$old$;
  neu text := $neu$
    elsif v_kind in ('salary', 'ca_release', 'ca_repay') then
      if v_paid is null then v_paid := 'cash'; end if;
      if v_paid not in ('cash', 'gcash') then
        raise exception 'paid_from must be cash or gcash';
      end if;
    else
      v_paid := null;
    end if;$neu$;
begin
  def := pg_get_functiondef('public.save_daily_sheet(jsonb)'::regprocedure);
  if position('v_kind in (''salary'', ''ca_release'', ''ca_repay'')' in def) > 0 then
    return;
  end if;
  if position(old in def) = 0 then
    raise exception 'save_daily_sheet paid_from branch changed; update this migration';
  end if;
  execute replace(def, old, neu);
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
  v_cash bigint; v_gcash bigint;
  v_exp bigint; v_cash_exp bigint; v_gcash_exp bigint;
  v_sal bigint; v_sal_cash bigint; v_sal_gcash bigint;
  v_rel bigint; v_rel_cash bigint; v_rel_gcash bigint;
  v_rep bigint; v_rep_cash bigint; v_rep_gcash bigint;
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
    coalesce(sum(total_minor) filter (
      where status = 'paid'
        and lower(coalesce(nullif(btrim(payment_method), ''), 'cash')) = 'cash'
    ), 0),
    coalesce(sum(total_minor) filter (
      where status = 'paid'
        and lower(btrim(coalesce(payment_method, ''))) in ('gcash', 'g-cash')
    ), 0)
  into v_gross, v_disc, v_ref, v_net, v_count, v_cash, v_gcash
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

  v_cash_left := v_cash + v_rep_cash - v_cash_exp - v_sal_cash - v_rel_cash;
  v_gcash_left := v_gcash + v_rep_gcash - v_gcash_exp - v_sal_gcash - v_rel_gcash;
  v_expected := coalesce(s.opening_float_minor, 0) + v_cash_left;

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
    'cashLeftMinor', v_cash_left,
    'gcashLeftMinor', v_gcash_left,
    'expectedCashMinor', v_expected,
    'countedCashMinor', s.counted_cash_minor,
    'overShortMinor', case when s.counted_cash_minor is null then null else s.counted_cash_minor - v_expected end
  );
end;
$$;

comment on function public.daily_sheet_server_totals(uuid) is
  'FOrmulas.md: cash left and GCash left by channel. Expected cash = opening float + cash left.';

commit;
