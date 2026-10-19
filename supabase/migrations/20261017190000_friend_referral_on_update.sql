-- Friend awards also run when staff edit a booking. The first saved friend code stays.
-- The discount uses the price on the row, including a price saved only as final_price_minor.

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
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if tg_op = 'UPDATE' and exists (
    select 1 from public.referral_credits where source_booking_id = new.id
  ) then
    if new.referral_source is distinct from old.referral_source
       or new.referred_by_name is distinct from old.referred_by_name
       or new.referred_by_staff_id is distinct from old.referred_by_staff_id then
      raise exception 'This friend code is already saved. It cannot be changed.';
    end if;
    return new;
  end if;

  if new.referral_source is distinct from 'friend_referral' then
    new.referred_customer_id := null;
    return new;
  end if;

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
  award_points int;
  award_rate numeric;
  payable int;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  select s.friend_points, s.discount_rate into award_points, award_rate
  from public.referral_program_settings() s;
  award_points := coalesce(award_points, 50);
  award_rate := coalesce(award_rate, 0.03);
  payable := coalesce(nullif(new.price_minor, 0), nullif(new.final_price_minor, 0), 0);

  if new.customer_id is not null
     and public.booking_is_detailing(new.service_id)
     and payable > 0
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
      own_price := greatest(0, payable - round(payable * award_rate)::int);
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

  select b.id, coalesce(nullif(b.price_minor, 0), nullif(b.final_price_minor, 0), 0)
    into open_id, open_price
  from public.bookings b
  where b.customer_id = new.referred_customer_id
    and b.id <> new.id
    and b.status in ('pending', 'confirmed', 'waiting')
    and public.booking_is_detailing(b.service_id)
    and coalesce(nullif(b.price_minor, 0), nullif(b.final_price_minor, 0), 0) > 0
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

drop trigger if exists bookings_friend_referral_before on public.bookings;
create trigger bookings_friend_referral_before
  before insert or update on public.bookings
  for each row execute function public.bookings_friend_referral_before();

drop trigger if exists bookings_friend_referral_after on public.bookings;
create trigger bookings_friend_referral_after
  after insert or update on public.bookings
  for each row execute function public.bookings_friend_referral_after();
