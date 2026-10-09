-- BUG-071 (Critical): Branch Admin held DELETE on customers, transactions and
-- expenses because an old `for all` policy was never dropped.
--
-- BUG-069/BUG-070 redefined `expenses_delete` and `expenses_update`, which did
-- NOT close the hole, because RLS policies are permissive and combined with OR.
-- Adding a restrictive policy alongside a permissive one widens access, never
-- narrows it. `02_super_admin_setup.sql` and `20260730130000_admin_expenses_
-- branch_scope.sql` both define `for all` policies guarded by `is_admin()`, and
-- is_admin() is `current_user_role() in ('admin','BossMich','assistant_super_admin')`
-- — true for a Branch Admin. Those `for all` policies re-granted DELETE to every
-- Branch Admin, including the sheet-posted expenses BUG-069 was about.
--
-- The fix is to DROP the permissive `for all` policies so only the granular
-- per-command policies remain. Each replacement preserves what Branch Admin
-- legitimately needs (customer create/update at the queue and POS, reading its
-- branch's expenses and transactions) and removes only DELETE.
--
-- NOT EXECUTED. Production writes are the owner's call.
--
-- Guarded: aborts unless the three permissive policies are still present and in
-- the shape we verified, so running it against an already-fixed or drifted
-- database does nothing rather than half-applying.

begin;

do $$
declare
  v_leftover int;
begin
  -- If these are already gone someone applied an equivalent fix; stop rather
  -- than silently re-creating policies with different names.
  if not exists (select 1 from pg_policies
                 where tablename = 'customers'
                   and policyname = 'Admin has full access to customers') then
    raise exception 'customers: permissive policy already absent — reconcile before running';
  end if;
  if not exists (select 1 from pg_policies
                 where tablename = 'transactions'
                   and policyname = 'Admin has full access to transactions') then
    raise exception 'transactions: permissive policy already absent — reconcile before running';
  end if;
  if not exists (select 1 from pg_policies
                 where tablename = 'expenses'
                   and policyname = 'Admins manage expenses') then
    raise exception 'expenses: permissive policy already absent — reconcile before running';
  end if;

  -- Confirm the blast radius we are about to remove, for the migration log.
  select count(*) into v_leftover
  from pg_policies
  where tablename in ('customers','transactions','expenses') and policyname in (
    'Admin has full access to customers',
    'Admin has full access to transactions',
    'Admins manage expenses'
  );
  raise notice 'permissive policies about to be dropped: %', v_leftover;
end $$;

-- ---------------------------------------------------------------- customers
-- Branch Admin keeps SELECT / INSERT / UPDATE through the queue, CRM and POS
-- policies that already exist. Only DELETE goes away.
drop policy if exists "Admin has full access to customers" on public.customers;

-- Branch Admin may never DELETE a customer. Deleting one cascades away the
-- customer's loyalty ledger, memberships, notes and reviews, which is the
-- history BUG-068 was written to protect. Superseded customers.archive(). It
-- soft-deletes (is_archived) precisely so this row survives.
drop policy if exists "Admins can delete customers" on public.customers;
drop policy if exists "Admins delete customers" on public.customers;

do $$
begin
  if not exists (select 1 from pg_policies
                 where tablename = 'customers' and policyname = 'customers_delete') then
    create policy "customers_delete"
    on public.customers
    for delete
    to authenticated
    using (public.is_super_admin());
  end if;
end $$;

-- ------------------------------------------------------------- transactions
-- Branch Admin had full CRUD on the money chain. The Books route denies them
-- (allowRoute({role:'admin'},'finance') is false), so the UI hid it while
-- PostgREST did not. Read is preserved for POS; write is Super Admin only.
drop policy if exists "Admin has full access to transactions" on public.transactions;

do $$
begin
  if not exists (select 1 from pg_policies
                 where tablename = 'transactions' and policyname = 'transactions_select') then
    create policy "transactions_select"
    on public.transactions
    for select
    to authenticated
    using (public.is_admin() and public.user_has_branch_access(branch));
  end if;
end $$;

-- ----------------------------------------------------------------- expenses
-- `for all` re-granted Branch Admin the DELETE that BUG-069 just closed.
drop policy if exists "Admins manage expenses" on public.expenses;

-- expenses_select is untouched: a Branch Admin still reads its branch's bills,
-- which POS and the daily sheet need. expenses_write (INSERT) is also left in
-- place; 20261010120000 already restricts UPDATE and DELETE to Super Admin and
-- an ASA with finance_write, and excludes daily_sheet_line_id rows.

-- --------------------------------------------------- user_notifications insert
-- "Admins insert notifications" is `with check (public.is_admin())` with nothing
-- constraining user_id, so a Branch Admin can insert a notification addressed to
-- ANY user — including the owner. The app's own fan-out goes through
-- security-definer RPCs and is unaffected by this policy; only a direct
-- PostgREST insert is narrowed. Only Super Admin may address someone else.
drop policy if exists "Admins insert notifications" on public.user_notifications;

create policy "user_notifications_insert"
on public.user_notifications
for insert
to authenticated
with check (
  public.is_super_admin()
  or user_id = (select auth.uid())
);

commit;

-- After this, and with 20261010120000 applied, a Branch Admin may:
--   customers       SELECT / INSERT / UPDATE        NOT DELETE
--   transactions    SELECT                         NOT INSERT / UPDATE / DELETE
--   expenses        SELECT / INSERT                 NOT UPDATE / DELETE
--   user_notifications INSERT, addressed to self    NOT to anyone else
--
-- NOT changed, because these are scoped deliberately rather than left over:
--   app_settings    INSERT / UPDATE / DELETE, except the `attendance_roles` key
--                   which is Super Admin only. That split was written on purpose.
--
-- Any behaviour change on the POS hand-off flow means a read policy was missing,
-- not that these grants should come back — add the SELECT, not the FOR ALL.