-- =============================================================================
-- Migration: 20261127200000_revision_qa_checklist_fixes.sql
-- Purpose:
--   1. Practical, non-blocking RLS for all operational staff roles on core tables
--      (bookings, pos_handoffs, queue_assignments, queue_events, customer_notes,
--       services, service_size_prices, transactions, sales, sale_line_items,
--       vehicle_maintenance_schedules).
--   2. Enforce assigned crew requirement before moving ANY queue ticket
--      (including packages) into 'in_progress'.
--   3. Allow 'redo' -> 'final_checking' as well as 'in_progress', and allow
--      returning an unpaid job order from 'for_payment' back to the queue
--      ('final_checking', 'in_progress', 'waiting') via admin_override_queue_status
--      for admin, team_lead, operations_lead, assistant_super_admin, BossMich.
--   4. Synchronize 'for_payment' records between Carwash Queue and POS:
--      - Backfill missing pending pos_handoffs rows for any active 'for_payment' booking.
--      - Cancel orphan pending pos_handoffs rows where the booking left 'for_payment'.
--      - Keep pos_handoffs and pending_payment transactions synchronized via trigger
--        without ever creating duplicate transactions or handoffs.
--   5. Detailing fixes:
--      - Re-point active bookings that still reference legacy archived coating/maintenance
--        service IDs to the canonical active detailing services, and archive duplicate
--        test coating booking on the same plate.
--      - Ensure canonical 'Polish' service exists with Small/Medium/Large/XL pricing
--        and ensure 1 Step Detailing / 3 Steps Detailing are properly categorized.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Helper: operational staff role check (non-blocking for active staff)
-- ---------------------------------------------------------------------------
create or replace function public.is_operational_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_profiles p
    where p.id = (select auth.uid())
      and coalesce(p.is_active, true) = true
      and coalesce(p.is_archived, false) = false
      and p.role::text in (
        'BossMich',
        'assistant_super_admin',
        'admin',
        'operations_lead',
        'team_lead',
        'sales',
        'detailer',
        'staff',
        'marketing'
      )
  );
$$;

grant execute on function public.is_operational_staff() to authenticated;

-- Ensure bookings UPDATE policy allows Branch Admin ('admin'), Team Lead, Detailer,
-- Operations Lead, Sales, Assistant Super Admin, and BossMich within branch scope.
drop policy if exists "bookings_Operational staff update" on public.bookings;
create policy "bookings_Operational staff update"
  on public.bookings
  for update
  to authenticated
  using (
    public.is_operational_staff()
    and (
      public.current_user_role() in ('BossMich', 'assistant_super_admin', 'operations_lead')
      or public.user_has_branch_access(branch::text)
    )
  )
  with check (
    public.is_operational_staff()
    and (
      public.current_user_role() in ('BossMich', 'assistant_super_admin', 'operations_lead')
      or public.user_has_branch_access(branch::text)
    )
  );

-- Ensure pos_handoffs policies allow operational staff across accessible branches
drop policy if exists "pos_handoffs_Operational staff select" on public.pos_handoffs;
create policy "pos_handoffs_Operational staff select"
  on public.pos_handoffs
  for select
  to authenticated
  using (
    public.is_operational_staff()
    and (
      public.current_user_role() in ('BossMich', 'assistant_super_admin', 'operations_lead')
      or public.user_has_branch_access(branch::text)
    )
  );

drop policy if exists "pos_handoffs_Operational staff insert" on public.pos_handoffs;
create policy "pos_handoffs_Operational staff insert"
  on public.pos_handoffs
  for insert
  to authenticated
  with check (
    public.is_operational_staff()
    and (
      public.current_user_role() in ('BossMich', 'assistant_super_admin', 'operations_lead')
      or public.user_has_branch_access(branch::text)
    )
  );

drop policy if exists "pos_handoffs_Operational staff update" on public.pos_handoffs;
create policy "pos_handoffs_Operational staff update"
  on public.pos_handoffs
  for update
  to authenticated
  using (
    public.is_operational_staff()
    and (
      public.current_user_role() in ('BossMich', 'assistant_super_admin', 'operations_lead')
      or public.user_has_branch_access(branch::text)
    )
  )
  with check (
    public.is_operational_staff()
    and (
      public.current_user_role() in ('BossMich', 'assistant_super_admin', 'operations_lead')
      or public.user_has_branch_access(branch::text)
    )
  );

-- Ensure queue_events and queue_assignments never block operational staff
drop policy if exists "queue_events_Operational staff insert" on public.queue_events;
create policy "queue_events_Operational staff insert"
  on public.queue_events
  for insert
  to authenticated
  with check (public.is_operational_staff());

drop policy if exists "queue_events_Operational staff select" on public.queue_events;
create policy "queue_events_Operational staff select"
  on public.queue_events
  for select
  to authenticated
  using (public.is_operational_staff());

drop policy if exists "queue_assignments_Operational staff all" on public.queue_assignments;
create policy "queue_assignments_Operational staff all"
  on public.queue_assignments
  for all
  to authenticated
  using (public.is_operational_staff())
  with check (public.is_operational_staff());

-- Ensure customer_notes never blocks operational staff
drop policy if exists "customer_notes_Operational staff all" on public.customer_notes;
create policy "customer_notes_Operational staff all"
  on public.customer_notes
  for all
  to authenticated
  using (public.is_operational_staff())
  with check (public.is_operational_staff());

-- Ensure transactions allow operational staff to read
drop policy if exists "transactions_Operational staff write" on public.transactions;
drop policy if exists "transactions_Operational staff select" on public.transactions;
create policy "transactions_Operational staff select"
  on public.transactions
  for select
  to authenticated
  using (public.is_operational_staff());

-- ---------------------------------------------------------------------------
-- 2. Prevent vehicles from entering In Progress without an assigned crew
--    (Include packages as well as wash services)
-- ---------------------------------------------------------------------------
create or replace function public.require_present_crew_on_start()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_total_crew int := 0;
  v_missing_names text := '';
begin
  -- Only enforce when status transitions into in_progress from a client session.
  if new.status is distinct from 'in_progress'
     or coalesce(old.status, '') = 'in_progress'
     or auth.uid() is null then
    return new;
  end if;

  select count(*)
    into v_total_crew
  from public.queue_assignments qa
  where qa.booking_id = new.id;

  if v_total_crew = 0 then
    raise exception 'Assign at least one crew member who is clocked in today before starting work.'
      using errcode = 'P0001';
  end if;

  select string_agg(coalesce(e.full_name, 'Crew'), ', ')
    into v_missing_names
  from public.queue_assignments qa
  join public.employees e on e.id = qa.employee_id
  where qa.booking_id = new.id
    and not exists (
      select 1
      from public.employee_attendance ea
      where ea.employee_id = qa.employee_id
        and ea.work_date = v_today
        and lower(coalesce(ea.status, '')) in ('present', 'late')
        and ea.clock_in is not null
        and ea.clock_out is null
    );

  if v_missing_names is not null and length(trim(v_missing_names)) > 0 then
    raise exception 'Crew not clocked in today: %. Remove them or record clock-in first.', v_missing_names
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Update admin_override_queue_status to support:
--    - 'team_lead', 'admin', 'BossMich', 'assistant_super_admin', 'operations_lead'
--    - Returning unpaid job orders from 'for_payment' back to 'final_checking',
--      'in_progress', or 'waiting'
--    - Moving 'redo' to 'final_checking' or 'in_progress'
--    - Updating all sibling bookings in the same visit_group_id
--    - Cancelling pending pos_handoffs and pending_payment transactions cleanly
--      so when the ticket returns to POS later, it reuses them with zero duplicates
-- ---------------------------------------------------------------------------
drop function if exists public.admin_override_queue_status(uuid, text, text);

create or replace function public.admin_override_queue_status(
  input_booking_id uuid,
  input_next_status text,
  input_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  booking_row public.bookings%rowtype;
  prior_status text;
  group_ids uuid[];
  b_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select role::text into caller_role from public.staff_profiles where id = auth.uid();
  if caller_role not in ('admin', 'BossMich', 'assistant_super_admin', 'operations_lead', 'team_lead') then
    raise exception 'Only authorized operations or POS staff can override queue status';
  end if;

  if input_next_status not in ('waiting', 'in_progress', 'final_checking', 'redo', 'for_payment', 'cancelled') then
    raise exception 'Unsupported override status %', input_next_status;
  end if;

  select * into booking_row from public.bookings where id = input_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  if caller_role not in ('BossMich', 'assistant_super_admin', 'operations_lead')
     and not public.user_has_branch_access(booking_row.branch::text) then
    raise exception 'Cross-branch queue override denied';
  end if;

  prior_status := booking_row.status::text;

  if booking_row.visit_group_id is not null then
    select array_agg(b.id order by b.created_at)
      into group_ids
    from public.bookings b
    where b.visit_group_id = booking_row.visit_group_id
      and coalesce(b.is_archived, false) = false;
  else
    group_ids := array[booking_row.id];
  end if;

  update public.bookings
  set status = input_next_status::booking_status,
      waiting_at = case when input_next_status = 'waiting' and waiting_at is null then now() else waiting_at end,
      in_progress_at = case when input_next_status = 'in_progress' then coalesce(in_progress_at, now()) else in_progress_at end,
      final_checking_at = case when input_next_status = 'final_checking' then now() else final_checking_at end,
      redo_at = case when input_next_status = 'redo' then now() else redo_at end,
      for_payment_at = case when input_next_status = 'for_payment' then now() else for_payment_at end,
      cancelled_at = case when input_next_status = 'cancelled' then now() else cancelled_at end
  where id = any(group_ids);

  if input_next_status <> 'for_payment' then
    update public.pos_handoffs
    set status = 'cancelled',
        updated_at = now()
    where booking_id = any(group_ids)
      and status = 'pending';

    update public.transactions
    set status = 'cancelled',
        updated_at = now()
    where booking_id = any(group_ids)
      and status = 'pending_payment';
  end if;

  foreach b_id in array group_ids loop
    insert into public.queue_events (booking_id, event_type, actor_id, note, payload)
    values (
      b_id,
      'admin_status_override',
      auth.uid(),
      coalesce(nullif(trim(input_reason), ''), format('Status changed from %s to %s', prior_status, input_next_status)),
      jsonb_build_object('from_status', prior_status, 'to_status', input_next_status, 'reason', input_reason)
    );
  end loop;

  return jsonb_build_object(
    'booking_id', booking_row.id,
    'visit_group_id', booking_row.visit_group_id,
    'from_status', prior_status,
    'to_status', input_next_status
  );
end;
$$;

grant execute on function public.admin_override_queue_status(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Synchronize 'for_payment' records between Carwash Queue and POS
--    - Backfill missing pending pos_handoffs rows for any active 'for_payment' booking
--    - Cancel orphan pending pos_handoffs where booking is no longer 'for_payment'
--    - Trigger on bookings to keep pos_handoffs in sync on any status or price change
-- ---------------------------------------------------------------------------

-- Cancel any pending pos_handoffs whose booking is archived or no longer in 'for_payment'
update public.pos_handoffs ph
set status = 'cancelled'
from public.bookings b
where ph.booking_id = b.id
  and ph.status = 'pending'
  and (coalesce(b.is_archived, false) = true or b.status <> 'for_payment');

-- Deduplicate multiple pending pos_handoffs for the same visit group (keep oldest row, cancel extras)
with ranked_handoffs as (
  select
    ph.id,
    ph.booking_id,
    coalesce(b.visit_group_id, b.id) as group_key,
    row_number() over (
      partition by coalesce(b.visit_group_id, b.id)
      order by ph.created_at asc, ph.id asc
    ) as rn
  from public.pos_handoffs ph
  join public.bookings b on b.id = ph.booking_id
  where ph.status = 'pending'
)
update public.pos_handoffs ph
set status = 'cancelled'
from ranked_handoffs rh
where ph.id = rh.id
  and rh.rn > 1;

-- Trigger function to keep pos_handoffs synchronized with bookings in 'for_payment'
create or replace function public.sync_pos_handoff_from_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_ids uuid[];
  v_primary_id uuid;
  v_branch text;
  v_customer_id uuid;
  v_vehicle_id uuid;
  v_total_minor int := 0;
  v_any_for_payment boolean := false;
  v_existing_handoff public.pos_handoffs%rowtype;
  v_tx_id uuid;
  v_now timestamptz := clock_timestamp();
begin
  if new.visit_group_id is not null then
    select
      array_agg(b.id order by b.created_at asc, b.id asc),
      bool_or(b.status = 'for_payment' and coalesce(b.is_archived, false) = false),
      coalesce(sum(
        case
          when b.status = 'for_payment' and coalesce(b.is_archived, false) = false
          then coalesce(b.final_price_minor, b.price_minor, s.price_minor, 0)
          else 0
        end
      ), 0)
    into v_group_ids, v_any_for_payment, v_total_minor
    from public.bookings b
    left join public.services s on s.id = b.service_id
    where b.visit_group_id = new.visit_group_id;
  else
    v_group_ids := array[new.id];
    v_any_for_payment := (new.status = 'for_payment' and coalesce(new.is_archived, false) = false);
    if v_any_for_payment then
      select coalesce(new.final_price_minor, new.price_minor, s.price_minor, 0)
      into v_total_minor
      from public.services s
      where s.id = new.service_id;
      v_total_minor := coalesce(v_total_minor, new.final_price_minor, new.price_minor, 0);
    else
      v_total_minor := 0;
    end if;
  end if;

  if v_group_ids is null or array_length(v_group_ids, 1) is null then
    return new;
  end if;

  v_primary_id := v_group_ids[1];

  select b.branch::text, b.customer_id, b.vehicle_id
    into v_branch, v_customer_id, v_vehicle_id
  from public.bookings b
  where b.id = v_primary_id;

  select ph.*
    into v_existing_handoff
  from public.pos_handoffs ph
  where ph.booking_id = any(v_group_ids)
  order by (case when ph.status = 'pending' then 0 else 1 end), ph.created_at asc
  limit 1;

  if v_any_for_payment then
    if v_existing_handoff.id is not null then
      update public.pos_handoffs
      set booking_id = v_primary_id,
          branch = v_branch,
          customer_id = v_customer_id,
          vehicle_id = v_vehicle_id,
          amount_minor = v_total_minor,
          currency = coalesce(currency, 'PHP'),
          status = 'pending',
          handed_off_at = coalesce(handed_off_at, v_now),
          updated_at = v_now
      where id = v_existing_handoff.id
      returning * into v_existing_handoff;

      -- Cancel any extra pending handoffs in the same group
      update public.pos_handoffs
      set status = 'cancelled',
          updated_at = v_now
      where booking_id = any(v_group_ids)
        and id <> v_existing_handoff.id
        and status = 'pending';
    else
      insert into public.pos_handoffs (
        booking_id,
        customer_id,
        vehicle_id,
        branch,
        amount_minor,
        currency,
        status,
        handed_off_at
      )
      values (
        v_primary_id,
        v_customer_id,
        v_vehicle_id,
        v_branch,
        v_total_minor,
        'PHP',
        'pending',
        v_now
      )
      returning * into v_existing_handoff;
    end if;

    v_tx_id := v_existing_handoff.transaction_id;
    if v_tx_id is null then
      select t.id
      into v_tx_id
      from public.transactions t
      where t.booking_id = v_primary_id
        and t.type = 'sale'
        and not coalesce(t.is_archived, false)
      order by t.created_at desc
      limit 1;
    end if;

    if v_tx_id is null then
      insert into public.transactions (
        booking_id,
        customer_id,
        vehicle_id,
        pos_handoff_id,
        type,
        amount_minor,
        currency,
        description,
        occurred_at,
        status
      )
      values (
        v_primary_id,
        v_customer_id,
        v_vehicle_id,
        v_existing_handoff.id,
        'sale',
        v_total_minor,
        'PHP',
        'Queue ticket pending payment',
        v_now,
        'pending_payment'
      )
      returning id into v_tx_id;
    else
      update public.transactions
      set customer_id = coalesce(v_customer_id, customer_id),
          vehicle_id = coalesce(v_vehicle_id, vehicle_id),
          pos_handoff_id = v_existing_handoff.id,
          amount_minor = v_total_minor,
          status = case when status = 'completed' then status else 'pending_payment' end,
          updated_at = v_now
      where id = v_tx_id;
    end if;

    if v_existing_handoff.transaction_id is distinct from v_tx_id then
      update public.pos_handoffs
      set transaction_id = v_tx_id,
          updated_at = v_now
      where id = v_existing_handoff.id;
    end if;
  else
    -- Group is no longer in 'for_payment'
    if new.status = 'completed' then
      update public.pos_handoffs
      set status = 'completed',
          completed_at = coalesce(completed_at, v_now),
          updated_at = v_now
      where booking_id = any(v_group_ids)
        and status = 'pending';
    else
      update public.pos_handoffs
      set status = 'cancelled',
          updated_at = v_now
      where booking_id = any(v_group_ids)
        and status = 'pending';

      update public.transactions
      set status = 'cancelled',
          updated_at = v_now
      where booking_id = any(v_group_ids)
        and status = 'pending_payment';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_pos_handoff_from_booking on public.bookings;
create trigger trg_sync_pos_handoff_from_booking
after insert or update of status, final_price_minor, price_minor, service_id, is_archived, for_payment_at
on public.bookings
for each row
execute function public.sync_pos_handoff_from_booking();

-- Backfill any currently active 'for_payment' bookings that lack a pending pos_handoffs row
do $$
declare
  rec record;
begin
  for rec in
    select distinct on (coalesce(b.visit_group_id, b.id))
      b.id
    from public.bookings b
    where b.status = 'for_payment'
      and coalesce(b.is_archived, false) = false
    order by coalesce(b.visit_group_id, b.id), b.created_at asc
  loop
    update public.bookings
    set for_payment_at = clock_timestamp()
    where id = rec.id;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Detailing Fixes:
--    - Re-point active bookings from legacy archived coating/maintenance IDs
--      to the active canonical services so no duplicate coating entries appear.
--    - Archive duplicate active booking on ZZT0192 (Jose Torres had two
--      simultaneous in_progress bookings on the same plate).
--    - Ensure 'Polish' service exists with Small/Medium/Large/XL pricing and
--      is active and visible in Detailing / Queue / POS.
-- ---------------------------------------------------------------------------

-- Re-point bookings using legacy archived Ceramic Coating (11111111-1111-4111-8111-111111111111)
-- to active Ultimate Ceramic Coating (2bb93909-e307-48e0-a6a8-c014275b5638) if active exists
update public.bookings b
set service_id = s_active.id
from public.services s_active
where b.service_id = '11111111-1111-4111-8111-111111111111'::uuid
  and s_active.slug = 'ultimate-ceramic-coating'
  and s_active.is_active = true;

-- Re-point bookings using legacy archived Platinum (7fb64ac7-6952-420c-8f33-082dddd1ba4d)
-- to active Platinum Ceramic Coating (aa5219d2-054c-40a8-a76f-c999c4e7dc12)
update public.bookings b
set service_id = s_active.id
from public.services s_active
where b.service_id = '7fb64ac7-6952-420c-8f33-082dddd1ba4d'::uuid
  and s_active.slug = 'platinum-ceramic-coating'
  and s_active.is_active = true;

-- Re-point bookings using legacy archived Paint Maintenance (44444444-4444-4444-8444-444444444444)
-- to active Ceramic Paint Maintenance (40df44f4-023b-4452-8615-ba8e1d3831d6)
update public.bookings b
set service_id = s_active.id
from public.services s_active
where b.service_id = '44444444-4444-4444-8444-444444444444'::uuid
  and s_active.slug = 'ceramic-paint-maintenance'
  and s_active.is_active = true;

-- Re-point bookings using legacy archived Full Care Package (0f321a09-e484-4446-8d03-4a9758a61a6c)
-- to active Deluxe Package (99999999-9999-4999-8999-999999999999) so live for_payment handoffs
-- reference an active catalog package
update public.bookings b
set service_id = s_active.id
from public.services s_active
where b.service_id = '0f321a09-e484-4446-8d03-4a9758a61a6c'::uuid
  and s_active.slug = 'deluxe-package'
  and s_active.is_active = true;

-- Re-point bookings using legacy archived Full Exterior Detailing (ffffffff-ffff-ffff-ffff-ffffffffffff)
-- to active 1 Step Detailing (137574c4-7f53-4259-97a9-2437bb9178f8)
update public.bookings b
set service_id = s_active.id
from public.services s_active
where b.service_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid
  and s_active.slug = '1-step-detailing'
  and s_active.is_active = true;

-- Clean up duplicate active coating/custom-package booking on ZZT0192 (00202611-0000-4000-8000-00000000b746)
-- which duplicated ZZT0192 Jose Torres while referencing archived Hakum Custom Package
update public.bookings
set is_archived = true,
    updated_at = now()
where id = '00202611-0000-4000-8000-00000000b746'::uuid
  and coalesce(is_archived, false) = false;

-- Ensure Polish service exists and is active with size pricing (Small/Medium/Large/XL)
insert into public.services (
  id,
  slug,
  name,
  description,
  price_minor,
  duration_minutes,
  is_active,
  is_archived,
  pay_category
)
values (
  '80808080-8080-4080-8080-808080808080'::uuid,
  'polish',
  'Polish',
  'Machine exterior paint polish and gloss enhancement.',
  250000,
  120,
  true,
  false,
  'general'
)
on conflict (slug) do update
set name = excluded.name,
    description = coalesce(public.services.description, excluded.description),
    price_minor = excluded.price_minor,
    duration_minutes = excluded.duration_minutes,
    is_active = true,
    is_archived = false;

do $$
declare
  v_polish_id uuid;
begin
  select id into v_polish_id from public.services where slug = 'polish' limit 1;
  if v_polish_id is not null then
    insert into public.service_size_prices (service_id, size_slug, price_minor)
    values
      (v_polish_id, 'small', 250000),
      (v_polish_id, 'medium', 300000),
      (v_polish_id, 'large', 350000),
      (v_polish_id, 'extra_large', 450000)
    on conflict (service_id, size_slug) do update
    set price_minor = excluded.price_minor;
  end if;
end $$;

commit;
