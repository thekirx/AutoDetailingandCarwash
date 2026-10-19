-- Promo voucher board: SA creates codes, Team Lead applies on the ticket, POS consumes on sale.

create table if not exists public.promo_vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  title text not null,
  rules_text text not null default '',
  discount_kind text not null default 'percent',
  discount_percent numeric(5, 2) not null default 0,
  applies_to text not null default 'any',
  starts_on date,
  ends_on date,
  max_uses integer not null,
  uses_count integer not null default 0,
  max_per_customer integer not null default 1,
  is_active boolean not null default true,
  created_by uuid references public.staff_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promo_vouchers_code_ck check (code ~ '^[A-Z0-9]{4,16}$'),
  constraint promo_vouchers_kind_ck check (discount_kind in ('percent', 'free')),
  constraint promo_vouchers_applies_ck check (applies_to in ('wash', 'detailing', 'any')),
  constraint promo_vouchers_percent_ck check (discount_percent >= 0 and discount_percent <= 100),
  constraint promo_vouchers_max_ck check (max_uses > 0),
  constraint promo_vouchers_uses_ck check (uses_count >= 0),
  constraint promo_vouchers_per_customer_ck check (max_per_customer > 0),
  constraint promo_vouchers_window_ck check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create unique index if not exists promo_vouchers_code_uidx on public.promo_vouchers (code);

create table if not exists public.promo_voucher_redemptions (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.promo_vouchers (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  sale_id uuid,
  customer_id uuid references public.customers (id) on delete set null,
  applied_by uuid references public.staff_profiles (id) on delete set null,
  discount_minor integer not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint promo_voucher_redemptions_booking_uidx unique (booking_id)
);

alter table public.bookings
  add column if not exists promo_voucher_id uuid references public.promo_vouchers (id) on delete set null,
  add column if not exists promo_discount_minor integer,
  add column if not exists promo_applied_by uuid references public.staff_profiles (id) on delete set null,
  add column if not exists promo_applied_at timestamptz;

create index if not exists bookings_promo_voucher_id_idx
  on public.bookings (promo_voucher_id)
  where promo_voucher_id is not null;

alter table public.promo_vouchers enable row level security;
alter table public.promo_voucher_redemptions enable row level security;

drop policy if exists promo_vouchers_staff_read on public.promo_vouchers;
create policy promo_vouchers_staff_read
  on public.promo_vouchers for select to authenticated
  using (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid() and sp.is_active = true
    )
  );

drop policy if exists promo_vouchers_customer_read on public.promo_vouchers;
create policy promo_vouchers_customer_read
  on public.promo_vouchers for select to authenticated
  using (
    is_active = true
    and exists (
      select 1 from public.customers c
      where c.id = auth.uid() and coalesce(c.is_archived, false) = false
    )
  );

drop policy if exists promo_vouchers_sa_write on public.promo_vouchers;
create policy promo_vouchers_sa_write
  on public.promo_vouchers for all to authenticated
  using (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid()
        and sp.is_active = true
        and sp.role::text in ('BossMich', 'assistant_super_admin')
    )
  )
  with check (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid()
        and sp.is_active = true
        and sp.role::text in ('BossMich', 'assistant_super_admin')
    )
  );

drop policy if exists promo_voucher_redemptions_staff_read on public.promo_voucher_redemptions;
create policy promo_voucher_redemptions_staff_read
  on public.promo_voucher_redemptions for select to authenticated
  using (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid() and sp.is_active = true
    )
  );

drop policy if exists promo_voucher_redemptions_own_read on public.promo_voucher_redemptions;
create policy promo_voucher_redemptions_own_read
  on public.promo_voucher_redemptions for select to authenticated
  using (customer_id = auth.uid());

grant select on public.promo_vouchers to authenticated;
grant select, insert, update, delete on public.promo_vouchers to authenticated;
grant select on public.promo_voucher_redemptions to authenticated;
revoke insert, update, delete on public.promo_voucher_redemptions from public, anon, authenticated;

create or replace function public.apply_booking_promo_voucher(p_booking_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
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
  if not found or staff.role::text is distinct from 'team_lead' then
    raise exception 'Only a Team Lead can apply a voucher code on the queue.';
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

create or replace function public.consume_booking_promo_voucher(p_booking_id uuid, p_sale_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  booking public.bookings%rowtype;
  voucher public.promo_vouchers%rowtype;
  redemption public.promo_voucher_redemptions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.staff_profiles sp
    where sp.id = auth.uid()
      and sp.is_active = true
      and sp.role::text in ('BossMich', 'assistant_super_admin', 'admin')
  ) then
    raise exception 'forbidden';
  end if;

  select * into booking from public.bookings where id = p_booking_id for update;
  if not found or booking.promo_voucher_id is null then
    return jsonb_build_object('ok', false, 'error', 'No voucher on this ticket.');
  end if;

  select * into voucher from public.promo_vouchers where id = booking.promo_voucher_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Voucher missing.');
  end if;

  select * into redemption
  from public.promo_voucher_redemptions
  where booking_id = booking.id
  for update;

  if redemption.id is not null and redemption.consumed_at is not null then
    return jsonb_build_object('ok', true, 'already', true, 'voucher_id', voucher.id);
  end if;

  if voucher.uses_count >= voucher.max_uses then
    return jsonb_build_object('ok', false, 'error', 'That voucher has no uses left.');
  end if;

  update public.promo_vouchers
  set uses_count = uses_count + 1, updated_at = clock_timestamp()
  where id = voucher.id;

  if redemption.id is not null then
    update public.promo_voucher_redemptions
    set
      sale_id = coalesce(p_sale_id, sale_id),
      customer_id = coalesce(booking.customer_id, customer_id),
      consumed_at = clock_timestamp(),
      discount_minor = coalesce(booking.promo_discount_minor, discount_minor)
    where id = redemption.id;
  else
    insert into public.promo_voucher_redemptions (
      voucher_id, booking_id, sale_id, customer_id, applied_by, discount_minor, consumed_at
    ) values (
      voucher.id,
      booking.id,
      p_sale_id,
      booking.customer_id,
      booking.promo_applied_by,
      coalesce(booking.promo_discount_minor, 0),
      clock_timestamp()
    );
  end if;

  return jsonb_build_object('ok', true, 'voucher_id', voucher.id, 'uses_count', voucher.uses_count + 1);
end;
$$;

revoke all on function public.apply_booking_promo_voucher(uuid, text) from public, anon;
grant execute on function public.apply_booking_promo_voucher(uuid, text) to authenticated;
revoke all on function public.consume_booking_promo_voucher(uuid, uuid) from public, anon;
grant execute on function public.consume_booking_promo_voucher(uuid, uuid) to authenticated;
