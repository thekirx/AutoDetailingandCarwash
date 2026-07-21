-- Smart loyalty: service scoring, stamp thresholds, membership CRUD support

alter table public.services
  add column if not exists loyalty_weight integer not null default 1
  check (loyalty_weight >= 0);

alter table public.customers
  add column if not exists loyalty_stamps integer not null default 0
  check (loyalty_stamps >= 0);

create table if not exists public.loyalty_program_settings (
  id smallint primary key default 1 check (id = 1),
  card_slots integer not null default 15 check (card_slots between 5 and 50),
  updated_at timestamptz not null default now()
);

insert into public.loyalty_program_settings (id, card_slots)
values (1, 15)
on conflict (id) do nothing;

create table if not exists public.loyalty_milestones (
  id uuid primary key default gen_random_uuid(),
  threshold_points integer not null check (threshold_points > 0),
  reward_label text not null,
  reward_description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint loyalty_milestones_threshold_unique unique (threshold_points)
);

create index if not exists idx_loyalty_milestones_active_sort
  on public.loyalty_milestones (sort_order, threshold_points)
  where is_active = true;

insert into public.loyalty_milestones (threshold_points, reward_label, reward_description, sort_order)
values
  (10, 'Free wash', 'Complimentary standard wash', 1),
  (15, 'Premium detail', 'Complimentary premium detail service', 2)
on conflict (threshold_points) do nothing;

-- Award weighted stamp points for a completed service visit
create or replace function public.award_loyalty_stamps(
  input_customer_id uuid,
  input_service_id uuid,
  input_quantity integer default 1
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  weight integer := 0;
  delta integer := 0;
begin
  if input_customer_id is null or input_service_id is null then
    return 0;
  end if;

  select coalesce(s.loyalty_weight, 1)
  into weight
  from public.services s
  where s.id = input_service_id
    and s.is_active
    and not s.is_archived;

  if weight is null or weight <= 0 then
    return 0;
  end if;

  delta := weight * greatest(coalesce(input_quantity, 1), 1);

  update public.customers c
  set loyalty_stamps = c.loyalty_stamps + delta,
      updated_at = clock_timestamp()
  where c.id = input_customer_id;

  return delta;
end;
$$;

revoke all on function public.award_loyalty_stamps(uuid, uuid, integer) from public, anon;
grant execute on function public.award_loyalty_stamps(uuid, uuid, integer) to authenticated;

-- POS sale: keep peso loyalty_points + add weighted stamps per service line
create or replace function public.complete_pos_sale(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller uuid := auth.uid();
  v_branch text := payload->>'branch';
  v_customer uuid := nullif(payload->>'customer_id', '')::uuid;
  v_booking uuid := nullif(payload->>'booking_id', '')::uuid;
  v_handoff uuid := nullif(payload->>'pos_handoff_id', '')::uuid;
  v_method text := coalesce(payload->>'payment_method', 'cash');
  v_status text := coalesce(payload->>'status', 'paid');
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
    subtotal_minor, total_minor, recorded_by
  ) values (
    v_branch, v_customer, v_booking, v_handoff, v_status, v_method, 0, 0, caller
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

-- Queue payment completion: add stamp award from booking service
create or replace function public.complete_payment(
  input_booking_id uuid,
  input_payment_method text,
  input_reference_number text default null,
  input_payment_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_role text;
  target_booking public.bookings%rowtype;
  target_handoff public.pos_handoffs%rowtype;
  target_transaction public.transactions%rowtype;
  completion_time timestamptz := clock_timestamp();
  stamps_awarded integer := 0;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  caller_role := public.current_user_role();
  if caller_role not in ('admin', 'BossMich', 'cashier') then
    raise exception using errcode = '42501', message = 'Only BossMich, admin, or cashier may complete payment';
  end if;

  select b.*
  into target_booking
  from public.bookings b
  where b.id = input_booking_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Booking not found';
  end if;

  if caller_role = 'cashier'
     and public.current_user_branch() is distinct from target_booking.branch then
    raise exception using errcode = '42501', message = 'Cashiers may only complete payments in their own branch';
  end if;

  select ph.*
  into target_handoff
  from public.pos_handoffs ph
  where ph.booking_id = input_booking_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Payment handoff not found';
  end if;

  select t.*
  into target_transaction
  from public.transactions t
  where t.id = target_handoff.transaction_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Payment transaction not found';
  end if;

  if target_transaction.status = 'completed' then
    return jsonb_build_object(
      'booking_id', input_booking_id,
      'transaction_id', target_transaction.id,
      'payment_completed', true,
      'reused', true
    );
  end if;

  update public.transactions t
  set status = 'completed',
      payment_method = input_payment_method,
      reference_number = input_reference_number,
      payment_notes = input_payment_notes,
      occurred_at = completion_time,
      updated_at = completion_time
  where t.id = target_transaction.id;

  update public.pos_handoffs ph
  set status = 'completed',
      completed_at = coalesce(ph.completed_at, completion_time),
      updated_at = completion_time
  where ph.id = target_handoff.id;

  update public.bookings b
  set status = 'completed',
      completed_at = coalesce(b.completed_at, completion_time),
      actual_end = coalesce(b.actual_end, completion_time),
      updated_at = completion_time
  where b.id = input_booking_id;

  update public.vehicles v
  set last_visit_at = completion_time,
      last_branch = target_booking.branch,
      total_visits = coalesce(v.total_visits, 0) + 1,
      updated_at = completion_time
  where v.id = target_booking.vehicle_id;

  if target_booking.customer_id is not null then
    update public.customers c
    set loyalty_points = coalesce(c.loyalty_points, 0)
          + floor(coalesce(target_handoff.amount_minor, 0) / 10000)::integer,
        updated_at = completion_time
    where c.id = target_booking.customer_id;

    stamps_awarded := public.award_loyalty_stamps(
      target_booking.customer_id,
      target_booking.service_id,
      1
    );
  end if;

  return jsonb_build_object(
    'booking_id', input_booking_id,
    'transaction_id', target_transaction.id,
    'payment_completed', true,
    'reused', false,
    'stamps_awarded', coalesce(stamps_awarded, 0)
  );
end;
$$;

revoke all on function public.complete_payment(uuid, text, text, text) from public, anon;
grant execute on function public.complete_payment(uuid, text, text, text) to authenticated;

alter table public.loyalty_program_settings enable row level security;
alter table public.loyalty_milestones enable row level security;

drop policy if exists "Public read loyalty settings" on public.loyalty_program_settings;
create policy "Public read loyalty settings"
  on public.loyalty_program_settings for select to anon, authenticated
  using (true);

drop policy if exists "Admins manage loyalty settings" on public.loyalty_program_settings;
create policy "Admins manage loyalty settings"
  on public.loyalty_program_settings for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Public read active milestones" on public.loyalty_milestones;
create policy "Public read active milestones"
  on public.loyalty_milestones for select to anon, authenticated
  using (is_active = true);

drop policy if exists "Admins read all milestones" on public.loyalty_milestones;
create policy "Admins read all milestones"
  on public.loyalty_milestones for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins manage milestones" on public.loyalty_milestones;
create policy "Admins manage milestones"
  on public.loyalty_milestones for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins manage customer memberships" on public.customer_memberships;
create policy "Admins manage customer memberships"
  on public.customer_memberships for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.loyalty_program_settings to anon, authenticated;
grant select, insert, update on public.loyalty_program_settings to authenticated;
grant select on public.loyalty_milestones to anon, authenticated;
grant select, insert, update, delete on public.loyalty_milestones to authenticated;
grant select, insert, update on public.customer_memberships to authenticated;
