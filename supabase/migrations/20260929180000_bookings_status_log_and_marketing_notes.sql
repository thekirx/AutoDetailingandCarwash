-- Found by a rolled-back role walk-through of the operations portal.
--
-- 1. Every bookings status change fires log_queue_status_change(), which
--    writes the history row to queue_events. It ran as the calling user, and
--    only queue managers (can_manage_branch) may insert queue_events, so Sales
--    could not confirm a booking and a Detailer could not advance a detailing
--    job on the Bookings board. The trigger only records old/new status and
--    auth.uid() after an update RLS already allowed, and its search_path is
--    fixed, so it now runs as the table owner like other audit triggers.
-- 2. CRM shows the customer note box to everyone who opens CRM, but the insert
--    policy left out Marketing, whose main page CRM is.
-- 3. Geo time-in: the Bacoor and Batangas pins were rough (Bacoor ~7.7 km from
--    the shop, Batangas the city centre), with geofencing on for every account
--    and a 20 m radius, so nobody at the shop could clock in (every attendance
--    row since 23 Sep was an admin override). Pins now come from each shop's
--    Google Maps listing (the same ones branchDirections() uses).
-- 4. The geofence error used RAISE's '%s', printing "7718s m"; RAISE takes '%'.

begin;

-- 1
alter function public.log_queue_status_change() security definer;

-- 2
alter policy customer_notes_insert on public.customer_notes with check (
  is_super_admin()
  or (current_user_role() = any (array['admin'::text, 'team_lead'::text, 'sales'::text, 'BossMich'::text, 'marketing'::text]))
  or asa_has_grant('crm'::text)
  or asa_has_grant('queue_all'::text)
);

-- 3
update public.branches set latitude = 14.4075665, longitude = 120.977126 where slug = 'bacoor';
update public.branches set latitude = 13.7762991, longitude = 121.0664943 where slug = 'batangas';

-- 4
do $patch$
declare
  def text;
begin
  def := pg_get_functiondef('public.enforce_staff_attendance_geofence()'::regprocedure);
  if position('''Outside geofence (%s m away; allowed %s m)''' in def) = 0 then
    raise exception 'enforce_staff_attendance_geofence changed; update this migration';
  end if;
  def := replace(def, '''Outside geofence (%s m away; allowed %s m)''', '''Outside geofence (% m away; allowed % m)''');
  execute def;
end
$patch$;

commit;
