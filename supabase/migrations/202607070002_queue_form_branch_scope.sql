-- Queue form branch scoping and walk-in customer support.

begin;

alter table public.customers
alter column id set default gen_random_uuid();

alter table public.customers
drop constraint if exists profiles_id_fkey;

alter table public.bookings
add column if not exists created_by uuid references auth.users(id);

drop policy if exists "Queue managers can select customers" on public.customers;
drop policy if exists "Queue managers can insert customers" on public.customers;
drop policy if exists "Queue managers can update customers" on public.customers;

create policy "Queue managers can select customers"
on public.customers for select to authenticated
using (public.current_user_role() in ('admin', 'team_lead'));

create policy "Queue managers can insert customers"
on public.customers for insert to authenticated
with check (
  public.current_user_role() in ('admin', 'team_lead')
  and role = 'customer'
);

create policy "Queue managers can update customers"
on public.customers for update to authenticated
using (public.current_user_role() in ('admin', 'team_lead'))
with check (public.current_user_role() in ('admin', 'team_lead'));

commit;
