-- Post-migration verification for BUG-069 / BUG-070 / BUG-071 / BUG-079.
--
-- Run this AFTER applying, in order:
--   1. 20261010120000_protect_daily_sheet_posted_expenses.sql
--   2. 20261010130000_drop_permissive_admin_for_all_policies.sql
--   3. 20261010140000_scope_notification_reads.sql
--
-- It reads pg_policies and pg_roles directly, so it reports what is actually in
-- force rather than what the migration files claim. Every line should read PASS.
-- Nothing here writes anything.
--
-- Why this exists: the first attempt at BUG-070 redefined a restrictive policy
-- and changed nothing, because an older `for all` policy was still OR-ing in.
-- A migration that exits 0 is not evidence that the intent landed. This is.

\echo '=== BUG-071: no FOR ALL policy may survive on the money + customer tables ==='
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('customers', 'transactions', 'expenses')
  and cmd = 'ALL'
order by tablename;

-- Expect ZERO rows.
select case when count(*) = 0 then 'PASS' else 'FAIL — a FOR ALL policy is still granting everything' end as verdict
from pg_policies
where schemaname = 'public'
  and tablename in ('customers', 'transactions', 'expenses')
  and cmd = 'ALL';

\echo ''
\echo '=== BUG-071: no policy may grant DELETE on customers to a Branch Admin ==='
-- is_admin() resolves to role = 'admin', which is Branch Admin, not just Super Admin.
select tablename, policyname, cmd, qual
from pg_policies
where schemaname = 'public'
  and cmd in ('DELETE', 'ALL')
  and qual ilike '%is_admin%'
order by tablename, policyname;

select case when count(*) = 0 then 'PASS' else 'FAIL — a Branch Admin can still delete' end as verdict
from pg_policies
where schemaname = 'public'
  and tablename in ('customers', 'transactions', 'expenses')
  and cmd in ('DELETE', 'ALL')
  and qual ilike '%is_admin%';

\echo ''
\echo '=== BUG-069: sheet-posted expenses must be unreachable by any write policy ==='
select tablename, policyname, cmd, qual
from pg_policies
where schemaname = 'public'
  and tablename = 'expenses'
  and cmd in ('UPDATE', 'DELETE', 'ALL');

-- Every UPDATE/DELETE policy on expenses must mention the guard. Read them and
-- confirm; a policy missing it would let Super Admin delete behind the sheet.
select case when count(*) = 0 then 'PASS' else 'REVIEW — a write policy on expenses does not mention daily_sheet_line_id' end as verdict
from pg_policies
where schemaname = 'public'
  and tablename = 'expenses'
  and cmd in ('UPDATE', 'DELETE', 'ALL')
  and qual not ilike '%daily_sheet_line_id is null%';

\echo ''
\echo '=== notification spoofing: only Super Admin may address another user ==='
select policyname, cmd, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'user_notifications'
  and cmd = 'INSERT';

\echo ''
\echo '=== BUG-079: a Branch Admin must not read the whole company inbox ==='
-- The bell selects with no user_id filter, so this policy IS the scoping.
-- is_admin() is true for role = 'admin', which is Branch Admin.
select policyname, cmd, qual
from pg_policies
where schemaname = 'public'
  and tablename = 'user_notifications'
  and cmd in ('SELECT', 'ALL');

select case when count(*) = 0 then 'PASS' else 'FAIL — a Branch Admin still reads every user notification' end as verdict
from pg_policies
where schemaname = 'public'
  and tablename = 'user_notifications'
  and cmd in ('SELECT', 'ALL')
  and (qual ilike '%is_admin%' or qual ilike '%is_team_lead%');

\echo ''
\echo '=== NOT BROKEN: every user must still read their OWN notifications ==='
-- The narrowing is a no-op for everyone except the Branch Admin, but if this
-- reads FAIL the bell goes dark for everyone, which is worse than the leak.
select policyname, cmd, qual
from pg_policies
where schemaname = 'public'
  and tablename = 'user_notifications'
  and cmd = 'SELECT'
  and qual ilike '%auth.uid()%';

select case when count(*) > 0 then 'PASS' else 'FAIL — no policy would let a user read their own inbox' end as verdict
from pg_policies
where schemaname = 'public'
  and tablename = 'user_notifications'
  and cmd = 'SELECT'
  and qual ilike '%auth.uid()%';

-- Super Admin keeps the support affordance this policy descends from.
select case when count(*) > 0 then 'PASS' else 'FAIL — Super Admin lost the support read' end as verdict
from pg_policies
where schemaname = 'public'
  and tablename = 'user_notifications'
  and cmd = 'SELECT'
  and qual ilike '%is_super_admin%';

\echo ''
\echo '=== NOT BROKEN: Branch Admin must still work at the queue and POS ==='
-- Losing DELETE is intentional. Losing these would break the daily shift.
select
  (select count(*) > 0 from pg_policies
    where schemaname='public' and tablename='customers' and cmd='INSERT'
      and with_check ilike '%admin%') as customers_insert_ok,
  (select count(*) > 0 from pg_policies
    where schemaname='public' and tablename='customers' and cmd='UPDATE'
      and qual ilike '%admin%') as customers_update_ok,
  (select count(*) > 0 from pg_policies
    where schemaname='public' and tablename='customers' and cmd='SELECT'
      and qual ilike '%admin%') as customers_select_ok,
  (select count(*) > 0 from pg_policies
    where schemaname='public' and tablename='expenses' and cmd='SELECT') as expenses_select_ok,
  (select count(*) > 0 from pg_policies
    where schemaname='public' and tablename='transactions' and cmd='SELECT') as transactions_select_ok;

\echo ''
\echo '=== the sheet-posted expense rows are still intact ==='
select
  count(*) filter (where daily_sheet_line_id is not null) as sheet_posted,
  count(*) filter (where daily_sheet_line_id is null) as ordinary_bills
from public.expenses;

\echo ''
\echo 'If any verdict reads FAIL, stop and report it — do not work around it by'
\echo 're-adding the grant. The permissive policy has to be dropped by name.'