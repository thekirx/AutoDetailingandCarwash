-- READ-ONLY PREFLIGHT (run this SELECT separately before applying):
-- select r.id, r.customer_id, c.full_name as customer, r.product_id,
--        p.name as product, r.branch_slug as branch, r.created_at,
--        case when jsonb_array_length(coalesce(p.size_options, '[]'::jsonb)) > 0
--             then 'STOP: resolve sized claim manually' else 'carry over: fresh 10-day hold' end as action
-- from public.accessory_redemptions r
-- join public.products p on p.id = r.product_id
-- join public.customers c on c.id = r.customer_id
-- where r.status = 'pending' order by r.created_at;
-- NOT APPLIED. Kirk applies this migration himself.
begin;

-- Block concurrent legacy claims until the new function/policy is installed.
lock table public.accessory_redemptions in access exclusive mode;
lock table public.products in share row exclusive mode;
do $$
declare v_blocked jsonb;
begin
  select jsonb_agg(jsonb_build_object('id', r.id, 'customer_id', r.customer_id,
    'customer', c.full_name, 'product_id', p.id, 'product', p.name,
    'branch', r.branch_slug, 'created_at', r.created_at)) into v_blocked
  from public.accessory_redemptions r
  join public.products p on p.id = r.product_id
  join public.customers c on c.id = r.customer_id
  where r.status = 'pending' and jsonb_array_length(coalesce(p.size_options, '[]'::jsonb)) > 0;
  if v_blocked is not null then
    raise exception 'Pending sized claims need manual resolution before Points shop migration: %', v_blocked;
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public'
      and tablename = 'accessory_redemptions' and policyname = 'accessory_redemptions_select') then
    raise exception 'Expected accessory_redemptions_select policy missing; inspect policy drift first.';
  end if;
end $$;

alter table public.products
  add column if not exists description text,
  add column if not exists photo_url text,
  add column if not exists show_in_app boolean not null default false;
alter table public.accessory_redemptions
  add column if not exists size_key text not null default '',
  add column if not exists pickup_code text unique,
  add column if not exists expires_at timestamptz,
  add column if not exists fulfilled_at timestamptz,
  add column if not exists fulfilled_by uuid references public.staff_profiles(id),
  add column if not exists expired_at timestamptz;
alter table public.accessory_redemptions drop constraint if exists accessory_redemptions_status_check;
alter table public.accessory_redemptions add constraint accessory_redemptions_status_check
  check (status in ('pending', 'fulfilled', 'expired'));
create index accessory_redemptions_expiry_idx on public.accessory_redemptions(expires_at) where status = 'pending';

-- Eight random hex characters keep codes short without a lifetime 10,000-claim cap.
create function public.mint_pickup_code() returns text
language sql volatile set search_path = pg_catalog, public
as $$ select 'HK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)) $$;
revoke all on function public.mint_pickup_code() from public, anon, authenticated;

-- No points/stock are moved for carry-over. Fulfilled claims are not updated.
do $$
declare v_row record;
begin
  for v_row in select r.id from public.accessory_redemptions r
    join public.products p on p.id = r.product_id
    where r.status = 'pending' and jsonb_array_length(coalesce(p.size_options, '[]'::jsonb)) = 0
  loop
    loop
      begin
        update public.accessory_redemptions set size_key = '', pickup_code = public.mint_pickup_code(),
          expires_at = now() + interval '10 days' where id = v_row.id;
        exit;
      exception when unique_violation then null;
      end;
    end loop;
  end loop;
end $$;

-- Staff must never fetch the secret through PostgREST. Staff lists use the server's masked projection.
drop policy accessory_redemptions_select on public.accessory_redemptions;
create policy accessory_redemptions_select on public.accessory_redemptions for select to authenticated
  using (customer_id = auth.uid());

-- Keep points-shop stock movements distinct from POS sales / coffee recipes.
alter table public.product_stock_movements drop constraint if exists product_stock_movements_movement_type_check;
alter table public.product_stock_movements add constraint product_stock_movements_movement_type_check
  check (movement_type = any (array['sale','restock','recon_adjust','owner_set','coffee_recipe','transfer','points_claim','points_return']));

drop function if exists public.redeem_accessory(uuid, uuid, text);
create function public.redeem_accessory(p_customer uuid, p_product uuid, p_branch text, p_size text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_product public.products%rowtype;
  v_have integer;
  v_size text := lower(btrim(coalesce(p_size, '')));
  v_claim public.accessory_redemptions%rowtype;
begin
  if not exists (select 1 from public.branches where slug = p_branch and is_active and not is_archived) then
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

create function public.handover_redemption(p_branch text, p_code text, p_staff uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_staff public.staff_profiles%rowtype; v_id uuid;
begin
  select * into v_staff from public.staff_profiles where id = p_staff and is_active and not is_archived;
  if not found or not (
    v_staff.role::text in ('BossMich','operations_lead','admin') or
    (v_staff.role::text = 'assistant_super_admin' and (
      coalesce((v_staff.permission_grants->>'pos')::boolean, true) or
      coalesce((v_staff.permission_grants->>'services_merch')::boolean, true)))
  ) then raise exception 'Staff hand-over permission required.'; end if;
  if v_staff.role::text = 'admin' and v_staff.branch_slug is distinct from p_branch
    and not exists(select 1 from public.staff_branch_assignments where staff_id = p_staff and branch_slug = p_branch) then
    raise exception 'Use your assigned branch.';
  end if;
  if v_staff.role::text = 'assistant_super_admin'
    and not coalesce((v_staff.permission_grants->>'branches_all')::boolean, true)
    and v_staff.branch_slug is distinct from p_branch
    and not exists(select 1 from public.staff_branch_assignments where staff_id = p_staff and branch_slug = p_branch) then raise exception 'Use your assigned branch.'; end if;
  select id into v_id from public.accessory_redemptions
    where branch_slug = p_branch and pickup_code = p_code and status = 'pending' and expires_at > clock_timestamp()
    for update;
  if not found then raise exception 'Code does not match a waiting pickup at this branch, or the hold has expired.'; end if;
  update public.accessory_redemptions set status = 'fulfilled', fulfilled_at = clock_timestamp(), fulfilled_by = p_staff
    where id = v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
revoke all on function public.handover_redemption(text, text, uuid) from public, anon, authenticated;
grant execute on function public.handover_redemption(text, text, uuid) to service_role;

create function public.expire_redemptions() returns integer
language plpgsql security definer set search_path = pg_catalog, public as $$
declare r public.accessory_redemptions%rowtype; v_count integer := 0;
begin
  perform set_config('hakum.allow_stock_decrease', '1', true);
  for r in select * from public.accessory_redemptions
      where status = 'pending' and expires_at <= clock_timestamp() order by product_id, customer_id, id for update skip locked
  loop
    -- Same lock order as claim: product, customer, branch stock.
    perform 1 from public.products where id = r.product_id for update;
    perform 1 from public.customers where id = r.customer_id for update;
    update public.customers set loyalty_points = coalesce(loyalty_points, 0) + r.points_spent where id = r.customer_id;
    insert into public.loyalty_ledger(customer_id, delta, reason) values(r.customer_id, r.points_spent, 'accessory_expired');
    insert into public.product_branch_stock(product_id, branch_slug, size_key, qty)
      values(r.product_id, r.branch_slug, r.size_key, 1)
      on conflict(product_id, branch_slug, size_key) do update set qty = product_branch_stock.qty + 1, updated_at = now();
    insert into public.product_stock_movements(product_id, branch_slug, size_key, delta, reason, movement_type)
      values(r.product_id, r.branch_slug, r.size_key, 1, 'accessory_expired', 'points_return');
    update public.accessory_redemptions set status = 'expired', expired_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke all on function public.expire_redemptions() from public, anon, authenticated;
grant execute on function public.expire_redemptions() to service_role;

-- A durable inbox tag deduplicates daily reminders and returned-points notices.
create unique index user_notifications_points_shop_tag_idx on public.user_notifications(user_id, tag)
  where kind = 'points_shop';

-- Seeding must also work while the catalog lock is enabled. Transaction-local only.
select set_config('hakum.allow_stock_decrease', '1', true);
insert into public.products(name, sku, category, price_minor, stock_qty, tags, usage_kind,
  stock_category, show_in_pos, points_price, size_options, show_in_app, description, is_active, is_archived)
select v.name, v.sku, 'merch', 0, 0, array['sellable','merch'], 'resellable', 'merchandise', false,
  v.points, v.sizes, true, 'Placeholder item — Hakum photo and description coming soon.', true, false
from (values
  ('Hakum T-shirt','hakum-points-tshirt',50,'[{"label":"S","price_minor":0},{"label":"M","price_minor":0},{"label":"L","price_minor":0},{"label":"XL","price_minor":0},{"label":"2XL","price_minor":0}]'::jsonb),
  ('Hakum Keychain','hakum-points-keychain',20,'[]'::jsonb),
  ('Hakum Car Freshener','hakum-points-freshener',30,'[]'::jsonb)
) v(name,sku,points,sizes)
where not exists(select 1 from public.products p where lower(trim(p.name)) = lower(v.name) and not p.is_archived);
-- Older items retain their existing values and default to show_in_app=false.
commit;
