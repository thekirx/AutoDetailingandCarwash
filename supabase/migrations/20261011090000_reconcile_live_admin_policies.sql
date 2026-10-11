-- BUG-071 / BUG-079 / BUG-080 against the policies production actually has.
--
-- 20261010130000, 20261010140000 and 20261010150000 abort on production by
-- design: their guards expect "Admin has full access to customers", "Admins
-- manage expenses" and a user_notifications_select shaped
-- `own or (is_admin() and own)`, none of which exist there (an earlier
-- migration already renamed them). 20261010130000 would also fail outright:
-- its transactions_select reads `branch`, and transactions has no branch
-- column. This file reaches the same end state from the live policies.
--
-- Live state read 2026-10-11 and what changes:
--
--   transactions        "Admin has full access to transactions" (ALL, is_admin())
--                       is the only policy, so a Branch Admin can insert/update/
--                       delete money rows over PostgREST. The app never writes
--                       transactions from the browser (server code uses the
--                       service role, POS goes through definer RPCs), so write
--                       goes and read stays exactly is_admin().
--
--   user_notifications  select is `own or is_admin()`: Branch Admin and ASA read
--                       every user's notifications. Insert is `with check
--                       is_admin()` with no user_id constraint. Read becomes own
--                       or Super Admin; insert becomes self or Super Admin. All
--                       app inserts are server-side (service role).
--
--   sms_templates       "Marketing sms templates" (ALL, is_admin() or marketing).
--                       The SMS tab is canEditCrm: Super Admin, ASA with 'crm',
--                       Marketing. Branch Admin is dropped; ASA with 'crm' keeps
--                       the template editor 20261010150000 would have taken away.
--
--   customers           Not changed. customers_soft_delete turns every DELETE
--                       into an archive, so no role can hard-delete a customer.
--
-- Verify: scripts/probe-rls-role-matrix.sql (rolled back, must report fail 0).

begin;

do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_super_admin'
  ) then
    raise exception 'public.is_super_admin() is missing — the replacement policies depend on it';
  end if;
  if to_regprocedure('public.is_admin()') is null
     or to_regprocedure('public.asa_has_grant(text)') is null
     or to_regprocedure('public.current_user_role()') is null then
    raise exception 'role helper functions missing; the replacement policies depend on them';
  end if;
end $$;

-- ------------------------------------------------------------- transactions
drop policy if exists "Admin has full access to transactions" on public.transactions;
drop policy if exists "transactions_select" on public.transactions;
create policy "transactions_select"
on public.transactions
for select
to authenticated
using ((select public.is_admin()));

-- ------------------------------------------------------- user_notifications
drop policy if exists "user_notifications_select" on public.user_notifications;
create policy "user_notifications_select"
on public.user_notifications
for select
to authenticated
using (user_id = (select auth.uid()) or public.is_super_admin());

drop policy if exists "Admins insert notifications" on public.user_notifications;
drop policy if exists "user_notifications_insert" on public.user_notifications;
create policy "user_notifications_insert"
on public.user_notifications
for insert
to authenticated
with check (user_id = (select auth.uid()) or (select public.is_super_admin()));

-- ------------------------------------------------------------ sms_templates
drop policy if exists "Marketing sms templates" on public.sms_templates;
create policy "Marketing sms templates"
on public.sms_templates
for all
to authenticated
using (
  (select public.is_super_admin())
  or (select public.asa_has_grant('crm'))
  or (select public.current_user_role()) = 'marketing'
)
with check (
  (select public.is_super_admin())
  or (select public.asa_has_grant('crm'))
  or (select public.current_user_role()) = 'marketing'
);

commit;
