-- Move on-hand units from one branch to another. Owner and General Admin only.
-- Restock requests stay the path for adding stock. This does not post a cost.

alter table public.product_stock_movements drop constraint if exists product_stock_movements_movement_type_check;
alter table public.product_stock_movements
  add constraint product_stock_movements_movement_type_check
  check (movement_type = any (array['sale', 'restock', 'recon_adjust', 'owner_set', 'coffee_recipe', 'transfer']));

create or replace function public.transfer_branch_stock(
  p_product uuid,
  p_from text,
  p_to text,
  p_qty integer
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_role text := public.current_user_role();
  v_from integer;
  v_to integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if v_role not in ('BossMich', 'assistant_super_admin') then
    raise exception 'Only the owner or General Admin can move stock between branches.';
  end if;
  if p_from is null or p_to is null or p_from = p_to then
    raise exception 'Pick a different branch.';
  end if;
  if p_qty is null or p_qty < 1 then
    raise exception 'Enter how many to move.';
  end if;
  if not exists (select 1 from public.products where id = p_product and is_active and not is_archived) then
    raise exception 'That item is not in the catalog.';
  end if;

  perform set_config('hakum.allow_stock_decrease', '1', true);
  perform set_config('hakum.restock_approve', '1', true);

  select qty into v_from
    from public.product_branch_stock
   where product_id = p_product and branch_slug = p_from and size_key = ''
   for update;

  if v_from is null or v_from < p_qty then
    raise exception 'That branch does not have enough on hand.';
  end if;

  select qty into v_to
    from public.product_branch_stock
   where product_id = p_product and branch_slug = p_to and size_key = ''
   for update;

  update public.product_branch_stock
     set qty = qty - p_qty, updated_at = clock_timestamp()
   where product_id = p_product and branch_slug = p_from and size_key = '';

  if v_to is null then
    insert into public.product_branch_stock (product_id, branch_slug, size_key, qty)
    values (p_product, p_to, '', p_qty);
  else
    update public.product_branch_stock
       set qty = qty + p_qty, updated_at = clock_timestamp()
     where product_id = p_product and branch_slug = p_to and size_key = '';
  end if;

  insert into public.product_stock_movements (
    product_id, branch_slug, size_key, delta, reason, movement_type, created_by
  ) values
    (p_product, p_from, '', -p_qty, 'transfer to ' || p_to, 'transfer', auth.uid()),
    (p_product, p_to, '', p_qty, 'transfer from ' || p_from, 'transfer', auth.uid());

  return jsonb_build_object('ok', true, 'qty', p_qty, 'from', p_from, 'to', p_to);
end;
$$;

grant execute on function public.transfer_branch_stock(uuid, text, text, integer) to authenticated;
