-- Make the Queue work for every role that has it in the app
-- (Super Admin, Assistant Super Admin, Team Lead, Operations Lead).
-- Found by running create → crew → start → add service → final check →
-- payment / override → cancel as each role against the live schema.
--
-- 1. bookings.team_lead_id referenced customers(id). The app stamps the
--    creating staff member there, so any staff account without a leftover
--    customers row (Super Admin, ASA, Operations Lead, the Batangas TL) could
--    not create a ticket. It now references staff_profiles(id); all existing
--    values are staff ids.
-- 2. vehicles RLS had no Operations Lead clause, so the booking masterlist
--    trigger (and plate lookups) failed for them. Operations Lead is
--    network-wide, like Super Admin.
-- 3. sync_queue_assignments (assign crew) and admin_override_queue_status left
--    out Operations Lead, and both required user_has_branch_access, which a
--    branchless Operations Lead never passes.

begin;

-- 1 ---------------------------------------------------------------------------
alter table public.bookings drop constraint if exists bookings_team_lead_id_fkey;
alter table public.bookings
  add constraint bookings_team_lead_id_fkey
  foreign key (team_lead_id) references public.staff_profiles(id) on delete restrict;

-- 2 ---------------------------------------------------------------------------
alter policy vehicles_select on public.vehicles using (
  is_super_admin() or asa_has_grant('crm'::text) or asa_has_grant('queue_all'::text) or asa_has_grant('pos'::text)
  or (current_user_role() = any (array['admin'::text, 'team_lead'::text, 'cashier'::text, 'sales'::text]))
  or ((current_user_role() = 'marketing'::text) and ((last_branch is null) or user_has_branch_access(last_branch)))
  or ((current_user_role() = 'staff'::text) and staff_is_assigned_to_booking_vehicle(id))
  or (current_user_role() = 'operations_lead'::text)
);

alter policy vehicles_insert on public.vehicles with check (
  is_super_admin() or asa_has_grant('crm'::text) or asa_has_grant('queue_all'::text)
  or (current_user_role() = 'sales'::text)
  or ((current_user_role() = 'admin'::text) and ((last_branch is null) or user_has_branch_access(last_branch)))
  or ((current_user_role() = any (array['marketing'::text, 'team_lead'::text])) and ((last_branch is null) or user_has_branch_access(last_branch)))
  or (current_user_role() = 'operations_lead'::text)
);

alter policy vehicles_update on public.vehicles
  using (
    is_super_admin() or asa_has_grant('crm'::text) or asa_has_grant('queue_all'::text)
    or (current_user_role() = 'sales'::text)
    or ((current_user_role() = 'admin'::text) and ((last_branch is null) or user_has_branch_access(last_branch)))
    or ((current_user_role() = any (array['marketing'::text, 'team_lead'::text])) and ((last_branch is null) or user_has_branch_access(last_branch)))
    or (current_user_role() = 'operations_lead'::text)
  )
  with check (
    is_super_admin() or asa_has_grant('crm'::text) or asa_has_grant('queue_all'::text)
    or (current_user_role() = 'sales'::text)
    or ((current_user_role() = 'admin'::text) and ((last_branch is null) or user_has_branch_access(last_branch)))
    or ((current_user_role() = any (array['marketing'::text, 'team_lead'::text])) and ((last_branch is null) or user_has_branch_access(last_branch)))
    or (current_user_role() = 'operations_lead'::text)
  );

-- 3 ---------------------------------------------------------------------------
-- Patch the two function bodies in place; fail loudly if they have drifted.
do $patch$
declare
  def text;
begin
  def := pg_get_functiondef('public.sync_queue_assignments(uuid, uuid[])'::regprocedure);
  if position($a$caller_role not in ('BossMich', 'team_lead', 'assistant_super_admin')$a$ in def) = 0
     or position($a$if not public.user_has_branch_access(target_booking.branch) then$a$ in def) = 0 then
    raise exception 'sync_queue_assignments changed; update this migration';
  end if;
  def := replace(def,
    $a$caller_role not in ('BossMich', 'team_lead', 'assistant_super_admin')$a$,
    $a$caller_role not in ('BossMich', 'team_lead', 'assistant_super_admin', 'operations_lead')$a$);
  def := replace(def,
    $a$'Assignment synchronization is restricted to BossMich, ASA, or team lead'$a$,
    $a$'Assignment synchronization is restricted to BossMich, ASA, team lead, or operations lead'$a$);
  def := replace(def,
    $a$if not public.user_has_branch_access(target_booking.branch) then$a$,
    $a$if caller_role <> 'operations_lead' and not public.user_has_branch_access(target_booking.branch) then$a$);
  execute def;

  def := pg_get_functiondef('public.admin_override_queue_status(uuid, text, text)'::regprocedure);
  if position($a$caller_role not in ('admin', 'BossMich', 'assistant_super_admin')$a$ in def) = 0
     or position($a$if not public.user_has_branch_access(target_booking.branch) then$a$ in def) = 0 then
    raise exception 'admin_override_queue_status changed; update this migration';
  end if;
  def := replace(def,
    $a$caller_role not in ('admin', 'BossMich', 'assistant_super_admin')$a$,
    $a$caller_role not in ('admin', 'BossMich', 'assistant_super_admin', 'operations_lead')$a$);
  def := replace(def,
    $a$'Only Branch Admin, Super Admin, or Assistant Super Admin may override queue status'$a$,
    $a$'Only Branch Admin, Super Admin, Assistant Super Admin, or Operations Lead may override queue status'$a$);
  def := replace(def,
    $a$if not public.user_has_branch_access(target_booking.branch) then$a$,
    $a$if caller_role <> 'operations_lead' and not public.user_has_branch_access(target_booking.branch) then$a$);
  execute def;
end
$patch$;

commit;
