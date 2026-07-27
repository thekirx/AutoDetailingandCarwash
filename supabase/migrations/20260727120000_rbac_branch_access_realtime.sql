-- RBAC: multi-branch access helpers, assignment writes for branch admins, realtime profile sync
-- NOTE: write policies must NOT use FOR ALL (that evaluates on SELECT and recurses via user_has_branch_access).

create or replace function public.user_has_branch_access(input_branch text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    input_branch is not null
    and (
      public.is_super_admin()
      or (
        public.is_assistant_super_admin()
        and coalesce(
          (
            select (sp.permission_grants ->> 'branches_all')::boolean
            from public.staff_profiles sp
            where sp.id = (select auth.uid())
              and coalesce(sp.is_active, false)
              and not coalesce(sp.is_archived, false)
            limit 1
          ),
          true
        )
      )
      or exists (
        select 1
        from public.staff_branch_assignments sba
        where sba.staff_id = (select auth.uid())
          and sba.branch_slug = input_branch
      )
      or public.current_user_branch() = input_branch
    );
$$;

create or replace function public.current_user_branch_slugs()
returns text[]
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case
    when public.is_super_admin() then null
    when public.is_assistant_super_admin()
      and coalesce(
        (
          select (sp.permission_grants ->> 'branches_all')::boolean
          from public.staff_profiles sp
          where sp.id = (select auth.uid())
          limit 1
        ),
        true
      )
      then null
    else coalesce(
      (
        select array_agg(sba.branch_slug order by sba.branch_slug)
        from public.staff_branch_assignments sba
        where sba.staff_id = (select auth.uid())
      ),
      case
        when public.current_user_branch() is null then '{}'::text[]
        else array[public.current_user_branch()]
      end
    )
  end;
$$;

revoke all on function public.user_has_branch_access(text) from public;
revoke all on function public.current_user_branch_slugs() from public;
grant execute on function public.user_has_branch_access(text) to authenticated;
grant execute on function public.current_user_branch_slugs() to authenticated;

drop policy if exists staff_branch_assignments_write on public.staff_branch_assignments;
drop policy if exists staff_branch_assignments_insert on public.staff_branch_assignments;
drop policy if exists staff_branch_assignments_update on public.staff_branch_assignments;
drop policy if exists staff_branch_assignments_delete on public.staff_branch_assignments;

create policy staff_branch_assignments_insert on public.staff_branch_assignments
  for insert to authenticated
  with check (
    public.is_super_admin()
    or public.is_assistant_super_admin()
    or (
      public.current_user_role() = 'admin'
      and public.user_has_branch_access(branch_slug)
    )
  );

create policy staff_branch_assignments_update on public.staff_branch_assignments
  for update to authenticated
  using (
    public.is_super_admin()
    or public.is_assistant_super_admin()
    or (
      public.current_user_role() = 'admin'
      and public.user_has_branch_access(branch_slug)
    )
  )
  with check (
    public.is_super_admin()
    or public.is_assistant_super_admin()
    or (
      public.current_user_role() = 'admin'
      and public.user_has_branch_access(branch_slug)
    )
  );

create policy staff_branch_assignments_delete on public.staff_branch_assignments
  for delete to authenticated
  using (
    public.is_super_admin()
    or public.is_assistant_super_admin()
    or (
      public.current_user_role() = 'admin'
      and public.user_has_branch_access(branch_slug)
    )
  );

do $$
begin
  begin
    alter publication supabase_realtime add table public.staff_profiles;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.staff_branch_assignments;
  exception when duplicate_object then null;
  end;
end $$;

alter table public.staff_profiles replica identity full;
alter table public.staff_branch_assignments replica identity full;
