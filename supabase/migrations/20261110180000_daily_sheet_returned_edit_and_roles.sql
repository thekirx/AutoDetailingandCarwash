-- Daily sheets: ensure returned sheets can be edited, corrected and re-submitted
-- Explicitly grant edit and review access to Owner (BossMich/super_admin), Lucy, Robert, and Branch Admin.

create or replace function public.daily_sheet_can_edit(p_branch text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and (
    public.current_user_role() in ('BossMich', 'super_admin')
    or (
      public.current_user_role() = 'admin'
      and public.user_has_branch_access(p_branch)
    )
    or (
      public.current_user_role() = 'assistant_super_admin'
      and (
        public.asa_has_grant('pos')
        or public.asa_has_grant('finance_write')
        or exists (
          select 1 from public.staff_profiles sp
          where sp.id = (select auth.uid())
            and (
              lower(sp.full_name) like '%lucy%'
              or lower(sp.full_name) like '%luci%'
              or lower(sp.full_name) like '%robert%'
            )
        )
      )
      and public.user_has_branch_access(p_branch)
    )
  );
$$;

create or replace function public.daily_sheet_can_review()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and (
    public.current_user_role() in ('BossMich', 'super_admin')
    or (
      public.current_user_role() = 'assistant_super_admin'
      and (
        public.asa_has_grant('finance_view')
        or exists (
          select 1 from public.staff_profiles sp
          where sp.id = (select auth.uid())
            and (
              lower(sp.full_name) like '%lucy%'
              or lower(sp.full_name) like '%luci%'
              or lower(sp.full_name) like '%robert%'
            )
        )
      )
    )
  );
$$;

revoke all on function public.daily_sheet_can_edit(text) from public, anon;
revoke all on function public.daily_sheet_can_review() from public, anon;
grant execute on function public.daily_sheet_can_edit(text) to authenticated;
grant execute on function public.daily_sheet_can_review() to authenticated;

