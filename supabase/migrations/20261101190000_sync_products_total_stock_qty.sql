-- Sync products.stock_qty so global products table always reflects total network count.
-- Restock adds to count only and never incurs expenses; expenses are entered manually in Finance for bulk orders.

create or replace function public.sync_product_total_stock_qty()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_prod uuid;
begin
  v_prod := coalesce(new.product_id, old.product_id);
  if v_prod is not null then
    update public.products
       set stock_qty = coalesce((
         select sum(qty) from public.product_branch_stock where product_id = v_prod
       ), 0),
       updated_at = clock_timestamp()
     where id = v_prod;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists product_branch_stock_sync_total on public.product_branch_stock;
create trigger product_branch_stock_sync_total
  after insert or update of qty or delete on public.product_branch_stock
  for each row execute function public.sync_product_total_stock_qty();

-- Backfill existing products.stock_qty with true sum of branch stock
update public.products p
   set stock_qty = coalesce((
     select sum(qty) from public.product_branch_stock pbs where pbs.product_id = p.id
   ), 0);

