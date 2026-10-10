-- BUG-079: a Branch Admin could read every user's notifications.
--
-- The read policy (20260820310000_finance_loyalty_catalog_rls_merge.sql) is:
--
--   create policy user_notifications_select ... for select to authenticated
--   using (user_id = (select auth.uid()) or public.is_admin());
--
-- and `is_admin()` is `current_user_role() in ('admin', 'BossMich')` — role
-- 'admin' is the Branch Admin. The affordance it descends from was written as
--
--   -- Admins can read inbox for support (optional)
--
-- which means the owner's Super Admin looking into a customer's inbox on their
-- behalf. It does not mean every store manager.
--
-- This is not latent. `NotificationBell` is the only reader of this table and
-- it selects with NO user_id filter:
--
--   .from('user_notifications')
--   .select('id, title, body, url, read_at, created_at')
--   .order('created_at', { ascending: false })
--   .limit(20)
--
-- It relies entirely on RLS for scoping. So a Branch Admin signing into their own
-- operations portal rendered the newest 20 notifications belonging to the entire
-- company: other branches' customers' names, plates and services, plus crew
-- payroll alerts addressed to individuals. The `unread` badge counted them too.
--
-- Nothing in the app depends on a cross-user read — the bell is the sole
-- consumer, and every other role already saw only its own rows. Narrowing to
-- own-rows-plus-Super-Admin is therefore a no-op for every role that was
-- already correctly scoped, and removes the company-wide feed from the one role
-- that had it.
--
-- Guards: aborts if the policy it is replacing is not the shape we verified, so
-- running it against a database this team has already changed does nothing
-- rather than silently narrowing by accident.

begin;

do $$
declare
  v_current text;
  v_rows bigint;
begin
  select count(*) into v_rows from public.user_notifications;

  if not exists (
    select 1 from pg_policies
    where tablename = 'user_notifications'
      and policyname = 'user_notifications_select'
      and cmd = 'SELECT'
  ) then
    raise exception 'user_notifications_select is missing — refusing to guess at a policy this migration has not read';
  end if;

  select qual into v_current
  from pg_policies
  where tablename = 'user_notifications' and policyname = 'user_notifications_select';

  -- Refuse to run if someone has already changed the policy. Silently replacing
  -- an unfamiliar predicate could remove an access grant we never saw.
  if v_current is distinct from '((user_id = ( SELECT auth.uid() AS uid)) OR (is_admin() AND (user_id = ( SELECT auth.uid() AS uid))))' then
    raise exception 'user_notifications_select has drifted from the shape this migration verified. Current predicate: %', v_current;
  end if;

  -- is_super_admin() must exist or the replacement silently denies Super Admin too.
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_super_admin'
  ) then
    raise exception 'public.is_super_admin() is missing — the replacement policy depends on it';
  end if;

  raise notice 'user_notifications rows: %', v_rows;
end $$;

drop policy if exists user_notifications_select on public.user_notifications;
create policy user_notifications_select
on public.user_notifications
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_super_admin()
);

commit;

-- After this:
--   a Branch Admin, crew member, Team Lead, ASA and customer each read only
--   their own notification rows, and see only their own bell.
--   Super Admin additionally retains the support affordance of reading any
--   user's inbox.
--
-- Notifications are still WRITTEN by the app's security-definer RPCs
-- (shift_close, planner assignment and so on), which bypass RLS entirely, so
-- fan-out to the intended recipients is unaffected.