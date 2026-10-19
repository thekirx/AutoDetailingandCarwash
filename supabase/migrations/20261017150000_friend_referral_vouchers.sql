-- Customer friend codes, 3% detailing credit for the sharer, 50 points for the friend,
-- and accessory point prices for the voucher shop.

alter table public.customers
  add column if not exists referral_code text;

create unique index if not exists customers_referral_code_uidx
  on public.customers (referral_code)
  where referral_code is not null;

alter table public.bookings
  add column if not exists referred_customer_id uuid references public.customers (id) on delete set null;

create index if not exists bookings_referred_customer_idx
  on public.bookings (referred_customer_id)
  where referred_customer_id is not null;

alter table public.bookings drop constraint if exists bookings_referral_source_check;
alter table public.bookings
  add constraint bookings_referral_source_check
  check (
    referral_source is null
    or referral_source in ('talked_to_employee', 'facebook_ads', 'social_media', 'friend_referral')
  );

alter table public.products
  add column if not exists points_price integer;

alter table public.products drop constraint if exists products_points_price_ck;
alter table public.products
  add constraint products_points_price_ck
  check (points_price is null or points_price >= 0);

create table if not exists public.referral_credits (
  id uuid primary key default gen_random_uuid(),
  referrer_customer_id uuid not null references public.customers (id) on delete restrict,
  source_booking_id uuid not null unique references public.bookings (id) on delete restrict,
  discount_rate numeric not null default 0.03,
  status text not null default 'available' check (status in ('available', 'applied')),
  applied_booking_id uuid references public.bookings (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists referral_credits_referrer_idx
  on public.referral_credits (referrer_customer_id, status, created_at);

create table if not exists public.accessory_redemptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  points_spent integer not null check (points_spent > 0),
  status text not null default 'pending' check (status in ('pending', 'fulfilled')),
  created_at timestamptz not null default now()
);

create index if not exists accessory_redemptions_customer_idx
  on public.accessory_redemptions (customer_id, created_at desc);

alter table public.referral_credits enable row level security;
alter table public.accessory_redemptions enable row level security;

drop policy if exists referral_credits_select on public.referral_credits;
create policy referral_credits_select
  on public.referral_credits for select to authenticated
  using (referrer_customer_id = auth.uid() or public.is_staff());

drop policy if exists accessory_redemptions_select on public.accessory_redemptions;
create policy accessory_redemptions_select
  on public.accessory_redemptions for select to authenticated
  using (customer_id = auth.uid() or public.is_staff());

grant select on public.referral_credits to authenticated;
grant select on public.accessory_redemptions to authenticated;

-- Backfill a code for every customer so a friend can use it before that person opens the app.
do $$
declare
  person record;
  code text;
  tries int;
begin
  for person in select id from public.customers where referral_code is null loop
    tries := 0;
    loop
      tries := tries + 1;
      code := 'HK' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      begin
        update public.customers set referral_code = code where id = person.id and referral_code is null;
        exit;
      exception when unique_violation then
        if tries > 8 then
          raise;
        end if;
      end;
    end loop;
  end loop;
end $$;

create or replace function public.booking_is_detailing(service uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.services
    where id = service and pay_category = 'detailing'
  );
$$;

create or replace function public.bookings_friend_referral_before()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  code text;
  referrer uuid;
begin
  if new.referral_source = 'friend_referral' then
    if not public.booking_is_detailing(new.service_id) then
      raise exception 'Friend codes apply to detailing bookings.';
    end if;
    if new.customer_id is null then
      raise exception 'Link this booking to a customer account before using a friend code.';
    end if;
    code := upper(regexp_replace(coalesce(new.referred_by_name, ''), '[^A-Za-z0-9]', '', 'g'));
    if length(code) < 4 then
      raise exception 'Enter your friend''s referral code.';
    end if;
    select id into referrer from public.customers where referral_code = code;
    if referrer is null then
      raise exception 'Friend code was not found.';
    end if;
    if referrer = new.customer_id then
      raise exception 'Use a friend''s code, not your own.';
    end if;
    new.referred_by_name := code;
    new.referred_customer_id := referrer;
    new.referred_by_staff_id := null;
  end if;

  return new;
end;
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
begin
  if new.customer_id is not null
     and public.booking_is_detailing(new.service_id)
     and coalesce(new.price_minor, 0) > 0
     and not exists (select 1 from public.referral_credits c where c.applied_booking_id = new.id) then
    select id into own_credit
    from public.referral_credits
    where referrer_customer_id = new.customer_id
      and status = 'available'
    order by created_at
    limit 1
    for update;
    if own_credit is not null then
      own_price := greatest(0, coalesce(new.price_minor, 0) - round(coalesce(new.price_minor, 0) * 0.03)::int);
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

  insert into public.referral_credits (referrer_customer_id, source_booking_id)
  values (new.referred_customer_id, new.id)
  on conflict (source_booking_id) do nothing
  returning id into credit_id;

  if credit_id is null then
    return new;
  end if;

  update public.customers
    set loyalty_points = coalesce(loyalty_points, 0) + 50
    where id = new.customer_id;

  insert into public.loyalty_ledger (customer_id, delta, reason)
  values (new.customer_id, 50, 'friend_referral');

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
    next_price := greatest(0, open_price - round(open_price * 0.03)::int);
    update public.bookings
      set price_minor = next_price, final_price_minor = next_price
      where id = open_id;
    update public.referral_credits
      set status = 'applied', applied_booking_id = open_id
      where id = credit_id;
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_friend_referral_before on public.bookings;
create trigger bookings_friend_referral_before
  before insert on public.bookings
  for each row execute function public.bookings_friend_referral_before();

drop trigger if exists bookings_friend_referral_after on public.bookings;
create trigger bookings_friend_referral_after
  after insert on public.bookings
  for each row execute function public.bookings_friend_referral_after();

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
    and category = 'accessories'
    and is_active
    and not is_archived
  for update;

  if cost is null or cost <= 0 then
    raise exception 'That accessory is not in the shop.';
  end if;
  if coalesce(stock, 0) <= 0 then
    raise exception 'That accessory is out of stock.';
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
