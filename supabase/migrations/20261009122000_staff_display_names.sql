-- Name + role only (no phone / rate) for staff in the caller's branches.
-- Lets read-only roles (investor) label Daily Sheet salary lines without opening staff_profiles.
create or replace function public.staff_display_names(p_ids uuid[])
returns table (id uuid, full_name text, role text)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select sp.id, sp.full_name, sp.role::text
  from public.staff_profiles sp
  where auth.uid() is not null
    and sp.id = any(p_ids)
    and (
      public.user_has_branch_access(sp.branch_slug)
      or exists (
        select 1 from public.staff_branch_assignments a
        where a.staff_id = sp.id and public.user_has_branch_access(a.branch_slug)
      )
    );
$$;

revoke all on function public.staff_display_names(uuid[]) from public, anon;
grant execute on function public.staff_display_names(uuid[]) to authenticated;
