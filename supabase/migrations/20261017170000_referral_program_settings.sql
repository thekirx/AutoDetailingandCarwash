-- SA/ASA referral offer lives in app_settings. The booking trigger and the shop read it.

insert into public.app_settings (key, value, updated_at)
values (
  'referral_program',
  jsonb_build_object('friend_points', 50, 'discount_rate', 0.03),
  now()
)
on conflict (key) do nothing;

create or replace function public.referral_program_settings()
returns table (friend_points int, discount_rate numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    least(100000, greatest(0, coalesce((
      select nullif(value->>'friend_points', '')::int
      from public.app_settings
      where key = 'referral_program'
    ), 50))),
    least(1::numeric, greatest(0::numeric, coalesce((
      select nullif(value->>'discount_rate', '')::numeric
      from public.app_settings
      where key = 'referral_program'
    ), 0.03)))
$$;

create or replace function public.bookings_friend_referral_after()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  credit_id uuid;
  own_credit uuid;
  own_price int;
  open_id uuid;
  open_price int;
  next_price int;
  award_points int;
  award_rate numeric;
begin
  select s.friend_points, s.discount_rate into award_points, award_rate
  from public.referral_program_settings() s;
  award_points := coalesce(award_points, 50);
  award_rate := coalesce(award_rate, 0.03);

  if new.customer_id is not null
     and public.booking_is_detailing(new.service_id)
     and coalesce(new.price_minor, 0) > 0
     and award_rate > 0
     and not exists (select 1 from public.referral_credits c where c.applied_booking_id = new.id) then
    select id into own_credit
    from public.referral_credits
    where referrer_customer_id = new.customer_id
      and status = 'available'
    order by created_at
    limit 1
    for update;
    if own_credit is not null then
      own_price := greatest(0, coalesce(new.price_minor, 0) - round(coalesce(new.price_minor, 0) * award_rate)::int);
      update public.bookings
        set price_minor = own_price, final_price_minor = own_price
        where id = new.id;
      update public.referral_credits
        set status = 'applied', applied_booking_id = new.id
        where id = own_credit;
    end if;
  end if;

  if new.referral_source is distinct from 'friend_referral' or new.referred_customer_id is null then
    return new;
  end if;

  insert into public.referral_credits (referrer_customer_id, source_booking_id, discount_rate)
  values (new.referred_customer_id, new.id, award_rate)
  on conflict (source_booking_id) do nothing
  returning id into credit_id;

  if credit_id is null then
    return new;
  end if;

  if award_points > 0 and new.customer_id is not null then
    update public.customers
      set loyalty_points = coalesce(loyalty_points, 0) + award_points
      where id = new.customer_id;
    insert into public.loyalty_ledger (customer_id, delta, reason)
    values (new.customer_id, award_points, 'friend_referral');
  end if;

  if award_rate <= 0 then
    return new;
  end if;

  select b.id, b.price_minor into open_id, open_price
  from public.bookings b
  where b.customer_id = new.referred_customer_id
    and b.id <> new.id
    and b.status in ('pending', 'confirmed', 'waiting')
    and public.booking_is_detailing(b.service_id)
    and coalesce(b.price_minor, 0) > 0
    and not exists (
      select 1 from public.referral_credits c where c.applied_booking_id = b.id
    )
  order by b.scheduled_start nulls last
  limit 1
  for update;

  if open_id is not null then
    next_price := greatest(0, open_price - round(open_price * award_rate)::int);
    update public.bookings
      set price_minor = next_price, final_price_minor = next_price
      where id = open_id;
    update public.referral_credits
      set status = 'applied', applied_booking_id = open_id, discount_rate = award_rate
      where id = credit_id;
  end if;

  return new;
end;
$$;

create or replace function public.redeem_accessory(p_customer uuid, p_product uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cost int;
  have int;
  item_name text;
  stock int;
begin
  select points_price, name, stock_qty
    into cost, item_name, stock
  from public.products
  where id = p_product
    and coalesce(usage_kind, 'resellable') <> 'internal'
    and is_active
    and not is_archived
  for update;

  if cost is null or cost <= 0 then
    raise exception 'That item is not in the shop.';
  end if;
  if coalesce(stock, 0) <= 0 then
    raise exception 'That item is out of stock.';
  end if;

  select loyalty_points into have from public.customers where id = p_customer for update;
  if coalesce(have, 0) < cost then
    raise exception 'Not enough points.';
  end if;

  update public.customers set loyalty_points = have - cost where id = p_customer;
  update public.products
    set stock_qty = stock - 1, updated_at = now()
    where id = p_product;
  insert into public.loyalty_ledger (customer_id, delta, reason)
  values (p_customer, -cost, 'accessory_redeem');
  insert into public.accessory_redemptions (customer_id, product_id, points_spent)
  values (p_customer, p_product, cost);

  return jsonb_build_object('ok', true, 'loyalty_points', have - cost, 'name', item_name);
end;
$$;

revoke all on function public.redeem_accessory(uuid, uuid) from public, anon, authenticated;
grant execute on function public.redeem_accessory(uuid, uuid) to service_role;
