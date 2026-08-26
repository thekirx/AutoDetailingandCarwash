-- Slice U: OPT-09 finance/loyalty/ops/catalog + B-37..B-40.
-- B-37: sales SELECT no longer bare is_assistant_super_admin (needs finance_view).
-- B-38: loyalty/memberships write via memberships grant (not is_admin).
-- B-39: services/products/sizes write via services_merch|pos (not is_admin / not BA).
-- B-40: customer_memberships write SA/ASA+memberships only; BA keeps read for POS.

-- ── expenses / sales SELECT merge ───────────────────────────────────────
drop policy if exists "Investors can read expenses" on public.expenses;
drop policy if exists expenses_select on public.expenses;

create policy expenses_select
  on public.expenses
  for select
  to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('finance_view')
    or (public.current_user_role() = 'admin' and public.user_has_branch_access(branch))
    or (public.current_user_role() = 'investor' and public.user_has_branch_access(branch))
  );

drop policy if exists "Investors can read sales" on public.sales;
drop policy if exists "Staff read sales" on public.sales;

create policy sales_select
  on public.sales
  for select
  to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('finance_view')
    or (public.current_user_role() = 'admin' and public.user_has_branch_access(branch))
    or (public.current_user_role() = 'team_lead' and branch = public.current_user_branch())
    or (public.current_user_role() = 'marketing' and public.user_has_branch_access(branch))
    or public.current_user_role() = any (array['sales'::text, 'cashier'::text])
    or (public.current_user_role() = 'investor' and public.user_has_branch_access(branch))
  );

-- ── expense_categories / compensation_settings (split FOR ALL) ──────────
drop policy if exists expense_categories_write on public.expense_categories;
create policy expense_categories_insert
  on public.expense_categories for insert to authenticated
  with check (
    public.is_super_admin()
    or public.asa_has_grant('finance_write')
    or public.current_user_role() = 'admin'
  );
create policy expense_categories_update
  on public.expense_categories for update to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('finance_write')
    or public.current_user_role() = 'admin'
  )
  with check (
    public.is_super_admin()
    or public.asa_has_grant('finance_write')
    or public.current_user_role() = 'admin'
  );
create policy expense_categories_delete
  on public.expense_categories for delete to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('finance_write')
    or public.current_user_role() = 'admin'
  );

drop policy if exists compensation_settings_write_sa on public.compensation_settings;
create policy compensation_settings_insert
  on public.compensation_settings for insert to authenticated
  with check (public.is_super_admin() or public.asa_has_grant('finance_write'));
create policy compensation_settings_update
  on public.compensation_settings for update to authenticated
  using (public.is_super_admin() or public.asa_has_grant('finance_write'))
  with check (public.is_super_admin() or public.asa_has_grant('finance_write'));
create policy compensation_settings_delete
  on public.compensation_settings for delete to authenticated
  using (public.is_super_admin() or public.asa_has_grant('finance_write'));

-- ── loyalty / memberships ───────────────────────────────────────────────
drop policy if exists "Admins manage loyalty settings" on public.loyalty_program_settings;
create policy loyalty_program_settings_insert
  on public.loyalty_program_settings for insert to authenticated
  with check (public.is_super_admin() or public.asa_has_grant('memberships'));
create policy loyalty_program_settings_update
  on public.loyalty_program_settings for update to authenticated
  using (public.is_super_admin() or public.asa_has_grant('memberships'))
  with check (public.is_super_admin() or public.asa_has_grant('memberships'));
create policy loyalty_program_settings_delete
  on public.loyalty_program_settings for delete to authenticated
  using (public.is_super_admin() or public.asa_has_grant('memberships'));

drop policy if exists "Admins manage milestones" on public.loyalty_milestones;
drop policy if exists "Admins read all milestones" on public.loyalty_milestones;
drop policy if exists "Public read active milestones" on public.loyalty_milestones;

create policy loyalty_milestones_select
  on public.loyalty_milestones
  for select
  to anon, authenticated
  using (
    is_active = true
    or public.is_super_admin()
    or public.asa_has_grant('memberships')
  );

create policy loyalty_milestones_insert
  on public.loyalty_milestones for insert to authenticated
  with check (public.is_super_admin() or public.asa_has_grant('memberships'));
create policy loyalty_milestones_update
  on public.loyalty_milestones for update to authenticated
  using (public.is_super_admin() or public.asa_has_grant('memberships'))
  with check (public.is_super_admin() or public.asa_has_grant('memberships'));
create policy loyalty_milestones_delete
  on public.loyalty_milestones for delete to authenticated
  using (public.is_super_admin() or public.asa_has_grant('memberships'));

drop policy if exists "Admins manage tiers" on public.membership_tiers;
drop policy if exists "Public read tiers" on public.membership_tiers;

create policy membership_tiers_select
  on public.membership_tiers
  for select
  to anon, authenticated
  using (
    is_active = true
    or public.is_super_admin()
    or public.asa_has_grant('memberships')
  );

create policy membership_tiers_insert
  on public.membership_tiers for insert to authenticated
  with check (public.is_super_admin() or public.asa_has_grant('memberships'));
create policy membership_tiers_update
  on public.membership_tiers for update to authenticated
  using (public.is_super_admin() or public.asa_has_grant('memberships'))
  with check (public.is_super_admin() or public.asa_has_grant('memberships'));
create policy membership_tiers_delete
  on public.membership_tiers for delete to authenticated
  using (public.is_super_admin() or public.asa_has_grant('memberships'));

drop policy if exists "Admins manage customer memberships" on public.customer_memberships;
drop policy if exists "CRM read memberships" on public.customer_memberships;

create policy customer_memberships_select
  on public.customer_memberships
  for select
  to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('memberships')
    or public.current_user_role() = any (array['admin'::text, 'marketing'::text, 'sales'::text])
  );

create policy customer_memberships_insert
  on public.customer_memberships for insert to authenticated
  with check (public.is_super_admin() or public.asa_has_grant('memberships'));
create policy customer_memberships_update
  on public.customer_memberships for update to authenticated
  using (public.is_super_admin() or public.asa_has_grant('memberships'))
  with check (public.is_super_admin() or public.asa_has_grant('memberships'));
create policy customer_memberships_delete
  on public.customer_memberships for delete to authenticated
  using (public.is_super_admin() or public.asa_has_grant('memberships'));

-- ── catalog: services / products / sizes / prices ───────────────────────
drop policy if exists "Admin has full access to services" on public.services;
drop policy if exists "Public can view active services" on public.services;
drop policy if exists "Staff can select services" on public.services;

create policy services_select
  on public.services
  for select
  to anon, authenticated
  using (
    (is_active = true and is_archived = false)
    or public.is_staff()
    or public.is_super_admin()
    or public.asa_has_grant('services_merch')
    or public.asa_has_grant('pos')
  );

create policy services_insert
  on public.services for insert to authenticated
  with check (
    public.is_super_admin()
    or public.asa_has_grant('services_merch')
    or public.asa_has_grant('pos')
  );
create policy services_update
  on public.services for update to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('services_merch')
    or public.asa_has_grant('pos')
  )
  with check (
    public.is_super_admin()
    or public.asa_has_grant('services_merch')
    or public.asa_has_grant('pos')
  );
create policy services_delete
  on public.services for delete to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('services_merch')
    or public.asa_has_grant('pos')
  );

drop policy if exists "Admins write products" on public.products;
create policy products_insert
  on public.products for insert to authenticated
  with check (
    public.is_super_admin()
    or public.asa_has_grant('services_merch')
    or public.asa_has_grant('pos')
  );
create policy products_update
  on public.products for update to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('services_merch')
    or public.asa_has_grant('pos')
  )
  with check (
    public.is_super_admin()
    or public.asa_has_grant('services_merch')
    or public.asa_has_grant('pos')
  );
create policy products_delete
  on public.products for delete to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('services_merch')
    or public.asa_has_grant('pos')
  );

drop policy if exists service_size_prices_write on public.service_size_prices;
create policy service_size_prices_insert
  on public.service_size_prices for insert to authenticated
  with check (
    public.is_super_admin()
    or public.asa_has_grant('services_merch')
    or public.asa_has_grant('pos')
  );
create policy service_size_prices_update
  on public.service_size_prices for update to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('services_merch')
    or public.asa_has_grant('pos')
  )
  with check (
    public.is_super_admin()
    or public.asa_has_grant('services_merch')
    or public.asa_has_grant('pos')
  );
create policy service_size_prices_delete
  on public.service_size_prices for delete to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('services_merch')
    or public.asa_has_grant('pos')
  );

drop policy if exists vehicle_sizes_write on public.vehicle_sizes;
create policy vehicle_sizes_insert
  on public.vehicle_sizes for insert to authenticated
  with check (
    public.is_super_admin()
    or public.asa_has_grant('services_merch')
    or public.asa_has_grant('pos')
  );
create policy vehicle_sizes_update
  on public.vehicle_sizes for update to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('services_merch')
    or public.asa_has_grant('pos')
  )
  with check (
    public.is_super_admin()
    or public.asa_has_grant('services_merch')
    or public.asa_has_grant('pos')
  );
create policy vehicle_sizes_delete
  on public.vehicle_sizes for delete to authenticated
  using (
    public.is_super_admin()
    or public.asa_has_grant('services_merch')
    or public.asa_has_grant('pos')
  );

drop policy if exists vehicle_catalog_write on public.vehicle_catalog;
drop policy if exists vehicle_catalog_select on public.vehicle_catalog;
drop policy if exists vehicle_catalog_select_anon on public.vehicle_catalog;

create policy vehicle_catalog_select
  on public.vehicle_catalog
  for select
  to anon, authenticated
  using (
    is_active = true
    or (select auth.uid()) is not null
  );

create policy vehicle_catalog_insert
  on public.vehicle_catalog for insert to authenticated
  with check (public.is_super_admin());
create policy vehicle_catalog_update
  on public.vehicle_catalog for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy vehicle_catalog_delete
  on public.vehicle_catalog for delete to authenticated
  using (public.is_super_admin());

-- ── ops forms (planner pattern) ─────────────────────────────────────────
drop policy if exists ops_forms_write on public.ops_forms;
drop policy if exists ops_forms_select on public.ops_forms;

create policy ops_forms_select
  on public.ops_forms for select to authenticated
  using (public.can_edit_planning() or public.is_admin());
create policy ops_forms_insert
  on public.ops_forms for insert to authenticated
  with check (public.can_edit_planning());
create policy ops_forms_update
  on public.ops_forms for update to authenticated
  using (public.can_edit_planning()) with check (public.can_edit_planning());
create policy ops_forms_delete
  on public.ops_forms for delete to authenticated
  using (public.can_edit_planning());

drop policy if exists ops_form_submissions_write on public.ops_form_submissions;
drop policy if exists ops_form_submissions_select on public.ops_form_submissions;

create policy ops_form_submissions_select
  on public.ops_form_submissions for select to authenticated
  using (public.can_edit_planning() or public.is_admin());
create policy ops_form_submissions_insert
  on public.ops_form_submissions for insert to authenticated
  with check (public.can_edit_planning());
create policy ops_form_submissions_update
  on public.ops_form_submissions for update to authenticated
  using (public.can_edit_planning()) with check (public.can_edit_planning());
create policy ops_form_submissions_delete
  on public.ops_form_submissions for delete to authenticated
  using (public.can_edit_planning());

-- ── sms / maint / birthday / notifications ──────────────────────────────
drop policy if exists "Allow operations manage sms events" on public.sms_events;
drop policy if exists "Allow operations read sms events" on public.sms_events;

create policy sms_events_select
  on public.sms_events for select to authenticated
  using (
    public.current_user_role() = any (array[
      'admin'::text, 'BossMich'::text, 'assistant_super_admin'::text, 'team_lead'::text, 'marketing'::text
    ])
  );
create policy sms_events_insert
  on public.sms_events for insert to authenticated
  with check (
    public.current_user_role() = any (array[
      'admin'::text, 'BossMich'::text, 'assistant_super_admin'::text, 'team_lead'::text, 'marketing'::text
    ])
  );
create policy sms_events_update
  on public.sms_events for update to authenticated
  using (
    public.current_user_role() = any (array[
      'admin'::text, 'BossMich'::text, 'assistant_super_admin'::text, 'team_lead'::text, 'marketing'::text
    ])
  )
  with check (
    public.current_user_role() = any (array[
      'admin'::text, 'BossMich'::text, 'assistant_super_admin'::text, 'team_lead'::text, 'marketing'::text
    ])
  );
create policy sms_events_delete
  on public.sms_events for delete to authenticated
  using (
    public.current_user_role() = any (array[
      'admin'::text, 'BossMich'::text, 'assistant_super_admin'::text, 'team_lead'::text, 'marketing'::text
    ])
  );

drop policy if exists vehicle_maint_write on public.vehicle_maintenance_schedules;
drop policy if exists vehicle_maint_select on public.vehicle_maintenance_schedules;

create policy vehicle_maint_select
  on public.vehicle_maintenance_schedules for select to authenticated
  using (
    public.current_user_role() = any (array[
      'BossMich'::text, 'assistant_super_admin'::text, 'admin'::text, 'team_lead'::text, 'sales'::text, 'marketing'::text
    ])
  );
create policy vehicle_maint_insert
  on public.vehicle_maintenance_schedules for insert to authenticated
  with check (
    public.current_user_role() = any (array[
      'BossMich'::text, 'assistant_super_admin'::text, 'admin'::text, 'sales'::text
    ])
  );
create policy vehicle_maint_update
  on public.vehicle_maintenance_schedules for update to authenticated
  using (
    public.current_user_role() = any (array[
      'BossMich'::text, 'assistant_super_admin'::text, 'admin'::text, 'sales'::text
    ])
  )
  with check (
    public.current_user_role() = any (array[
      'BossMich'::text, 'assistant_super_admin'::text, 'admin'::text, 'sales'::text
    ])
  );
create policy vehicle_maint_delete
  on public.vehicle_maintenance_schedules for delete to authenticated
  using (
    public.current_user_role() = any (array[
      'BossMich'::text, 'assistant_super_admin'::text, 'admin'::text, 'sales'::text
    ])
  );

drop policy if exists customer_birthday_perks_own_read on public.customer_birthday_perks;
drop policy if exists customer_birthday_perks_staff_read on public.customer_birthday_perks;

create policy customer_birthday_perks_select
  on public.customer_birthday_perks
  for select
  to authenticated
  using (
    customer_id = (select auth.uid())
    or exists (
      select 1
      from public.staff_profiles sp
      where sp.id = (select auth.uid())
        and sp.is_active = true
    )
  );

drop policy if exists "Admins read all notifications" on public.user_notifications;
drop policy if exists "Users read own notifications" on public.user_notifications;

create policy user_notifications_select
  on public.user_notifications
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin()
  );
