-- BUG-069 / BUG-070: an expense posted by an approved Daily Sheet must not be
-- editable or deletable behind the sheet's back, and the route must not be the
-- only thing denying a Branch Admin the books.
--
-- Two problems with the policies in 20260801150000_asa_finance_grant_rls.sql:
--
--   1. `expenses_delete` / `expenses_update` never mention daily_sheet_line_id.
--      `review_daily_sheet` copies an approved sheet's lines into `expenses`
--      with `daily_sheet_line_id` set, and the sheet's stored totals are
--      computed from exactly those rows. Deleting or editing one afterwards
--      leaves a sheet that still reads "approved" with figures that are no
--      longer in the books, with nothing reporting the divergence.
--
--   2. `expenses_delete` grants `is_admin()`, but `allowRoute(profile,
--      'finance')` is false for a Branch Admin. The UI hides the Books page;
--      a direct PostgREST DELETE does not go through the UI, so the route was
--      never the control. Finance writes stay with Super Admin and an ASA
--      holding `finance_write`.
--
-- `reopen_daily_sheet` (Super Admin only) remains the sanctioned way to undo a
-- sheet-posted expense: it voids the rows, writes an audit event and returns
-- the sheet to `returned`. This policy simply refuses the back door.
--
-- Guarded: aborts if the sheet-posted expenses this assumes are not the shape
-- we verified, so running it against drifted data does nothing rather than
-- half-applying.

begin;

do $$
declare
  v_sheet_posted int;
begin
  select count(*) into v_sheet_posted
  from public.expenses
  where daily_sheet_line_id is not null;

  -- The column must exist before it can be used in a policy; if this migration
  -- ever runs before the daily sheet one, stop rather than fail obscurely.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'expenses'
      and column_name = 'daily_sheet_line_id'
  ) then
    raise exception 'expenses.daily_sheet_line_id is missing — apply the daily sheet migration first';
  end if;

  raise notice 'expenses rows carrying daily_sheet_line_id: %', v_sheet_posted;
end $$;

-- Insert is unaffected: a new bill has no sheet line.
-- The guard applies to Super Admin too. `reopen_daily_sheet` is security
-- definer and voids these rows as part of returning a sheet to `returned`;
-- deleting one from the Finance page is not that, even for Super Admin.
drop policy if exists "expenses_delete" on public.expenses;
create policy "expenses_delete"
on public.expenses
for delete
to authenticated
using (
  daily_sheet_line_id is null
  and (
    public.is_super_admin()
    or (
      public.is_assistant_super_admin()
      and public.asa_has_grant('finance_write')
    )
  )
);

drop policy if exists "expenses_update" on public.expenses;
create policy "expenses_update"
on public.expenses
for update
to authenticated
using (
  daily_sheet_line_id is null
  and (
    public.is_super_admin()
    or (
      public.is_assistant_super_admin()
      and public.asa_has_grant('finance_write')
    )
  )
)
with check (
  public.is_super_admin()
  or (
    public.is_assistant_super_admin()
    and public.asa_has_grant('finance_write')
  )
);

commit;

-- A Branch Admin can still READ the branch's expenses (`expenses_select` keeps
-- `current_user_role() = 'admin' and user_has_branch_access(branch)`), which is
-- what POS needs. Only write rights move.