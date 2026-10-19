-- Michi C8: Super Admin can lock inventory catalog + branch-stock CRUD.
-- POS / redeem still deduct via hakum.allow_stock_decrease = '1'.

begin;

insert into public.app_settings (key, value, updated_at)
values (
  'inventory_crud_lock',
  jsonb_build_object('locked', false),
  clock_timestamp()
)
on conflict (key) do nothing;

create or replace function public.guard_inventory_crud_lock()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if public.is_super_admin() then
    return coalesce(new, old);
  end if;
  -- complete_pos_sale / redeem set this so checkout and point redeem still deduct.
  if coalesce(current_setting('hakum.allow_stock_decrease', true), '') = '1' then
    return coalesce(new, old);
  end if;
  if exists (
    select 1
    from public.app_settings
    where key = 'inventory_crud_lock'
      and coalesce((value->>'locked')::boolean, false)
  ) then
    raise exception using errcode = 'P0001',
      message = 'Inventory is locked. Ask Super Admin to unlock.';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists products_inventory_crud_lock on public.products;
create trigger products_inventory_crud_lock
  before insert or update or delete on public.products
  for each row execute function public.guard_inventory_crud_lock();

drop trigger if exists services_inventory_crud_lock on public.services;
create trigger services_inventory_crud_lock
  before insert or update or delete on public.services
  for each row execute function public.guard_inventory_crud_lock();

drop trigger if exists product_branch_stock_inventory_crud_lock on public.product_branch_stock;
create trigger product_branch_stock_inventory_crud_lock
  before insert or update or delete on public.product_branch_stock
  for each row execute function public.guard_inventory_crud_lock();

drop trigger if exists product_stock_movements_inventory_crud_lock on public.product_stock_movements;
create trigger product_stock_movements_inventory_crud_lock
  before insert on public.product_stock_movements
  for each row execute function public.guard_inventory_crud_lock();

drop trigger if exists inventory_recons_inventory_crud_lock on public.inventory_recons;
create trigger inventory_recons_inventory_crud_lock
  before insert or update on public.inventory_recons
  for each row execute function public.guard_inventory_crud_lock();

comment on function public.guard_inventory_crud_lock() is
  'Blocks catalog / restock / recon mutations when app_settings.inventory_crud_lock.locked; SA and POS decrease exempt.';

commit;
