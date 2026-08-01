-- ASA finance grant honesty: finance_view = read, finance_write = mutate.
-- Splits expenses FOR ALL so view-only ASA cannot write via PostgREST.

begin;

drop policy if exists "Admins manage expenses" on public.expenses;

create policy "expenses_select"
on public.expenses
for select
to authenticated
using (
  public.is_super_admin()
  or (
    public.is_assistant_super_admin()
    and public.asa_has_grant('finance_view')
  )
  or (
    public.is_admin()
    and public.user_has_branch_access(branch)
  )
);

create policy "expenses_write"
on public.expenses
for insert
to authenticated
with check (
  public.is_super_admin()
  or (
    public.is_assistant_super_admin()
    and public.asa_has_grant('finance_write')
  )
  or (
    public.is_admin()
    and public.user_has_branch_access(branch)
  )
);

create policy "expenses_update"
on public.expenses
for update
to authenticated
using (
  public.is_super_admin()
  or (
    public.is_assistant_super_admin()
    and public.asa_has_grant('finance_write')
  )
  or (
    public.is_admin()
    and public.user_has_branch_access(branch)
  )
)
with check (
  public.is_super_admin()
  or (
    public.is_assistant_super_admin()
    and public.asa_has_grant('finance_write')
  )
  or (
    public.is_admin()
    and public.user_has_branch_access(branch)
  )
);

create policy "expenses_delete"
on public.expenses
for delete
to authenticated
using (
  public.is_super_admin()
  or (
    public.is_assistant_super_admin()
    and public.asa_has_grant('finance_write')
  )
  or (
    public.is_admin()
    and public.user_has_branch_access(branch)
  )
);

drop policy if exists "Admins read expense events" on public.expense_status_events;
create policy "expense_events_select"
on public.expense_status_events
for select
to authenticated
using (
  public.is_super_admin()
  or (
    public.is_assistant_super_admin()
    and public.asa_has_grant('finance_view')
  )
  or public.is_admin()
);

drop policy if exists expense_categories_write on public.expense_categories;
create policy expense_categories_write
on public.expense_categories
for all
to authenticated
using (
  public.is_super_admin()
  or (
    public.is_assistant_super_admin()
    and public.asa_has_grant('finance_write')
  )
  or public.is_admin()
)
with check (
  public.is_super_admin()
  or (
    public.is_assistant_super_admin()
    and public.asa_has_grant('finance_write')
  )
  or public.is_admin()
);

commit;
