-- Use the line's vehicle_size when checking service catalog price (not max of all sizes).

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
  v_size text;
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
      v_size := nullif(trim(coalesce(line->>'vehicle_size', '')), '');
      catalog_price := null;
      if v_size is not null then
        select ssp.price_minor into catalog_price
        from public.service_size_prices ssp
        where ssp.service_id = (line->>'service_id')::uuid and ssp.size_slug = v_size;
      end if;
      if catalog_price is null then
        select s.price_minor into catalog_price
        from public.services s
        where s.id = (line->>'service_id')::uuid and s.is_active and not s.is_archived;
      end if;
      if catalog_price is null then
        raise exception 'Service not found or inactive';
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
