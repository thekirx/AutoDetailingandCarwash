-- Completed visits may be archived by ops; customers must still rate them.
drop policy if exists service_reviews_insert_own on public.service_reviews;

create policy service_reviews_insert_own on public.service_reviews
  for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    and exists (
      select 1
      from public.bookings b
      where b.id = booking_id
        and b.customer_id = (select auth.uid())
        and b.status = 'completed'
    )
  );
