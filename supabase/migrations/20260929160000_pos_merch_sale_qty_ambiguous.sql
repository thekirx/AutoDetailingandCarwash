-- POS merch sales have failed since 20260827111000_complete_pos_sale_branch_stock
-- with `column reference "qty" is ambiguous`: complete_pos_sale_impl declares a
-- variable `qty`, and the branch stock decrement also touches the column
-- product_branch_stock.qty, so `pbs.qty - qty` / `pbs.qty >= qty` could mean
-- either. Service lines never reach that UPDATE, which is why queue payments
-- kept working while every product sale (Branch Admin's main POS job) failed.
--
-- PL/pgSQL cannot qualify a declared variable by the function name, so the
-- UPDATE uses the same expression the variable is assigned from.
-- Verified in a rolled-back transaction: a Branch Admin merch sale of 2 units
-- takes Bacoor stock 100 -> 98.

begin;

do $patch$
declare
  def text;
  q constant text := 'greatest(coalesce((line->>''quantity'')::int, 1), 1)';
begin
  def := pg_get_functiondef('public.complete_pos_sale_impl(jsonb)'::regprocedure);
  if position('qty := greatest(coalesce((line->>''quantity'')::int, 1), 1);' in def) = 0
     or position('set qty = pbs.qty - qty, updated_at = clock_timestamp()' in def) = 0
     or position('and pbs.qty >= qty;' in def) = 0 then
    raise exception 'complete_pos_sale_impl changed; update this migration';
  end if;
  def := replace(def,
    'set qty = pbs.qty - qty, updated_at = clock_timestamp()',
    'set qty = pbs.qty - ' || q || ', updated_at = clock_timestamp()');
  def := replace(def,
    'and pbs.qty >= qty;',
    'and pbs.qty >= ' || q || ';');
  execute def;
end
$patch$;

commit;
