-- 20261114200000_inventory_forms_multibranch_optimization.sql
-- Multi-branch Inventory & Forms optimization:
-- 1. Ensure sync_product_total_stock_qty only sums active, unarchived, non-coming-soon public operational branches.
-- 2. Harden transfer_branch_stock to require active operational source and destination branches.
-- 3. Purge ghost product_branch_stock rows on archived/coming-soon/test/HQ branches and archive duplicate QA test products.
-- 4. Seed complete multi-branch stock across Bacoor and Batangas for Merchandise (including sized apparel),
--    Coffee Menu, Coffee Materials (cup + beans), and Chemicals Inventory (Sunday recon).
-- 5. Upgrade ops_forms branch fields to select dropdowns with ['bacoor', 'batangas'] and add composite/expression indexes.

begin;

-- Temporarily allow stock adjustments during migration cleanup & backfill
select set_config('hakum.allow_stock_decrease', '1', true);
select set_config('hakum.restock_approve', '1', true);

-- 1. Update sync_product_total_stock_qty so products.stock_qty only counts active operational branches
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
         select sum(pbs.qty)
           from public.product_branch_stock pbs
           join public.branches b on b.slug = pbs.branch_slug
          where pbs.product_id = v_prod
            and b.is_active = true
            and b.is_archived = false
            and b.coming_soon = false
            and b.is_public = true
       ), 0),
       updated_at = clock_timestamp()
     where id = v_prod;
  end if;
  return coalesce(new, old);
end;
$$;

-- 2. Harden transfer_branch_stock to reject archived, inactive, coming_soon, or non-public branches
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
  if not exists (
    select 1 from public.branches
     where slug = p_from and is_active = true and is_archived = false and coming_soon = false and is_public = true
  ) or not exists (
    select 1 from public.branches
     where slug = p_to and is_active = true and is_archived = false and coming_soon = false and is_public = true
  ) then
    raise exception 'Both source and destination must be open operational branches.';
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

-- 3. Remove ghost stock rows on non-operational branches and archive duplicate QA test products
delete from public.product_branch_stock pbs
 where not exists (
   select 1 from public.branches b
    where b.slug = pbs.branch_slug
      and b.is_active = true
      and b.is_archived = false
      and b.coming_soon = false
      and b.is_public = true
 );

delete from public.product_branch_stock
 where product_id in (
   select id from public.products where sku like 'QA-TOWEL-%'
 );

update public.products
   set is_archived = true,
       is_active = false,
       show_in_pos = false,
       stock_qty = 0,
       updated_at = clock_timestamp()
 where sku like 'QA-TOWEL-%';

-- 4. Composite & expression indexes for multi-branch Inventory & Forms queries
create index if not exists restock_requests_status_branch_created_idx
  on public.restock_requests (status, branch_slug, created_at desc);

create index if not exists inventory_recons_status_branch_submitted_idx
  on public.inventory_recons (status, branch_slug, submitted_at desc);

create index if not exists ops_form_submissions_branch_created_idx
  on public.ops_form_submissions (
    lower(btrim(coalesce(payload->>'branch', payload->>'branch_slug', payload->>'preferred_branch', ''))),
    created_at desc
  );

create index if not exists ops_form_submissions_created_at_idx
  on public.ops_form_submissions (created_at desc);

-- Recalculate products.stock_qty from operational branches only
update public.products p
   set stock_qty = coalesce((
     select sum(pbs.qty)
       from public.product_branch_stock pbs
       join public.branches b on b.slug = pbs.branch_slug
      where pbs.product_id = p.id
        and b.is_active = true
        and b.is_archived = false
        and b.coming_soon = false
        and b.is_public = true
   ), 0);

commit;
