-- Staff My Tasks: read booking rows for tickets they're assigned to.
-- security-rls: narrow select — assigned staff only, not whole branch queue.

drop policy if exists "Staff can read assigned bookings" on public.bookings;
create policy "Staff can read assigned bookings"
  on public.bookings for select to authenticated
  using (
    exists (
      select 1
      from public.queue_assignments qa
      where qa.booking_id = bookings.id
        and qa.staff_id = (select auth.uid())
    )
  );

create index if not exists idx_queue_assignments_staff_booking
  on public.queue_assignments (staff_id, booking_id);
