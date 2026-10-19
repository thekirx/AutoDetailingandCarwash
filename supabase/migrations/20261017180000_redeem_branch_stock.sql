-- Points redemption deducts the pickup branch's on-hand, the same row POS deducts.
-- The referral offer the staff form reads is referral_program_settings().

grant execute on function public.referral_program_settings() to service_role;

alter table public.accessory_redemptions
  add column if not exists branch_slug text references public.branches (slug);

drop function if exists public.redeem_accessory(uuid, uuid);

create function public.redeem_accessory(p_customer uuid, p_product uuid, p_branch text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cost int;
  have int;
  item_name text;
begin
  if p_branch is null or btrim(p_branch) = '' then
    raise exception 'Choose a pickup branch.';
  end if;
  if not exists (
    select 1 from public.branches
    where slug = p_branch and is_active and not is_archived
  ) then
    raise exception 'That branch is not open.';
  end if;

  select points_price, name
    into cost, item_name
  from public.products
  where id = p_product
    and coalesce(usage_kind, 'resellable') <> 'internal'
    and is_active
    and not is_archived
  for update;

  if cost is null or cost <= 0 then
    raise exception 'That item is not in the shop.';
  end if;

  select loyalty_points into have from public.customers where id = p_customer for update;
  if coalesce(have, 0) < cost then
    raise exception 'Not enough points.';
  end if;

  perform set_config('hakum.allow_stock_decrease', '1', true);
  update public.product_branch_stock
    set qty = qty - 1
    where product_id = p_product
      and branch_slug = p_branch
      and qty >= 1;
  if not found then
    raise exception 'That item is out of stock at this branch.';
  end if;

  update public.customers set loyalty_points = have - cost where id = p_customer;
  insert into public.loyalty_ledger (customer_id, delta, reason)
  values (p_customer, -cost, 'accessory_redeem');
  insert into public.accessory_redemptions (customer_id, product_id, points_spent, branch_slug)
  values (p_customer, p_product, cost, p_branch);
  insert into public.product_stock_movements (product_id, delta, reason, movement_type, branch_slug)
  values (p_product, -1, 'accessory_redeem', 'sale', p_branch);

  return jsonb_build_object(
    'ok', true,
    'loyalty_points', have - cost,
    'name', item_name,
    'branch_slug', p_branch
  );
end;
$$;

revoke all on function public.redeem_accessory(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_accessory(uuid, uuid, text) to service_role;
