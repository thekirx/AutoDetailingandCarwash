-- BUG-080: a Branch Admin could rewrite every SMS template in the company.
--
-- The policy in force since 20260720130000_phase1_to_4_platform_schema.sql is:
--
--   create policy "Marketing sms templates" on public.sms_templates
--   for all to authenticated
--   using      ((select public.is_admin()) or (select public.current_user_role()) = 'marketing')
--   with check ((select public.is_admin()) or (select public.current_user_role()) = 'marketing');
--
-- Two things are wrong with it, and the first is the one that matters:
--
--   1. It is `for all`. Because RLS policies are permissive and OR-combined, a
--      single `for all` policy grants INSERT, UPDATE and DELETE as well as
--      SELECT — there is no separate write policy that could narrow it. So
--      `is_admin()`, which is true for role = 'admin' (the Branch Admin), hands a
--      store manager write access to every message the company sends. The policy
--      is named "Marketing sms templates"; the grant says Branch Admin.
--
--   2. Reading and writing templates are not the same permission. Marketing needs
--      to author copy; everyone else only needs to read it.
--
-- This was found by sweeping every table whose policy mentions is_admin(), not
-- by reading tables one at a time. Most of that sweep is legitimate and is
-- deliberately left alone: branches, planner configuration and audit trails are
-- meant to be read network-wide, and membership_tiers was already narrowed to
-- Super Admin / ASA-with-memberships in 20260820310000.
--
-- SMS feature work is out of scope right now, but a database that lets any store
-- manager silently rewrite the company's outgoing copy is a data-integrity bug
-- whether or not the sending path is finished.
--
-- Guards: aborts unless the policy it replaces is exactly the shape verified
-- here, so running this against a database this team has already changed does
-- nothing rather than half-applying.

begin;

do $$
declare
  v_current text;
begin
  select qual into v_current
  from pg_policies
  where tablename = 'sms_templates' and policyname = 'Marketing sms templates';

  if v_current is null then
    raise exception 'the "Marketing sms templates" policy is missing — refusing to guess at a policy this migration has not read';
  end if;

  if v_current not ilike '%is_admin%' or v_current not ilike '%marketing%' then
    raise exception 'the "Marketing sms templates" policy has drifted from the shape this migration verified. Current predicate: %', v_current;
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_super_admin'
  ) then
    raise exception 'public.is_super_admin() is missing — the replacement policies depend on it';
  end if;

  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'sms_templates') then
    raise exception 'public.sms_templates is missing — apply the platform schema migration first';
  end if;
end $$;

drop policy if exists "Marketing sms templates" on public.sms_templates;

-- Reads stay open to everyone who can read the rest of the catalogue; the app's
-- own UI is the gate for who may compose a message.
create policy "sms_templates_read"
on public.sms_templates
for select
to authenticated
using (true);

create policy "sms_templates_insert"
on public.sms_templates
for insert
to authenticated
with check (public.is_super_admin() or public.current_user_role() = 'marketing');

create policy "sms_templates_update"
on public.sms_templates
for update
to authenticated
using (public.is_super_admin() or public.current_user_role() = 'marketing')
with check (public.is_super_admin() or public.current_user_role() = 'marketing');

create policy "sms_templates_delete"
on public.sms_templates
for delete
to authenticated
using (public.is_super_admin() or public.current_user_role() = 'marketing');

commit;

-- After this:
--   every authenticated user can still READ the template catalogue
--   only Super Admin or a Marketing user can INSERT / UPDATE / DELETE templates
--   a Branch Admin can no longer rewrite what the company sends to customers
--
-- NOTE: `for all` was dropped, so DELETE is governed by its own policy above.
-- The table grant (select, insert, update on public.sms_templates) is unchanged —
-- RLS is the boundary, not the grant.