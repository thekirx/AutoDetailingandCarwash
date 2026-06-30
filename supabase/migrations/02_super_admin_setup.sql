-- Hakum Auto Care super-admin setup.
-- Run in the Supabase SQL Editor or through the Supabase migration workflow.

-- The enum change must be committed before PostgreSQL can use the new value.
alter type public.profile_role add value if not exists 'admin';
commit;

begin;

update public.customers
set role = 'admin'::public.profile_role,
    updated_at = now()
where lower(email) = lower('admin@hakumautocare.com');

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customers
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "Admin has full access to customers" on public.customers;
create policy "Admin has full access to customers"
on public.customers
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admin has full access to bookings" on public.bookings;
create policy "Admin has full access to bookings"
on public.bookings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admin has full access to transactions" on public.transactions;
create policy "Admin has full access to transactions"
on public.transactions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admin has full access to services" on public.services;
create policy "Admin has full access to services"
on public.services
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Table privileges are necessary before RLS can evaluate the admin policies.
-- Non-admin authenticated users remain blocked from DELETE by RLS.
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.bookings to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.services to authenticated;

commit;
