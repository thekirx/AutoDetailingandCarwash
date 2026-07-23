-- CRM roles (marketing/sales) need customer + vehicle access for /operations/crm.
-- Admin/BossMich already covered by is_admin() ALL policies.
-- Team lead already had queue-manager select/update; keep that and add marketing/sales.

begin;

drop policy if exists "Queue managers can select customers" on public.customers;
create policy "CRM and queue can select customers"
on public.customers
for select
to authenticated
using (
  public.current_user_role() = any (
    array['admin'::text, 'team_lead'::text, 'BossMich'::text, 'marketing'::text, 'sales'::text]
  )
);

drop policy if exists "Queue managers can update customers" on public.customers;
create policy "CRM and queue can update customers"
on public.customers
for update
to authenticated
using (
  public.current_user_role() = any (
    array['admin'::text, 'team_lead'::text, 'BossMich'::text, 'marketing'::text, 'sales'::text]
  )
)
with check (
  public.current_user_role() = any (
    array['admin'::text, 'team_lead'::text, 'BossMich'::text, 'marketing'::text, 'sales'::text]
  )
  and role = 'customer'::public.profile_role
);

-- Vehicles: ensure CRM roles can manage (policy may already exist as broad ops ALL)
drop policy if exists "CRM can manage vehicles" on public.vehicles;
create policy "CRM can manage vehicles"
on public.vehicles
for all
to authenticated
using (
  public.current_user_role() = any (
    array['admin'::text, 'team_lead'::text, 'BossMich'::text, 'marketing'::text, 'sales'::text]
  )
)
with check (
  public.current_user_role() = any (
    array['admin'::text, 'team_lead'::text, 'BossMich'::text, 'marketing'::text, 'sales'::text]
  )
);

grant insert (vehicle_plate) on table public.bookings to anon;

commit;
