-- Checkout and Branch Admin can apply a voucher on a queue ticket.
-- The 19 Oct function allowed only team_lead. This replaces that gate.
-- The rest of the body is unchanged.

create or replace function public.apply_booking_promo_voucher(p_booking_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  staff public.staff_profiles%rowtype;
  booking public.bookings%rowtype;
  voucher public.promo_vouchers%rowtype;
  normalized text;
  today_key date := (timezone('Asia/Manila', now()))::date;
  service_cat text;
  service_slug text;
  holds int;
  prior int;
  list_price int;
  new_price int;
  discount int;
  is_detailing boolean;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into staff from public.staff_profiles where id = auth.uid() and is_active = true;
  if not found
     or staff.role::text not in ('team_lead', 'admin', 'BossMich', 'assistant_super_admin', 'operations_lead') then
    raise exception 'Only the Team Lead, Branch Admin, or office can apply a voucher.';
  end if;

  normalized := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if char_length(normalized) < 4 or char_length(normalized) > 16 then
    return jsonb_build_object('ok', false, 'error', 'Type a voucher code of 4 to 16 letters or numbers.');
  end if;

  select * into booking from public.bookings where id = p_booking_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Ticket not found.');
  end if;
  if booking.status in ('completed', 'cancelled') then
    return jsonb_build_object('ok', false, 'error', 'That ticket is already closed.');
  end if;
  if booking.promo_voucher_id is not null then
    return jsonb_build_object('ok', false, 'error', 'This ticket already has a voucher.');
  end if;

  select * into voucher
  from public.promo_vouchers
  where code = normalized
  for update;
  if not found or voucher.is_active is not true then
    return jsonb_build_object('ok', false, 'error', 'That voucher code was not found.');
  end if;
  if voucher.starts_on is not null and today_key < voucher.starts_on then
    return jsonb_build_object('ok', false, 'error', 'That voucher is not open yet.');
  end if;
  if voucher.ends_on is not null and today_key > voucher.ends_on then
    return jsonb_build_object('ok', false, 'error', 'That voucher has expired.');
  end if;

  select count(*)::int into holds
  from public.bookings b
  where b.promo_voucher_id = voucher.id
    and b.status not in ('completed', 'cancelled');
  if voucher.uses_count + holds >= voucher.max_uses then
    return jsonb_build_object('ok', false, 'error', 'That voucher has no uses left.');
  end if;

  if booking.customer_id is not null then
    select count(*)::int into prior
    from public.promo_voucher_redemptions r
    where r.voucher_id = voucher.id
      and r.customer_id = booking.customer_id
      and r.consumed_at is not null;
    if prior >= voucher.max_per_customer then
      return jsonb_build_object('ok', false, 'error', 'This customer already used that voucher.');
    end if;
  end if;

  select s.pay_category::text, s.slug
  into service_cat, service_slug
  from public.services s
  where s.id = booking.service_id;

  is_detailing :=
    coalesce(service_cat, '') = 'detailing'
    or coalesce(service_slug, '') in ('ceramic-coating', 'paint-maintenance', 'nano-ceramic-tint', 'ppf');

  if voucher.applies_to = 'detailing' and not is_detailing then
    return jsonb_build_object('ok', false, 'error', 'That voucher is for detailing only.');
  end if;
  if voucher.applies_to = 'wash' and is_detailing then
    return jsonb_build_object('ok', false, 'error', 'That voucher is for wash and packages only.');
  end if;

  list_price := coalesce(booking.final_price_minor, booking.price_minor, 0);
  if voucher.discount_kind = 'free' then
    new_price := 0;
  else
    new_price := greatest(0, round(list_price * (1 - (voucher.discount_percent / 100.0)))::int);
  end if;
  discount := greatest(0, list_price - new_price);

  update public.bookings
  set
    promo_voucher_id = voucher.id,
    promo_discount_minor = discount,
    promo_applied_by = staff.id,
    promo_applied_at = clock_timestamp(),
    final_price_minor = new_price,
    updated_at = clock_timestamp()
  where id = booking.id;

  insert into public.promo_voucher_redemptions (
    voucher_id, booking_id, customer_id, applied_by, discount_minor
  ) values (
    voucher.id, booking.id, booking.customer_id, staff.id, discount
  );

  return jsonb_build_object(
    'ok', true,
    'voucher_id', voucher.id,
    'code', voucher.code,
    'title', voucher.title,
    'discount_minor', discount,
    'final_price_minor', new_price
  );
end;
$$;

revoke all on function public.apply_booking_promo_voucher(uuid, text) from public, anon;
grant execute on function public.apply_booking_promo_voucher(uuid, text) to authenticated;
