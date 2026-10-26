-- Stock categories, POS visibility, and restock that waits for Super Admin.
-- A restock changes the count only. It does not create an expense.
-- One coffee-menu sale uses 1 cup and 20 grams of beans when those materials are marked.

alter table public.products
  add column if not exists stock_category text not null default 'merchandise',
  add column if not exists show_in_pos boolean not null default true,
  add column if not exists material_role text;

alter table public.products drop constraint if exists products_stock_category_ck;
alter table public.products
  add constraint products_stock_category_ck
  check (stock_category in ('merchandise', 'coffee_menu', 'coffee_material', 'chemical'));

alter table public.products drop constraint if exists products_material_role_ck;
alter table public.products
  add constraint products_material_role_ck
  check (material_role is null or material_role in ('cup', 'beans'));

create unique index if not exists products_one_material_role
  on public.products (material_role)
  where material_role is not null and is_archived = false;

update public.products
   set show_in_pos = false
 where stock_category in ('coffee_material', 'chemical');

create table if not exists public.restock_requests (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id),
  branch_slug text not null,
  add_qty integer not null check (add_qty > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.product_stock_movements drop constraint if exists product_stock_movements_movement_type_check;
alter table public.product_stock_movements
  add constraint product_stock_movements_movement_type_check
  check (movement_type = any (array['sale', 'restock', 'recon_adjust', 'owner_set', 'coffee_recipe']));

create index if not exists restock_requests_pending_idx
  on public.restock_requests (branch_slug, status, created_at desc);

alter table public.restock_requests enable row level security;

drop policy if exists restock_requests_select on public.restock_requests;
create policy restock_requests_select on public.restock_requests
  for select to authenticated
  using (
    public.is_super_admin()
    or requested_by = auth.uid()
    or public.current_user_role() = 'assistant_super_admin'
    or (
      public.current_user_role() = 'admin'
      and public.user_has_branch_access(branch_slug)
    )
  );

revoke all on table public.restock_requests from public, anon;
grant select on table public.restock_requests to authenticated;

create or replace function public.guard_branch_stock_count()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if coalesce(current_setting('hakum.allow_stock_decrease', true), '') = '1' then
    return new;
  end if;
  if coalesce(current_setting('hakum.restock_approve', true), '') = '1' then
    return new;
  end if;
  if public.is_super_admin() or public.current_user_role() = 'assistant_super_admin' then
    return new;
  end if;
  if tg_op = 'INSERT' and coalesce(new.qty, 0) = 0 then
    return new;
  end if;
  raise exception 'Restock waits for Super Admin. You cannot type over the current count.';
end;
$$;

drop trigger if exists product_branch_stock_count_guard on public.product_branch_stock;
create trigger product_branch_stock_count_guard
  before insert or update on public.product_branch_stock
  for each row execute function public.guard_branch_stock_count();

create or replace function public.request_restock(p_product uuid, p_branch text, p_qty integer)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_id uuid;
  v_role text := public.current_user_role();
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if v_role not in ('admin', 'operations_lead', 'BossMich', 'assistant_super_admin') then
    raise exception 'forbidden';
  end if;
  if v_role <> 'BossMich' and not public.user_has_branch_access(p_branch) then
    raise exception 'forbidden';
  end if;
  if p_qty is null or p_qty < 1 then
    raise exception 'Enter how many to add.';
  end if;
  if not exists (select 1 from public.products where id = p_product and is_active and not is_archived) then
    raise exception 'That item is not in the catalog.';
  end if;

  insert into public.restock_requests (product_id, branch_slug, add_qty, requested_by)
  values (p_product, p_branch, p_qty, auth.uid())
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'status', 'pending');
end;
$$;

create or replace function public.review_restock(p_id uuid, p_decision text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row public.restock_requests%rowtype;
  v_have integer;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Approve or decline the restock.';
  end if;

  select * into v_row from public.restock_requests where id = p_id for update;
  if not found or v_row.status <> 'pending' then
    raise exception 'That restock is no longer waiting.';
  end if;

  if p_decision = 'rejected' then
    update public.restock_requests
       set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_id;
    return jsonb_build_object('ok', true, 'status', 'rejected');
  end if;

  perform set_config('hakum.restock_approve', '1', true);
  perform set_config('hakum.allow_stock_decrease', '1', true);

  select qty into v_have
    from public.product_branch_stock
   where product_id = v_row.product_id
     and branch_slug = v_row.branch_slug
     and size_key = ''
   for update;

  if v_have is null then
    insert into public.product_branch_stock (product_id, branch_slug, size_key, qty)
    values (v_row.product_id, v_row.branch_slug, '', v_row.add_qty);
  else
    update public.product_branch_stock
       set qty = qty + v_row.add_qty, updated_at = clock_timestamp()
     where product_id = v_row.product_id
       and branch_slug = v_row.branch_slug
       and size_key = '';
  end if;

  insert into public.product_stock_movements (
    product_id, branch_slug, size_key, delta, reason, movement_type, created_by
  ) values (
    v_row.product_id, v_row.branch_slug, '', v_row.add_qty, 'restock', 'restock', auth.uid()
  );

  update public.restock_requests
     set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;

  return jsonb_build_object('ok', true, 'status', 'approved', 'add_qty', v_row.add_qty);
end;
$$;

create or replace function public.apply_coffee_recipe()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_qty integer;
  v_branch text;
  v_cup uuid;
  v_beans uuid;
  v_grams integer;
begin
  if new.movement_type is distinct from 'sale' then
    return new;
  end if;
  if new.delta >= 0 then
    return new;
  end if;
  if not exists (
    select 1 from public.products
    where id = new.product_id and stock_category = 'coffee_menu'
  ) then
    return new;
  end if;

  v_qty := abs(new.delta);
  v_grams := v_qty * 20;
  v_branch := new.branch_slug;

  select id into v_cup
    from public.products
   where material_role = 'cup' and is_active and not is_archived
   limit 1;
  select id into v_beans
    from public.products
   where material_role = 'beans' and is_active and not is_archived
   limit 1;

  if v_cup is null and v_beans is null then
    return new;
  end if;

  perform set_config('hakum.allow_stock_decrease', '1', true);

  if v_cup is not null then
    update public.product_branch_stock
       set qty = qty - v_qty, updated_at = clock_timestamp()
     where product_id = v_cup
       and branch_slug = v_branch
       and size_key = ''
       and qty >= v_qty;
    if not found then
      raise exception 'Not enough cups at this branch for that coffee.';
    end if;
    insert into public.product_stock_movements (
      product_id, branch_slug, size_key, delta, reason, movement_type, created_by, sale_id
    ) values (
      v_cup, v_branch, '', -v_qty, 'coffee_recipe', 'coffee_recipe', new.created_by, new.sale_id
    );
  end if;

  if v_beans is not null then
    update public.product_branch_stock
       set qty = qty - v_grams, updated_at = clock_timestamp()
     where product_id = v_beans
       and branch_slug = v_branch
       and size_key = ''
       and qty >= v_grams;
    if not found then
      raise exception 'Not enough coffee beans at this branch. Each cup uses 20 grams.';
    end if;
    insert into public.product_stock_movements (
      product_id, branch_slug, size_key, delta, reason, movement_type, created_by, sale_id
    ) values (
      v_beans, v_branch, '', -v_grams, 'coffee_recipe', 'coffee_recipe', new.created_by, new.sale_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists product_stock_movements_coffee_recipe on public.product_stock_movements;
create trigger product_stock_movements_coffee_recipe
  after insert on public.product_stock_movements
  for each row execute function public.apply_coffee_recipe();

revoke all on function public.request_restock(uuid, text, integer) from public, anon;
revoke all on function public.review_restock(uuid, text) from public, anon;
grant execute on function public.request_restock(uuid, text, integer) to authenticated;
grant execute on function public.review_restock(uuid, text) to authenticated;
