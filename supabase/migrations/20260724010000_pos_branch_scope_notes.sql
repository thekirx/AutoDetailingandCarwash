-- POS: lock non–BossMich cashiers/admins/sales to their branch; optional guest notes; customer sales history index.
create index if not exists sales_customer_occurred_idx
  on public.sales (customer_id, occurred_at desc)
  where customer_id is not null;

create or replace function public.complete_pos_sale(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid := auth.uid();
  caller_role text;
  caller_branch text;
  v_branch text := payload->>'branch';
  v_customer uuid := nullif(payload->>'customer_id', '')::uuid;
  v_booking uuid := nullif(payload->>'booking_id', '')::uuid;
  v_handoff uuid := nullif(payload->>'pos_handoff_id', '')::uuid;
  v_method text := coalesce(payload->>'payment_method', 'cash');
  v_status text := coalesce(payload->>'status', 'paid');
  v_notes text := nullif(trim(coalesce(payload->>'notes', '')), '');
  line jsonb;
  sale_id uuid;
  subtotal integer := 0;
  service_total integer := 0;
  line_total integer;
  qty integer;
  unit integer;
  prod_id uuid;
  svc_id uuid;
  item_name text;
  loyalty_delta integer := 0;
  stamps_awarded integer := 0;
  line_stamps integer;
  multiplier numeric := 1;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  caller_role := public.current_user_role();
  if caller_role not in ('admin', 'BossMich', 'cashier', 'sales') then
    raise exception using errcode = '42501', message = 'Only BossMich, admin, sales, or cashier may run POS sales';
  end if;

  caller_branch := public.current_user_branch();
  -- ponytail: BossMich can post any branch; everyone else must match assigned branch when set
  if caller_role is distinct from 'BossMich'
     and caller_branch is not null
     and caller_branch is distinct from v_branch then
    raise exception using errcode = '42501', message = 'POS sales are limited to your assigned branch';
  end if;

  if v_branch is null or not exists (
    select 1 from public.branches b where b.slug = v_branch and b.is_active and not b.is_archived
  ) then
    raise exception 'Invalid branch';
  end if;
  if v_status not in ('pending', 'paid') then
    raise exception 'Invalid sale status';
  end if;
  if jsonb_typeof(payload->'lines') is distinct from 'array' or jsonb_array_length(payload->'lines') < 1 then
    raise exception 'At least one line item is required';
  end if;

  insert into public.sales (
    branch, customer_id, booking_id, pos_handoff_id, status, payment_method,
    subtotal_minor, total_minor, notes, recorded_by
  ) values (
    v_branch, v_customer, v_booking, v_handoff, v_status, v_method, 0, 0, v_notes, caller
  ) returning id into sale_id;

  for line in select * from jsonb_array_elements(payload->'lines')
  loop
    qty := greatest(coalesce((line->>'quantity')::int, 1), 1);
    unit := coalesce((line->>'unit_price_minor')::int, 0);
    line_total := qty * unit;
    subtotal := subtotal + line_total;
    item_name := coalesce(line->>'name', 'Item');

    if line->>'item_type' = 'product' then
      prod_id := (line->>'product_id')::uuid;
      update public.products p
      set stock_qty = p.stock_qty - qty, updated_at = clock_timestamp()
      where p.id = prod_id and p.stock_qty >= qty and p.is_active and not p.is_archived;
      if not found then
        raise exception 'Insufficient stock for product %', prod_id;
      end if;
      insert into public.product_stock_movements (product_id, delta, reason, sale_id, created_by)
      values (prod_id, -qty, 'pos_sale', sale_id, caller);
      insert into public.sale_line_items (
        sale_id, item_type, product_id, name, quantity, unit_price_minor, line_total_minor
      ) values (sale_id, 'product', prod_id, item_name, qty, unit, line_total);
    elsif line->>'item_type' = 'service' then
      svc_id := (line->>'service_id')::uuid;
      service_total := service_total + line_total;
      insert into public.sale_line_items (
        sale_id, item_type, service_id, name, quantity, unit_price_minor, line_total_minor
      ) values (sale_id, 'service', svc_id, item_name, qty, unit, line_total);
      if v_status = 'paid' and v_customer is not null then
        line_stamps := public.award_loyalty_stamps(v_customer, svc_id, qty);
        stamps_awarded := stamps_awarded + coalesce(line_stamps, 0);
      end if;
    else
      raise exception 'Invalid item_type';
    end if;
  end loop;

  update public.sales
  set subtotal_minor = subtotal, total_minor = subtotal, updated_at = clock_timestamp()
  where id = sale_id;

  if v_status = 'paid' and v_customer is not null and service_total > 0 then
    select coalesce(mt.loyalty_multiplier, 1) into multiplier
    from public.customer_memberships cm
    join public.membership_tiers mt on mt.id = cm.tier_id
    where cm.customer_id = v_customer and cm.is_active
    order by cm.created_at desc
    limit 1;

    loyalty_delta := greatest(floor((service_total / 100.0) * coalesce(multiplier, 1))::int, 0);
    if loyalty_delta > 0 then
      insert into public.loyalty_ledger (customer_id, delta, reason, sale_id)
      values (v_customer, loyalty_delta, 'service_sale', sale_id);
      update public.customers
      set loyalty_points = loyalty_points + loyalty_delta, updated_at = clock_timestamp()
      where id = v_customer;
    end if;
  end if;

  if v_handoff is not null and v_status = 'paid' then
    update public.pos_handoffs
    set status = 'completed', completed_at = clock_timestamp(), updated_at = clock_timestamp()
    where id = v_handoff;
  end if;

  if v_booking is not null and v_status = 'paid' then
    update public.bookings
    set status = 'completed', completed_at = coalesce(completed_at, clock_timestamp()), updated_at = clock_timestamp()
    where id = v_booking;
  end if;

  return jsonb_build_object(
    'sale_id', sale_id,
    'total_minor', subtotal,
    'loyalty_awarded', coalesce(loyalty_delta, 0),
    'stamps_awarded', coalesce(stamps_awarded, 0)
  );
end;
$$;

revoke all on function public.complete_pos_sale(jsonb) from public, anon;
grant execute on function public.complete_pos_sale(jsonb) to authenticated;
