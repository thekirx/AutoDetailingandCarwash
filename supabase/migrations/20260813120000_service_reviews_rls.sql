-- P1-1: service_reviews is not world-readable/writable for every authenticated session.
-- Insert: owning customer of a completed booking only.
-- Select: SA / ASA / Branch Admin, or the customer who wrote the row.

drop policy if exists service_reviews_select_ops on public.service_reviews;
drop policy if exists service_reviews_insert_authenticated on public.service_reviews;
drop policy if exists service_reviews_insert_own on public.service_reviews;

create policy service_reviews_select_ops on public.service_reviews
  for select to authenticated
  using (
    public.current_user_role() in ('BossMich', 'assistant_super_admin', 'admin')
    or customer_id = (select auth.uid())
  );

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
        and coalesce(b.is_archived, false) = false
    )
  );

create unique index if not exists service_reviews_booking_unique
  on public.service_reviews (booking_id)
  where booking_id is not null;
