-- Enforce operational/public branch check on customer merch redemptions and add
-- multi-branch indexes for customer redemptions and branch queries.

create or replace function public.redeem_accessory(p_customer uuid, p_product uuid, p_branch text, p_size text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_product public.products%rowtype;
  v_have integer;
  v_size text := lower(btrim(coalesce(p_size, '')));
  v_claim public.accessory_redemptions%rowtype;
begin
  if not exists (
    select 1 from public.branches
    where slug = p_branch
      and is_active
      and not is_archived
      and not coalesce(coming_soon, false)
      and coalesce(is_public, true)
  ) then
    raise exception 'Choose an open pickup branch.';
  end if;
  select * into v_product from public.products where id = p_product for update;
  if not found or not v_product.show_in_app or not v_product.is_active or v_product.is_archived
      or coalesce(v_product.usage_kind, 'resellable') = 'internal' or coalesce(v_product.points_price, 0) <= 0 then
    raise exception 'That item is not in the shop.';
  end if;
  if jsonb_array_length(v_product.size_options) > 0 then
    if not exists (select 1 from jsonb_array_elements(v_product.size_options) s
        where lower(btrim(s->>'label')) = v_size) then raise exception 'Choose a size.'; end if;
  elsif v_size <> '' then raise exception 'This item has no sizes.';
  end if;
  select loyalty_points into v_have from public.customers where id = p_customer for update;
  if not found or coalesce(v_have, 0) < v_product.points_price then raise exception 'Not enough points.'; end if;
  perform set_config('hakum.allow_stock_decrease', '1', true);
  update public.product_branch_stock set qty = qty - 1, updated_at = now()
    where product_id = p_product and branch_slug = p_branch and size_key = v_size
      and qty >= 1;
  if not found then raise exception 'That size is out of stock at this branch.'; end if;
  update public.customers set loyalty_points = v_have - v_product.points_price where id = p_customer;
  insert into public.loyalty_ledger(customer_id, delta, reason) values(p_customer, -v_product.points_price, 'accessory_redeem');
  loop
    begin
      insert into public.accessory_redemptions(customer_id, product_id, points_spent, branch_slug, size_key, pickup_code, expires_at)
        values(p_customer, p_product, v_product.points_price, p_branch, v_size, public.mint_pickup_code(), now() + interval '10 days')
        returning * into v_claim;
      exit;
    exception when unique_violation then null;
    end;
  end loop;
  insert into public.product_stock_movements(product_id, delta, reason, movement_type, branch_slug, size_key)
    values(p_product, -1, 'accessory_redeem', 'points_claim', p_branch, v_size);
  return jsonb_build_object('ok', true, 'id', v_claim.id, 'pickup_code', v_claim.pickup_code,
    'expires_at', v_claim.expires_at, 'name', v_product.name, 'branch_slug', p_branch,
    'loyalty_points', v_have - v_product.points_price);
end $$;
revoke all on function public.redeem_accessory(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.redeem_accessory(uuid, uuid, text, text) to service_role;

-- Indexes for customer redemptions and staff multi-branch pickup handover lookups
create index if not exists idx_accessory_redemptions_customer_created
  on public.accessory_redemptions (customer_id, created_at desc);

create index if not exists idx_accessory_redemptions_branch_status_expires
  on public.accessory_redemptions (branch_slug, status, expires_at);

create index if not exists idx_branches_customer_operational
  on public.branches (name)
  where is_active = true and is_archived = false and coming_soon = false and is_public = true;
