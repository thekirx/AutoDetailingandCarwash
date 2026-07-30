-- Marketing CRM: scoped bookings/sales/sms; customer role lock; vehicles branch-aware
begin;

-- MKT-C3: Marketing may read bookings at assigned branch(es)
drop policy if exists "Marketing can read branch bookings" on public.bookings;
create policy "Marketing can read branch bookings"
on public.bookings
for select
to authenticated
using (
  public.current_user_role() = 'marketing'
  and public.user_has_branch_access(branch)
);

-- MKT-H3: Marketing may read sales at assigned branch
drop policy if exists "Staff read sales" on public.sales;
create policy "Staff read sales"
on public.sales
for select
to authenticated
using (
  public.is_super_admin()
  or public.is_assistant_super_admin()
  or (
    public.current_user_role() = 'admin'
    and public.user_has_branch_access(branch)
  )
  or (
    public.current_user_role() = 'team_lead'
    and branch = public.current_user_branch()
  )
  or (
    public.current_user_role() = 'marketing'
    and public.user_has_branch_access(branch)
  )
  or public.current_user_role() in ('sales', 'cashier')
);

-- MKT-H2: Marketing SMS event log
drop policy if exists "Allow operations manage sms events" on public.sms_events;
drop policy if exists "Allow operations read sms events" on public.sms_events;

create policy "Allow operations read sms events"
on public.sms_events
for select
to authenticated
using (
  public.current_user_role() = any (array['admin'::text, 'BossMich'::text, 'assistant_super_admin'::text, 'team_lead'::text, 'marketing'::text])
);

create policy "Allow operations manage sms events"
on public.sms_events
for all
to authenticated
using (
  public.current_user_role() = any (array['admin'::text, 'BossMich'::text, 'assistant_super_admin'::text, 'team_lead'::text, 'marketing'::text])
)
with check (
  public.current_user_role() = any (array['admin'::text, 'BossMich'::text, 'assistant_super_admin'::text, 'team_lead'::text, 'marketing'::text])
);

-- MKT-H9: customer UPDATE must keep role = customer
drop policy if exists "CRM and queue can update customers" on public.customers;
create policy "CRM and queue can update customers"
on public.customers
for update
to authenticated
using (
  public.current_user_role() = any (array['admin'::text, 'BossMich'::text, 'marketing'::text, 'sales'::text, 'assistant_super_admin'::text])
)
with check (
  public.current_user_role() = any (array['admin'::text, 'BossMich'::text, 'marketing'::text, 'sales'::text, 'assistant_super_admin'::text])
  and role = 'customer'
);

-- MKT-H5: CRM vehicles — Marketing/TL only own-branch (or new null last_branch)
drop policy if exists "CRM can manage vehicles" on public.vehicles;
create policy "CRM can manage vehicles"
on public.vehicles
for all
to authenticated
using (
  public.current_user_role() = any (array['admin'::text, 'BossMich'::text, 'sales'::text])
  or (
    public.current_user_role() = any (array['marketing'::text, 'team_lead'::text])
    and (last_branch is null or public.user_has_branch_access(last_branch))
  )
)
with check (
  public.current_user_role() = any (array['admin'::text, 'BossMich'::text, 'sales'::text])
  or (
    public.current_user_role() = any (array['marketing'::text, 'team_lead'::text])
    and (last_branch is null or public.user_has_branch_access(last_branch))
  )
);

commit;
