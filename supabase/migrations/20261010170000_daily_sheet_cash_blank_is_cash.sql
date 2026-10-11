-- BUG-086: the Daily Sheet's drawer cash total asked a different question than
-- the POS screen the Branch Admin was looking at.
--
-- daily_sheet_server_totals (20261001090000) filtered drawer cash with:
--
--   lower(coalesce(payment_method, 'cash')) = 'cash'
--
-- and drawerPaymentBucket() in src/lib/paymentMethods.js answered the same
-- question with trim + lowercase + "blank is cash". They disagree on three
-- inputs:
--
--   ''        POS screen: cash     this function: not cash
--   ' cash'   POS screen: cash     this function: not cash
--   'cash '   POS screen: cash     this function: not cash
--
-- coalesce substitutes for NULL but passes '' straight through, and there is no
-- trim(). cashMinor feeds expectedCashMinor feeds overShortMinor -- the drawer
-- reconciliation. So a blank or padded method drops money out of the expected
-- drawer: the Branch Admin counts a correct till and is told it is short by
-- exactly that amount, then writes a note explaining a discrepancy that does not
-- exist.
--
-- This is BUG-081's defect in the one implementation BUG-081 could not see. That
-- commit replaced three disagreeing JavaScript maps with one vocabulary in
-- paymentMethods.js; the SQL kept its own.
--
-- Reachability: every revision of complete_pos_sale reads
--
--   v_method text := coalesce(payload->>'payment_method', 'cash')
--
-- which likewise stores '' verbatim. The client-side isAllowedPosPaymentMethod()
-- rejects a blank method, but complete_pos_sale is security-definer, so a direct
-- rpc() call bypasses it -- the same shape as BUG-071, where page gates were not
-- a boundary against PostgREST.
--
-- Measured on production 2026-10-10 (read-only): 988 paid rows, payment_method
-- only ever 'cash' / 'gcash' / 'card'. NO row currently drifts, so this is a
-- latent hole, not a live miscount. Re-check with:
--
--   node scripts/probe-payment-method-drift.mjs
--
-- Why the expression looks the way it does: the blank must map ONTO 'cash', not
-- onto NULL. nullif(btrim(payment_method), '') yields NULL for a blank, and
-- lower(NULL) = 'cash' is NULL -- not TRUE -- so the filter would exclude the
-- row anyway and the fix would be decoration. The outer coalesce is load-bearing.
--
-- NOT VERIFIED BY EXECUTION: this repo has no local Postgres (`pg` is not a
-- dependency), so the corrected expression has not been run. It is proven at the
-- contract level -- tests/dailySheetCashBucketParity.test.js pins the expression
-- and proves it by mutation -- but the owner should run
-- scripts/probe-payment-method-drift.mjs after applying, and the first real
-- trading day is the first time these three inputs are exercised against a live
-- drawer.
--
-- Guards: aborts if daily_sheet_server_totals is missing or has drifted from the
-- body this migration read, so running it against a database this team has
-- already changed does nothing rather than silently reverting someone else's fix.
-- It rewrites no rows.

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
    where n.nspname = 'public' and p.proname = 'daily_sheet_server_totals'
  ) then
    raise exception 'public.daily_sheet_server_totals(uuid) is missing — refusing to guess at a function this migration has not read';
  end if;

  v_def := pg_get_functiondef('public.daily_sheet_server_totals(uuid)'::regprocedure);

  -- Everything this function computes is carried forward verbatim below. If one
  -- of these has gone missing, someone changed it after 20261001090000 and
  -- writing our copy back would quietly undo their work.
  -- array_to_string of an empty array is '', not NULL; nullif makes a clean body pass.
  v_missing := nullif(array_to_string(array_remove(ARRAY[
    case when v_def like '%expectedCashMinor%' then null else 'expected cash' end,
    case when v_def like '%overShortMinor%' then null else 'over/short' end,
    case when v_def like '%netProfitMinor%' then null else 'net profit' end,
    case when v_def like '%caReleasedMinor%' then null else 'cash advance release' end,
    case when v_def like '%caRepaidMinor%' then null else 'cash advance repay' end,
    case when v_def like '%refundsMinor%' then null else 'refunds' end
  ], null), ', '), '');

  if v_missing is not null then
    raise exception 'daily_sheet_server_totals has drifted from the body this migration verified — missing: %', v_missing;
  end if;

  if v_def like '%nullif(btrim(payment_method)%' then
    raise notice 'daily_sheet_server_totals already treats a blank method as cash; replacement will be a no-op';
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
    -- BUG-086. btrim for padding, nullif+coalesce so a blank means cash rather
    -- than NULL. A method that is recorded but unrecognised still falls out, so
    -- a wallet sale can never invent money in the drawer.
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

commit;

-- After: the sheet's expected drawer and the figure the Branch Admin watched on
-- screen are computed by the same rule. A recorded-but-unrecognised method
-- ('wallet', 'cheque') still lands in `other` and never inflates the drawer --
-- that half of BUG-081 is unchanged.
--
-- No rows are rewritten. Existing sheets keep the totals they were stamped with;
-- only sheets re-saved or re-submitted after this migration recompute.
--
-- Re-run the probe afterwards:
--   node scripts/probe-payment-method-drift.mjs