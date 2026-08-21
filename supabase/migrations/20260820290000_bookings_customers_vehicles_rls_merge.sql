-- Slice S: OPT-09 merges for bookings/customers/vehicles + B-33/B-34 RLS tighten.
-- - bookings: one policy per action; queue read uses can_manage_branch (not bare is_admin)
-- - customers: drop Admin FOR ALL; ASA needs crm|queue_all|pos to read, crm to write
-- - vehicles: one SELECT + I/U/D; ASA write needs crm|queue_all

-- ═══════════════════════════════════════════════════════════════════════
-- bookings
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists "Customers can select own bookings" on public.bookings;
drop policy if exists "Detailers can read branch bookings" on public.bookings;
drop policy if exists "Marketing can read branch bookings" on public.bookings;
drop policy if exists "Queue managers can read authorized bookings" on public.bookings;
drop policy if exists "Sales can read all bookings" on public.bookings;
drop policy if exists "Sales can read branch bookings" on public.bookings;
drop policy if exists "Staff can read assigned bookings" on public.bookings;

drop policy if exists "Queue managers can insert authorized bookings" on public.bookings;
drop policy if exists "Sales can insert bookings for any branch" on public.bookings;
drop policy if exists "Sales can insert form bookings" on public.bookings;

drop policy if exists "Detailers can update detailing bookings" on public.bookings;
drop policy if exists "Queue managers can update authorized bookings" on public.bookings;
drop policy if exists "Sales can update bookings across branches" on public.bookings;
drop policy if exists "Sales can update form bookings" on public.bookings;

create policy bookings_select
  on public.bookings
  for select
  to authenticated
  using (
    customer_id = (select auth.uid())
    or public.staff_is_assigned_to_booking(id)
    or public.current_user_role() = 'sales'
    or (
      public.current_user_role() = 'detailer'
      and public.user_has_branch_access(branch)
    )
    or (
      public.current_user_role() = 'marketing'
      and public.user_has_branch_access(branch)
    )
    or public.can_manage_branch(branch)
  );

create policy bookings_insert
  on public.bookings
  for insert
  to authenticated
  with check (
    public.can_manage_branch(branch)
    or (
      public.current_user_role() = 'sales'
      and (status)::text = any (array['pending'::text, 'confirmed'::text])
    )
  );

create policy bookings_update
  on public.bookings
  for update
  to authenticated
  using (
    public.can_manage_branch(branch)
    or (
      public.current_user_role() = 'sales'
      and (status)::text = any (array[
        'pending'::text, 'confirmed'::text, 'waiting'::text, 'in_progress'::text,
        'final_checking'::text, 'for_releasing'::text, 'for_payment'::text,
        'completed'::text, 'cancelled'::text
      ])
    )
    or (
      public.current_user_role() = 'detailer'
      and public.user_has_branch_access(branch)
      and exists (
        select 1
        from public.services s
        where s.id = bookings.service_id
          and coalesce(s.pay_category, '') = any (array['detailing'::text, 'ppf'::text])
      )
    )
  )
  with check (
    public.can_manage_branch(branch)
    or (
      public.current_user_role() = 'sales'
      and (status)::text = any (array[
        'pending'::text, 'confirmed'::text, 'waiting'::text, 'in_progress'::text,
        'final_checking'::text, 'for_releasing'::text, 'for_payment'::text,
        'completed'::text, 'cancelled'::text
      ])
    )
    or (
      public.current_user_role() = 'detailer'
      and public.user_has_branch_access(branch)
      and exists (
        select 1
        from public.services s
        where s.id = bookings.service_id
          and coalesce(s.pay_category, '') = any (array['detailing'::text, 'ppf'::text])
      )
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- customers
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists "Admin has full access to customers" on public.customers;
drop policy if exists "Queue managers can insert customers" on public.customers;
drop policy if exists "CRM and queue can select customers" on public.customers;
drop policy if exists "Customers can select own profile" on public.customers;
drop policy if exists "CRM and queue can update customers" on public.customers;

create policy customers_select
  on public.customers
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or public.current_user_role() = any (array[
      'admin'::text, 'team_lead'::text, 'BossMich'::text, 'marketing'::text, 'sales'::text
    ])
    or public.asa_has_grant('crm')
    or public.asa_has_grant('queue_all')
    or public.asa_has_grant('pos')
  );

create policy customers_insert
  on public.customers
  for insert
  to authenticated
  with check (
    role = 'customer'::profile_role
    and (
      public.current_user_role() = any (array['admin'::text, 'team_lead'::text, 'BossMich'::text])
      or public.asa_has_grant('crm')
      or public.asa_has_grant('queue_all')
    )
  );

create policy customers_update
  on public.customers
  for update
  to authenticated
  using (
    public.current_user_role() = any (array[
      'admin'::text, 'BossMich'::text, 'marketing'::text, 'sales'::text
    ])
    or public.asa_has_grant('crm')
  )
  with check (
    role = 'customer'::profile_role
    and (
      public.current_user_role() = any (array[
        'admin'::text, 'BossMich'::text, 'marketing'::text, 'sales'::text
      ])
      or public.asa_has_grant('crm')
    )
  );

create policy customers_delete
  on public.customers
  for delete
  to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('crm')
    or public.current_user_role() = 'admin'
  );

-- ═══════════════════════════════════════════════════════════════════════
-- vehicles
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists "Allow operations manage vehicles" on public.vehicles;
drop policy if exists "CRM can manage vehicles" on public.vehicles;
drop policy if exists "Allow operations read vehicles" on public.vehicles;

create policy vehicles_select
  on public.vehicles
  for select
  to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('crm')
    or public.asa_has_grant('queue_all')
    or public.asa_has_grant('pos')
    or public.current_user_role() = any (array[
      'admin'::text, 'team_lead'::text, 'cashier'::text, 'sales'::text
    ])
    or (
      public.current_user_role() = 'marketing'
      and (last_branch is null or public.user_has_branch_access(last_branch))
    )
    or (
      public.current_user_role() = 'staff'
      and public.staff_is_assigned_to_booking_vehicle(id)
    )
  );

create policy vehicles_insert
  on public.vehicles
  for insert
  to authenticated
  with check (
    public.is_super_admin()
    or public.asa_has_grant('crm')
    or public.asa_has_grant('queue_all')
    or public.current_user_role() = 'sales'
    or (
      public.current_user_role() = 'admin'
      and (last_branch is null or public.user_has_branch_access(last_branch))
    )
    or (
      public.current_user_role() = any (array['marketing'::text, 'team_lead'::text])
      and (last_branch is null or public.user_has_branch_access(last_branch))
    )
  );

create policy vehicles_update
  on public.vehicles
  for update
  to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('crm')
    or public.asa_has_grant('queue_all')
    or public.current_user_role() = 'sales'
    or (
      public.current_user_role() = 'admin'
      and (last_branch is null or public.user_has_branch_access(last_branch))
    )
    or (
      public.current_user_role() = any (array['marketing'::text, 'team_lead'::text])
      and (last_branch is null or public.user_has_branch_access(last_branch))
    )
  )
  with check (
    public.is_super_admin()
    or public.asa_has_grant('crm')
    or public.asa_has_grant('queue_all')
    or public.current_user_role() = 'sales'
    or (
      public.current_user_role() = 'admin'
      and (last_branch is null or public.user_has_branch_access(last_branch))
    )
    or (
      public.current_user_role() = any (array['marketing'::text, 'team_lead'::text])
      and (last_branch is null or public.user_has_branch_access(last_branch))
    )
  );

create policy vehicles_delete
  on public.vehicles
  for delete
  to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('crm')
    or public.asa_has_grant('queue_all')
    or public.current_user_role() = 'sales'
    or (
      public.current_user_role() = 'admin'
      and (last_branch is null or public.user_has_branch_access(last_branch))
    )
    or (
      public.current_user_role() = any (array['marketing'::text, 'team_lead'::text])
      and (last_branch is null or public.user_has_branch_access(last_branch))
    )
  );
