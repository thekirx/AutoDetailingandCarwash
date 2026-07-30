-- Branch Admin expenses: require user_has_branch_access (SA/ASA keep company-wide via their helpers)
begin;

drop policy if exists "Admins manage expenses" on public.expenses;

create policy "Admins manage expenses"
on public.expenses
for all
to authenticated
using (
  public.is_super_admin()
  or public.is_assistant_super_admin()
  or (
    public.is_admin()
    and public.user_has_branch_access(branch)
  )
)
with check (
  public.is_super_admin()
  or public.is_assistant_super_admin()
  or (
    public.is_admin()
    and public.user_has_branch_access(branch)
  )
);

commit;
