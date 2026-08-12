-- Follow-up: wire for_releasing + new roles into RLS/RPCs after hakum_ops_redesign.

-- Sales detailing board may set for_releasing / for_payment
drop policy if exists "Sales can update bookings across branches" on public.bookings;
create policy "Sales can update bookings across branches" on public.bookings
  for update to authenticated
  using (
    current_user_role() = 'sales'
    and (status)::text = any (array[
      'pending','confirmed','waiting','in_progress','final_checking','for_releasing','for_payment','completed','cancelled'
    ])
  )
  with check (
    current_user_role() = 'sales'
    and (status)::text = any (array[
      'pending','confirmed','waiting','in_progress','final_checking','for_releasing','for_payment','completed','cancelled'
    ])
  );

drop policy if exists "Sales can update form bookings" on public.bookings;
create policy "Sales can update form bookings" on public.bookings
  for update to authenticated
  using (
    current_user_role() = 'sales'
    and user_has_branch_access(branch)
    and (status)::text = any (array[
      'pending','confirmed','waiting','in_progress','final_checking','for_releasing','for_payment','completed','cancelled'
    ])
  )
  with check (
    current_user_role() = 'sales'
    and user_has_branch_access(branch)
    and (status)::text = any (array[
      'pending','confirmed','waiting','in_progress','final_checking','for_releasing','for_payment','completed','cancelled'
    ])
  );

-- Detailer: read + update detailing jobs on assigned branches
drop policy if exists "Detailers can read branch bookings" on public.bookings;
create policy "Detailers can read branch bookings" on public.bookings
  for select to authenticated
  using (
    current_user_role() = 'detailer'
    and user_has_branch_access(branch)
  );

drop policy if exists "Detailers can update detailing bookings" on public.bookings;
create policy "Detailers can update detailing bookings" on public.bookings
  for update to authenticated
  using (
    current_user_role() = 'detailer'
    and user_has_branch_access(branch)
    and exists (
      select 1 from public.services s
      where s.id = bookings.service_id
        and coalesce(s.pay_category, '') in ('detailing', 'ppf')
    )
  )
  with check (
    current_user_role() = 'detailer'
    and user_has_branch_access(branch)
    and exists (
      select 1 from public.services s
      where s.id = bookings.service_id
        and coalesce(s.pay_category, '') in ('detailing', 'ppf')
    )
  );

-- Attendance helpers include new floor roles
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.current_user_role() in (
    'admin', 'team_lead', 'staff', 'detailer', 'marketing', 'video_editor'
  );
$$;

-- Payment handoff accepts for_releasing
create or replace function public.send_queue_ticket_to_payment(input_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  caller_id uuid := (select auth.uid());
  caller_role text;
  caller_customer_id uuid;
  target_booking public.bookings%rowtype;
  anchor_booking public.bookings%rowtype;
  group_ids uuid[];
  target_handoff public.pos_handoffs%rowtype;
  target_amount integer;
  target_transaction_id uuid;
  release_time timestamptz := clock_timestamp();
  released_count integer := 0;
  handoff_created boolean := false;
  from_status text;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  caller_role := public.current_user_role();
  if caller_role not in ('admin', 'BossMich', 'assistant_super_admin', 'team_lead') then
    raise exception using errcode = '42501',
      message = 'Only Super Admin, Assistant Super Admin, Admin, or Team Lead may send a booking to payment';
  end if;

  if caller_role = 'assistant_super_admin' and not public.asa_has_grant('queue_all') then
    raise exception using errcode = '42501',
      message = 'Sending to payment requires the queue_all grant';
  end if;

  select b.*
  into target_booking
  from public.bookings b
  where b.id = input_booking_id
    and not coalesce(b.is_archived, false)
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Booking not found';
  end if;

  if not public.user_has_branch_access(target_booking.branch) then
    raise exception using errcode = '42501',
      message = 'You do not have access to send this branch booking to payment';
  end if;

  from_status := target_booking.status::text;

  if from_status not in ('in_progress', 'final_checking', 'for_releasing', 'for_payment', 'completed') then
    raise exception using errcode = '23514',
      message = 'Booking must be in progress, final checking, for releasing, for payment, or completed';
  end if;

  if target_booking.customer_id is null or target_booking.service_id is null then
    raise exception using errcode = '23502',
      message = 'Booking requires a customer and service before payment handoff';
  end if;

  if target_booking.visit_group_id is not null then
    select array_agg(id) into group_ids
    from (
      select b.id
      from public.bookings b
      where b.visit_group_id = target_booking.visit_group_id
        and not coalesce(b.is_archived, false)
        and b.status::text not in ('completed', 'cancelled')
      order by b.created_at
      for update
    ) locked;
  end if;
  if group_ids is null or array_length(group_ids, 1) is null then
    group_ids := array[target_booking.id];
  end if;

  select b.* into anchor_booking
  from public.bookings b
  where b.id = group_ids[1];

  select coalesce(sum(coalesce(b.price_minor, b.final_price_minor, s.price_minor, 0)), 0)
  into target_amount
  from public.bookings b
  left join public.services s on s.id = b.service_id
  where b.id = any(group_ids);

  if coalesce(target_amount, 0) <= 0 then
    raise exception using errcode = '23514', message = 'Booking requires a positive payment amount';
  end if;

  select c.id
  into caller_customer_id
  from public.customers c
  where c.id = caller_id
    and not coalesce(c.is_archived, false)
  limit 1;

  select ph.*
  into target_handoff
  from public.pos_handoffs ph
  where ph.booking_id = any(group_ids)
  order by ph.created_at
  limit 1
  for update;

  if not found then
    insert into public.pos_handoffs (
      booking_id, customer_id, vehicle_id, branch, amount_minor,
      currency, status, handed_off_by, handed_off_at
    )
    values (
      anchor_booking.id, anchor_booking.customer_id, anchor_booking.vehicle_id,
      anchor_booking.branch, target_amount, 'PHP', 'pending', caller_id,
      release_time
    )
    returning * into target_handoff;
    handoff_created := true;
  else
    update public.pos_handoffs ph
    set customer_id = anchor_booking.customer_id,
        vehicle_id = anchor_booking.vehicle_id,
        branch = anchor_booking.branch,
        amount_minor = target_amount,
        currency = coalesce(ph.currency, 'PHP'),
        status = case when ph.status = 'completed' then ph.status else 'pending' end,
        handed_off_by = coalesce(ph.handed_off_by, caller_id),
        handed_off_at = coalesce(ph.handed_off_at, release_time),
        updated_at = release_time
    where ph.id = target_handoff.id
    returning * into target_handoff;
  end if;

  target_transaction_id := target_handoff.transaction_id;
  if target_transaction_id is null then
    select t.id
    into target_transaction_id
    from public.transactions t
    where t.booking_id = target_handoff.booking_id
      and t.type = 'sale'
      and not coalesce(t.is_archived, false)
    order by t.created_at desc
    limit 1
    for update;
  end if;

  if target_transaction_id is null then
    insert into public.transactions (
      booking_id, customer_id, vehicle_id, pos_handoff_id, recorded_by,
      type, amount_minor, currency, description, occurred_at, status
    )
    values (
      target_handoff.booking_id, anchor_booking.customer_id, anchor_booking.vehicle_id,
      target_handoff.id, caller_customer_id, 'sale', target_amount, 'PHP',
      'Queue ticket pending payment', release_time, 'pending_payment'
    )
    returning id into target_transaction_id;
  else
    update public.transactions t
    set customer_id = anchor_booking.customer_id,
        vehicle_id = anchor_booking.vehicle_id,
        pos_handoff_id = target_handoff.id,
        recorded_by = coalesce(t.recorded_by, caller_customer_id),
        amount_minor = target_amount,
        currency = coalesce(t.currency, 'PHP'),
        description = coalesce(t.description, 'Queue ticket pending payment'),
        status = case when t.status = 'completed' then t.status else 'pending_payment' end,
        updated_at = release_time
    where t.id = target_transaction_id;
  end if;

  update public.pos_handoffs ph
  set transaction_id = target_transaction_id,
      updated_at = release_time
  where ph.id = target_handoff.id;

  update public.bookings b
  set status = 'for_payment',
      final_checking_at = coalesce(b.final_checking_at, release_time),
      final_checked_by = coalesce(b.final_checked_by, caller_customer_id),
      for_payment_at = coalesce(b.for_payment_at, release_time),
      sent_to_payment_at = coalesce(b.sent_to_payment_at, release_time),
      sent_to_payment_by = coalesce(b.sent_to_payment_by, caller_customer_id),
      actual_end = coalesce(b.actual_end, release_time),
      updated_at = release_time
  where b.id = any(group_ids)
    and b.status::text in ('waiting', 'in_progress', 'final_checking', 'for_releasing');

  update public.queue_assignments qa
  set status = 'released',
      released_at = coalesce(qa.released_at, release_time),
      completed_at = coalesce(qa.completed_at, qa.released_at, release_time)
  where qa.booking_id = any(group_ids)
    and qa.status = 'active';

  get diagnostics released_count = row_count;

  return jsonb_build_object(
    'booking_id', target_booking.id,
    'anchor_booking_id', target_handoff.booking_id,
    'group_booking_ids', to_jsonb(group_ids),
    'amount_minor', target_amount,
    'handoff_id', target_handoff.id,
    'released_assignment_count', released_count,
    'handoff_created', handoff_created,
    'from_status', from_status,
    'to_status', case
      when from_status in ('waiting', 'in_progress', 'final_checking', 'for_releasing') then 'for_payment'
      else from_status
    end
  );
end;
$function$;

-- Admin override may leave for_releasing
create or replace function public.admin_override_queue_status(
  input_booking_id uuid,
  input_next_status text,
  input_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  caller_id uuid := (select auth.uid());
  caller_role text;
  target_booking public.bookings%rowtype;
  group_ids uuid[];
  from_status text;
  next_status text := lower(trim(coalesce(input_next_status, '')));
  release_time timestamptz := clock_timestamp();
  cancelled_handoffs integer := 0;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  caller_role := public.current_user_role();
  if caller_role not in ('admin', 'BossMich', 'assistant_super_admin') then
    raise exception using errcode = '42501',
      message = 'Only Branch Admin, Super Admin, or Assistant Super Admin may override queue status';
  end if;

  if caller_role = 'assistant_super_admin' and not public.asa_has_grant('queue_all') then
    raise exception using errcode = '42501',
      message = 'Queue override requires the queue_all grant';
  end if;

  if next_status not in ('waiting', 'in_progress', 'final_checking', 'for_releasing') then
    raise exception using errcode = '23514',
      message = 'Override target must be waiting, in progress, final checking, or for releasing';
  end if;

  select b.*
  into target_booking
  from public.bookings b
  where b.id = input_booking_id
    and not coalesce(b.is_archived, false)
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Booking not found';
  end if;

  if not public.user_has_branch_access(target_booking.branch) then
    raise exception using errcode = '42501',
      message = 'You do not have access to override this branch booking';
  end if;

  from_status := target_booking.status::text;
  if from_status not in ('waiting', 'in_progress', 'final_checking', 'for_releasing', 'for_payment', 'redo') then
    raise exception using errcode = '23514',
      message = 'Only open queue tickets can be overridden';
  end if;
  if from_status = next_status then
    raise exception using errcode = '23514', message = 'Ticket is already in that status';
  end if;

  if target_booking.visit_group_id is not null then
    select array_agg(id) into group_ids
    from (
      select b.id
      from public.bookings b
      where b.visit_group_id = target_booking.visit_group_id
        and not coalesce(b.is_archived, false)
        and b.status::text not in ('completed', 'cancelled')
      order by b.created_at
      for update
    ) locked;
  end if;
  if group_ids is null or array_length(group_ids, 1) is null then
    group_ids := array[target_booking.id];
  end if;

  update public.pos_handoffs ph
  set status = 'cancelled', updated_at = release_time
  where ph.booking_id = any(group_ids)
    and ph.status = 'pending';
  get diagnostics cancelled_handoffs = row_count;

  update public.transactions t
  set status = 'cancelled', updated_at = release_time
  where t.status = 'pending_payment'
    and t.pos_handoff_id in (
      select ph.id from public.pos_handoffs ph where ph.booking_id = any(group_ids)
    );

  update public.bookings b
  set status = next_status::public.booking_status,
      waiting_at = case when next_status = 'waiting' then release_time else b.waiting_at end,
      in_progress_at = case when next_status = 'in_progress' then release_time else b.in_progress_at end,
      actual_start = case when next_status = 'in_progress' then coalesce(b.actual_start, release_time) else b.actual_start end,
      final_checking_at = case when next_status = 'final_checking' then release_time else b.final_checking_at end,
      updated_at = release_time
  where b.id = any(group_ids);

  insert into public.queue_events (booking_id, branch, old_status, new_status, notes)
  values (
    target_booking.id,
    target_booking.branch,
    from_status,
    next_status,
    'Admin override' || case when nullif(trim(coalesce(input_reason, '')), '') is null
      then '' else ': ' || trim(input_reason) end
  );

  return jsonb_build_object(
    'booking_id', target_booking.id,
    'group_booking_ids', to_jsonb(group_ids),
    'from_status', from_status,
    'to_status', next_status,
    'cancelled_handoffs', cancelled_handoffs
  );
end;
$function$;

-- Investor finance/reports read (sales + expenses)
drop policy if exists "Investors can read sales" on public.sales;
create policy "Investors can read sales" on public.sales
  for select to authenticated
  using (
    current_user_role() = 'investor'
    and user_has_branch_access(branch)
  );

drop policy if exists "Investors can read expenses" on public.expenses;
create policy "Investors can read expenses" on public.expenses
  for select to authenticated
  using (
    current_user_role() = 'investor'
    and user_has_branch_access(branch)
  );

-- Vehicle photos storage bucket (public read; authenticated write)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicle-photos',
  'vehicle-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Vehicle photos public read" on storage.objects;
create policy "Vehicle photos public read" on storage.objects
  for select to public
  using (bucket_id = 'vehicle-photos');

drop policy if exists "Vehicle photos authenticated upload" on storage.objects;
create policy "Vehicle photos authenticated upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vehicle-photos');

drop policy if exists "Vehicle photos authenticated update" on storage.objects;
create policy "Vehicle photos authenticated update" on storage.objects
  for update to authenticated
  using (bucket_id = 'vehicle-photos')
  with check (bucket_id = 'vehicle-photos');
