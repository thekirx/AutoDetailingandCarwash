-- Customer portal: own bookings + public branch list + self profile.
-- security-rls: customers read only their bookings; branches readable by authenticated.

drop policy if exists "Customers can select own profile" on public.customers;
create policy "Customers can select own profile"
on public.customers for select to authenticated
using (id = (select auth.uid()));

drop policy if exists "Customers can select own bookings" on public.bookings;
create policy "Customers can select own bookings"
on public.bookings for select to authenticated
using (customer_id = (select auth.uid()));

-- Branch directory for portal nearest-branch picker
drop policy if exists "Authenticated can read active branches" on public.branches;
create policy "Authenticated can read active branches"
on public.branches for select to authenticated
using (is_active = true and is_archived = false);

drop policy if exists "Anon can read active branches" on public.branches;
create policy "Anon can read active branches"
on public.branches for select to anon
using (is_active = true and is_archived = false);
