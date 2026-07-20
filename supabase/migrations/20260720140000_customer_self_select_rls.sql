-- Customers may read their own portal profile (auth.uid() = customers.id).
-- security-rls: least privilege — select own row only; staff policies unchanged.

drop policy if exists "Customers can select own profile" on public.customers;
create policy "Customers can select own profile"
on public.customers for select to authenticated
using (id = (select auth.uid()));
