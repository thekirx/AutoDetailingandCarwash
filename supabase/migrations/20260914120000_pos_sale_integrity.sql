-- POS money integrity: persist tender ref + discount, reject free loyalty without stamps,
-- reject lines priced above catalog, require a reason when below catalog.

alter table public.sales
  add column if not exists payment_ref text,
  add column if not exists discount_reason text,
  add column if not exists discount_minor integer not null default 0 check (discount_minor >= 0);

create or replace function public.assert_pos_sale_integrity(payload jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  line jsonb;
  v_customer uuid := nullif(payload->>'customer_id', '')::uuid;
  v_handoff uuid := nullif(payload->>'pos_handoff_id', '')::uuid;
  v_method text := lower(trim(coalesce(payload->>'payment_method', 'cash')));
  v_ref text := trim(coalesce(payload->>'payment_ref', ''));
  v_reason text := trim(coalesce(payload->>'discount_reason', ''));
  v_stamps int;
  v_need int;
  award_count int := 0;
  bday_count int := 0;
  catalog_price int;
  unit int;
  qty int;
  item_type text;
begin
  if v_method <> 'cash' and length(v_ref) < 4 then
    raise exception 'Payment reference required for %', v_method;
  end if;

  for line in select * from jsonb_array_elements(coalesce(payload->'lines', '[]'::jsonb))
  loop
    qty := coalesce((line->>'quantity')::int, 1);
    if qty < 1 or qty > 99 then
      raise exception 'Quantity must be between 1 and 99';
    end if;
    unit := coalesce((line->>'unit_price_minor')::int, 0);
    if unit < 0 then
      raise exception 'Negative line price is not allowed';
    end if;

    if coalesce((line->>'is_loyalty_award')::boolean, false)
       and not coalesce((line->>'is_birthday_award')::boolean, false) then
      award_count := award_count + 1;
      if v_customer is null then
        raise exception 'Link a customer before redeeming loyalty';
      end if;
      if unit <> 0 then
        raise exception 'Loyalty award lines must be free';
      end if;
    end if;

    if coalesce((line->>'is_birthday_award')::boolean, false) then
      bday_count := bday_count + 1;
      if v_customer is null then
        raise exception 'Link a customer before redeeming a birthday perk';
      end if;
    end if;

    if coalesce((line->>'is_loyalty_award')::boolean, false)
       or coalesce((line->>'is_birthday_award')::boolean, false)
       or coalesce((line->>'is_membership_included')::boolean, false) then
      continue;
    end if;

    item_type := line->>'item_type';
    if v_handoff is not null and item_type = 'service' then
      continue;
    end if;

    if item_type = 'product' then
      select p.price_minor into catalog_price
      from public.products p
      where p.id = (line->>'product_id')::uuid and p.is_active and not p.is_archived;
      if catalog_price is null then
        raise exception 'Product not found or inactive';
      end if;
    elsif item_type = 'service' then
      select greatest(
        coalesce((select s.price_minor from public.services s
                  where s.id = (line->>'service_id')::uuid and s.is_active and not s.is_archived), 0),
        coalesce((select max(ssp.price_minor) from public.service_size_prices ssp
                  where ssp.service_id = (line->>'service_id')::uuid), 0)
      ) into catalog_price;
      if catalog_price is null or catalog_price = 0 then
        -- missing catalog row: fail closed unless the line itself is 0
        if unit > 0 then
          raise exception 'Service not found or inactive';
        end if;
        catalog_price := unit;
      end if;
    else
      continue;
    end if;

    if unit > catalog_price then
      raise exception 'Line priced above catalog';
    end if;
    if unit < catalog_price and length(v_reason) < 3 then
      raise exception 'Discount needs a reason (3+ characters)';
    end if;
  end loop;

  if award_count > 1 then
    raise exception 'One loyalty award per sale';
  end if;
  if bday_count > 1 then
    raise exception 'One birthday award per sale';
  end if;

  if award_count > 0 then
    select c.loyalty_stamps into v_stamps from public.customers c where c.id = v_customer;
    select min(m.threshold_points) into v_need
    from public.loyalty_milestones m
    where coalesce(m.is_active, true)
      and m.threshold_points <= coalesce(v_stamps, 0);
    if v_need is null then
      raise exception 'Customer has no redeemable loyalty reward';
    end if;
  end if;

  if bday_count > 0
     and to_regclass('public.customer_birthday_perks') is not null
     and not exists (
       select 1
       from public.customer_birthday_perks p
       where p.customer_id = v_customer
         and p.status = 'available'
         and p.expires_at > clock_timestamp()
     ) then
    raise exception 'No birthday perk available';
  end if;
end;
$$;

create or replace function public.redeem_pos_loyalty_awards(payload jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_customer uuid := nullif(payload->>'customer_id', '')::uuid;
  v_need int;
  v_has_award boolean := false;
  line jsonb;
begin
  if v_customer is null then
    return;
  end if;
  for line in select * from jsonb_array_elements(coalesce(payload->'lines', '[]'::jsonb))
  loop
    if coalesce((line->>'is_loyalty_award')::boolean, false)
       and not coalesce((line->>'is_birthday_award')::boolean, false) then
      v_has_award := true;
    end if;
  end loop;
  if not v_has_award then
    return;
  end if;
  select min(m.threshold_points) into v_need
  from public.loyalty_milestones m
  join public.customers c on c.id = v_customer
  where coalesce(m.is_active, true)
    and m.threshold_points <= coalesce(c.loyalty_stamps, 0);
  if v_need is null then
    return;
  end if;
  update public.customers
  set loyalty_stamps = greatest(loyalty_stamps - v_need, 0)
  where id = v_customer;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'complete_pos_sale'
      and pg_get_function_identity_arguments(p.oid) = 'payload jsonb'
  ) and not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'complete_pos_sale_impl'
  ) then
    alter function public.complete_pos_sale(jsonb) rename to complete_pos_sale_impl;
  end if;
end $$;

create or replace function public.complete_pos_sale(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  result jsonb;
  sale uuid;
begin
  perform public.assert_pos_sale_integrity(payload);
  result := public.complete_pos_sale_impl(payload);
  sale := nullif(result->>'sale_id', '')::uuid;
  if sale is not null then
    update public.sales
    set
      payment_ref = nullif(trim(coalesce(payload->>'payment_ref', '')), ''),
      discount_reason = nullif(trim(coalesce(payload->>'discount_reason', '')), ''),
      discount_minor = greatest(coalesce((payload->>'discount_minor')::int, 0), 0)
    where id = sale;
  end if;
  perform public.redeem_pos_loyalty_awards(payload);
  return result;
end;
$$;

revoke all on function public.assert_pos_sale_integrity(jsonb) from public, anon;
revoke all on function public.redeem_pos_loyalty_awards(jsonb) from public, anon;
revoke all on function public.complete_pos_sale_impl(jsonb) from public, anon, authenticated;
revoke all on function public.complete_pos_sale(jsonb) from public, anon;
grant execute on function public.complete_pos_sale(jsonb) to authenticated;
