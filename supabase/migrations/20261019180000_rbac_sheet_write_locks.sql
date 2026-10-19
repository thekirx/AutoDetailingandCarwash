-- 19 Oct sheet: Branch Admin and Customer Rep do not write queue or detailing.
-- Marketing does not write customers, vehicles, notes, or SMS campaigns.
-- Customer Rep can insert a customer row (create/modify). Team Lead still
-- provisions a walk-in from the queue; that path is unchanged.

drop policy if exists bookings_insert on public.bookings;
create policy bookings_insert on public.bookings
  for insert to authenticated
  with check (
    public.can_manage_branch(branch)
    and public.current_user_role() is distinct from 'admin'
  );

drop policy if exists bookings_update on public.bookings;
create policy bookings_update on public.bookings
  for update to authenticated
  using (
    (
      public.can_manage_branch(branch)
      and public.current_user_role() is distinct from 'admin'
    )
    or (
      public.current_user_role() = 'detailer'
      and public.user_has_branch_access(branch)
      and exists (
        select 1 from public.services s
        where s.id = bookings.service_id
          and coalesce(s.pay_category, '') = any (array['detailing', 'ppf'])
      )
    )
  )
  with check (
    (
      public.can_manage_branch(branch)
      and public.current_user_role() is distinct from 'admin'
    )
    or (
      public.current_user_role() = 'detailer'
      and public.user_has_branch_access(branch)
      and exists (
        select 1 from public.services s
        where s.id = bookings.service_id
          and coalesce(s.pay_category, '') = any (array['detailing', 'ppf'])
      )
    )
  );

alter policy "Managers can update queue assignments" on public.queue_assignments
  using (
    exists (
      select 1 from public.bookings b
      where b.id = queue_assignments.booking_id
        and public.can_manage_branch(b.branch)
        and public.current_user_role() is distinct from 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.bookings b
      where b.id = queue_assignments.booking_id
        and public.can_manage_branch(b.branch)
        and public.current_user_role() is distinct from 'admin'
    )
  );

alter policy "Queue managers can insert branch events" on public.queue_events
  with check (
    public.can_manage_branch(branch)
    and public.current_user_role() is distinct from 'admin'
    and (changed_by is null or changed_by = (select auth.uid()))
  );

alter policy customers_insert on public.customers
  with check (
    role = 'customer'::public.profile_role
    and (
      public.current_user_role() = any (array['admin', 'team_lead', 'BossMich', 'sales'])
      or public.asa_has_grant('crm')
      or public.asa_has_grant('queue_all')
    )
  );

alter policy customers_update on public.customers
  using (
    public.current_user_role() = any (array['admin', 'BossMich', 'sales'])
    or public.asa_has_grant('crm')
  )
  with check (
    role = 'customer'::public.profile_role
    and (
      public.current_user_role() = any (array['admin', 'BossMich', 'sales'])
      or public.asa_has_grant('crm')
    )
  );

alter policy customer_notes_insert on public.customer_notes
  with check (
    public.is_super_admin()
    or public.current_user_role() = any (array['admin', 'team_lead', 'sales', 'BossMich'])
    or public.asa_has_grant('crm')
    or public.asa_has_grant('queue_all')
  );

alter policy vehicles_insert on public.vehicles
  with check (
    public.is_super_admin()
    or public.asa_has_grant('crm')
    or public.asa_has_grant('queue_all')
    or public.current_user_role() = 'sales'
    or public.current_user_role() = 'operations_lead'
    or (
      public.current_user_role() = 'admin'
      and (last_branch is null or public.user_has_branch_access(last_branch))
    )
    or (
      public.current_user_role() = 'team_lead'
      and (last_branch is null or public.user_has_branch_access(last_branch))
    )
  );

alter policy vehicles_update on public.vehicles
  using (
    public.is_super_admin()
    or public.asa_has_grant('crm')
    or public.asa_has_grant('queue_all')
    or public.current_user_role() = 'sales'
    or public.current_user_role() = 'operations_lead'
    or (
      public.current_user_role() = 'admin'
      and (last_branch is null or public.user_has_branch_access(last_branch))
    )
    or (
      public.current_user_role() = 'team_lead'
      and (last_branch is null or public.user_has_branch_access(last_branch))
    )
  )
  with check (
    public.is_super_admin()
    or public.asa_has_grant('crm')
    or public.asa_has_grant('queue_all')
    or public.current_user_role() = 'sales'
    or public.current_user_role() = 'operations_lead'
    or (
      public.current_user_role() = 'admin'
      and (last_branch is null or public.user_has_branch_access(last_branch))
    )
    or (
      public.current_user_role() = 'team_lead'
      and (last_branch is null or public.user_has_branch_access(last_branch))
    )
  );

alter policy vehicles_delete on public.vehicles
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
      public.current_user_role() = 'team_lead'
      and (last_branch is null or public.user_has_branch_access(last_branch))
    )
  );

alter policy sms_events_insert on public.sms_events
  with check (
    public.current_user_role() = any (array['admin', 'BossMich', 'assistant_super_admin'])
  );

alter policy sms_events_update on public.sms_events
  using (
    public.current_user_role() = any (array['admin', 'BossMich', 'assistant_super_admin'])
  )
  with check (
    public.current_user_role() = any (array['admin', 'BossMich', 'assistant_super_admin'])
  );

alter policy sms_events_delete on public.sms_events
  using (
    public.current_user_role() = any (array['admin', 'BossMich', 'assistant_super_admin'])
  );
