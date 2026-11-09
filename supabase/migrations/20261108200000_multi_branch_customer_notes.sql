-- 20261108200000_multi_branch_customer_notes.sql
-- Multi-branch customer notes and staff attribution.
-- Ensures that when an existing customer from Bacoor visits another branch (e.g. Imus, Alabang),
-- notes created by the Bacoor Team Lead (and previous visit history) are fully visible to other TLs and Admins.

begin;

-- 1. Add branch_slug to customer_notes
alter table public.customer_notes
  add column if not exists branch_slug text;

comment on column public.customer_notes.branch_slug is
  'Branch where this guest note was taken (e.g. bacoor). Visible network-wide to authorized staff.';

create index if not exists customer_notes_branch_idx
  on public.customer_notes (branch_slug)
  where archived_at is null;

-- 2. Backfill branch_slug on existing customer_notes from staff_profiles where possible
update public.customer_notes cn
set branch_slug = sp.branch_slug
from public.staff_profiles sp
where cn.created_by = sp.id
  and cn.branch_slug is null
  and sp.branch_slug is not null;

-- 3. Replace staff_display_names to expose branch_slug and allow cross-branch staff attribution for notes
drop function if exists public.staff_display_names(uuid[]);

create or replace function public.staff_display_names(p_ids uuid[])
returns table(id uuid, full_name text, role text, branch_slug text)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select sp.id, sp.full_name, sp.role::text, sp.branch_slug
  from public.staff_profiles sp
  where auth.uid() is not null
    and sp.id = any(p_ids);
$function$;

revoke all on function public.staff_display_names(uuid[]) from public, anon;
grant execute on function public.staff_display_names(uuid[]) to authenticated;

comment on function public.staff_display_names(uuid[]) is
  'Returns public display names, roles, and branch for specific staff IDs (e.g. note authors, ticket TLs). Network-wide for authenticated staff.';

-- 4. Allow authenticated staff to select bookings across branches for customer history lookup
-- Writes (insert, update, delete) stay strictly guarded by can_manage_branch(branch)
drop policy if exists bookings_select on public.bookings;
create policy bookings_select on public.bookings
  for select to authenticated
  using (
    customer_id = (select auth.uid())
    or (select public.is_staff())
    or ((select public.current_user_role()) in ('detailer', 'marketing')
        and branch = any ((select public.accessible_branch_slugs())::text[]))
    or branch = any ((select public.manageable_branch_slugs())::text[])
    or public.staff_is_assigned_to_booking(id)
  );

commit;

