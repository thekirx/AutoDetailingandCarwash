-- Void the two stranded 2026-09-29 POS hand-offs (BUG-061).
--
-- Owner decision, 2026-10-09: these were POS TESTING. Void and archive them.
-- NEVER ring them up.
--
-- Verified read-only against production immediately before writing this file:
--
--   hand-off  status    branch  amount     booking    plate      visit group
--   3dc882e1  pending   bacoor  PHP   297.50  fbecfcc7   ABC124    none
--   c8dfab00  pending   bacoor  PHP 5,100.00  b6e22863   ABC7643   bc2598c0...
--
--   transactions: 2, both status pending_payment (one per hand-off)
--   bookings to void: 3  -- the ABC7643 VISIT is TWO bookings at PHP 2,550
--                           each, which together make the PHP 5,100 hand-off.
--                           Only ONE of the pair carries a hand-off.
--   sales attached: 0  -- there is no money to unbook, and none is touched.
--
-- The visit-group expansion is the whole point. A per-hand-off cancellation
-- would leave booking 1c3c2528 sitting in `for_payment` forever, waiting for a
-- payment that is never coming, while its sibling was cancelled. This mirrors
-- what admin_override_queue_status already does, because that is the sanctioned
-- path and re-deriving it differently is how the two would drift apart.
--
-- Nothing here is executed automatically. Read it, then run it once.
-- Every guard below aborts rather than adapting to data it did not expect.

begin;

lock table public.pos_handoffs, public.transactions, public.bookings, public.queue_events
in share row exclusive mode;

do $void_pos_test$
declare
  target_handoff_ids uuid[] := '{}'::uuid[];
  group_ids uuid[] := '{}'::uuid[];
  release_time timestamptz := clock_timestamp();
begin
  -----------------------------------------------------------------------
  -- 1. Find the hand-offs by exact signature, never by "is it still pending".
  --    The window is written in UTC so it does not depend on the session's
  --    time zone: 2026-09-29 00:00 to 2026-09-30 00:00 in Asia/Manila is
  --    2026-09-28 16:00Z to 2026-09-29 16:00Z.
  -----------------------------------------------------------------------
  select coalesce(array_agg(h.id), '{}'::uuid[])
    into target_handoff_ids
  from public.pos_handoffs h
  join public.bookings b on b.id = h.booking_id
  where h.status = 'pending'
    and h.branch = 'bacoor'
    and h.created_at >= timestamptz '2026-09-28 16:00:00+00'
    and h.created_at <  timestamptz '2026-09-29 16:00:00+00'
    and b.vehicle_plate in ('ABC124', 'ABC7643');

  if (select count(*) from unnest(target_handoff_ids)) <> 2 then
    raise exception
      'ABORT: expected exactly 2 pending test hand-offs, found %',
      (select count(*) from unnest(target_handoff_ids));
  end if;

  -----------------------------------------------------------------------
  -- 2. Expand to the whole visit. admin_override_queue_status does this and
  --    the expansion is not optional: it is the difference between a clean
  --    void and one stranded ticket per visit.
  -----------------------------------------------------------------------
  select coalesce(array_agg(distinct b.id), '{}'::uuid[])
    into group_ids
  from public.bookings b
  where b.id in (select h.booking_id from public.pos_handoffs h where h.id = any(target_handoff_ids))
     or b.visit_group_id in (
          select b2.visit_group_id
          from public.pos_handoffs h2
          join public.bookings b2 on b2.id = h2.booking_id
          where h2.id = any(target_handoff_ids)
            and b2.visit_group_id is not null
        );

  if (select count(*) from unnest(group_ids)) <> 3 then
    raise exception
      'ABORT: expected exactly 3 bookings across the two test visits, found %',
      (select count(*) from unnest(group_ids));
  end if;

  -----------------------------------------------------------------------
  -- 3. Refuse to proceed if anything is not exactly as verified. A sale here
  --    would mean real money is attached and this migration is the wrong tool.
  -----------------------------------------------------------------------
  if (select count(*) from public.bookings b
        where b.id = any(group_ids)
          and (b.status::text <> 'for_payment' or coalesce(b.is_archived, false))) <> 0 then
    raise exception
      'ABORT: one of the target bookings is no longer an open for_payment ticket';
  end if;

  if (select count(*) from public.sales s where s.booking_id = any(group_ids)) <> 0 then
    raise exception
      'ABORT: a sale is attached to these bookings — this is no longer a test void';
  end if;

  if (select count(*) from public.transactions t
        where t.pos_handoff_id = any(target_handoff_ids)
          and t.status = 'pending_payment') <> 2 then
    raise exception
      'ABORT: expected exactly 2 pending_payment transactions to cancel, found %',
      (select count(*) from public.transactions t
        where t.pos_handoff_id = any(target_handoff_ids)
          and t.status = 'pending_payment');
  end if;

  -----------------------------------------------------------------------
  -- 4. Void. Same four writes as admin_override_queue_status, in the same
  --    order: hand-off, transaction, booking, audit row.
  -----------------------------------------------------------------------
  update public.pos_handoffs ph
     set status = 'cancelled',
         updated_at = release_time
   where ph.id = any(target_handoff_ids)
     and ph.status = 'pending';

  update public.transactions t
     set status = 'cancelled',
         updated_at = release_time
   where t.pos_handoff_id = any(target_handoff_ids)
     and t.status = 'pending_payment';

  update public.bookings b
     set status = 'cancelled'::public.booking_status,
         is_archived = true,
         updated_at = release_time
   where b.id = any(group_ids);

  -- The audit row is what makes this explainable in six months. It says the
  -- ticket was voided, not that it was completed, and it records the reason.
  insert into public.queue_events (booking_id, branch, old_status, new_status, notes)
  select b.id,
         b.branch,
         'for_payment',
         'cancelled',
         'Voided 2026-10-09: 2026-09-29 POS test hand-off, never rung up'
    from public.bookings b
   where b.id = any(group_ids);
end;
$void_pos_test$;

commit;