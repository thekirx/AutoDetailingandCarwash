-- Re-enable coffee recipe deduction (1 cup, 20g beans) and grant ASA restock review
-- Owner (BossMich), Lucy, and Robert can modify stocks and review restock requests.

create or replace function public.review_restock(p_id uuid, p_decision text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row public.restock_requests%rowtype;
  v_have integer;
  v_role text := public.current_user_role();
begin
  if not (public.is_super_admin() or v_role = 'assistant_super_admin') then
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

grant execute on function public.review_restock(uuid, text) to authenticated;

