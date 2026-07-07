-- Staff pool and daily attendance for queue deployment.

begin;

alter type public.profile_role add value if not exists 'BossMich';

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select sp.role::text
      from public.staff_profiles sp
      where sp.id = (select auth.uid())
        and coalesce(sp.is_active, true) = true
      limit 1
    ),
    (
      select c.role::text
      from public.customers c
      where c.id = (select auth.uid())
        and coalesce(c.is_archived, false) = false
      limit 1
    ),
    'anon'
  );
$$;

create or replace function public.current_user_branch_slug()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select sp.branch_slug
  from public.staff_profiles sp
  where sp.id = (select auth.uid())
    and coalesce(sp.is_active, true) = true
  limit 1;
$$;

create or replace function public.can_view_queue_branch(input_branch text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.current_user_role() in ('admin', 'BossMich') then true
    when public.current_user_role() = 'team_lead' then public.current_user_branch_slug() = input_branch
    else false
  end;
$$;

create or replace function public.can_edit_queue_branch(input_branch text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.current_user_role() = 'BossMich' then true
    when public.current_user_role() = 'team_lead' then public.current_user_branch_slug() = input_branch
    else false
  end;
$$;

revoke all on function public.current_user_role() from public;
revoke all on function public.current_user_branch_slug() from public;
revoke all on function public.can_view_queue_branch(text) from public;
revoke all on function public.can_edit_queue_branch(text) from public;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_branch_slug() to authenticated;
grant execute on function public.can_view_queue_branch(text) to authenticated;
grant execute on function public.can_edit_queue_branch(text) to authenticated;

alter table public.staff_profiles
alter column id set default gen_random_uuid();

alter table public.staff_profiles
drop constraint if exists staff_profiles_id_fkey;

alter table public.staff_profiles
add column if not exists is_archived boolean not null default false;

drop policy if exists "Queue editors can manage branch staff profiles" on public.staff_profiles;
create policy "Queue editors can manage branch staff profiles"
on public.staff_profiles for all to authenticated
using (
  public.current_user_role() = 'BossMich'
  or (
    public.current_user_role() = 'team_lead'
    and branch_slug = public.current_user_branch_slug()
  )
)
with check (
  public.current_user_role() = 'BossMich'
  or (
    public.current_user_role() = 'team_lead'
    and branch_slug = public.current_user_branch_slug()
    and role = 'staff'
  )
);

alter table public.queue_assignments
drop constraint if exists queue_assignments_staff_id_fkey;

alter table public.queue_assignments
add constraint queue_assignments_staff_id_fkey
foreign key (staff_id) references public.staff_profiles(id) on delete set null;

create table if not exists public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  branch_slug text not null references public.branches(slug),
  attendance_date date not null default current_date,
  status text not null default 'present'
    check (status in ('present', 'absent')),
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  marked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, attendance_date)
);

drop trigger if exists staff_attendance_set_updated_at on public.staff_attendance;
create trigger staff_attendance_set_updated_at
before update on public.staff_attendance
for each row execute function public.set_updated_at();

alter table public.staff_attendance enable row level security;

drop policy if exists "Queue viewers can select staff attendance" on public.staff_attendance;
create policy "Queue viewers can select staff attendance"
on public.staff_attendance for select to authenticated
using (public.can_view_queue_branch(branch_slug));

drop policy if exists "Queue editors can manage staff attendance" on public.staff_attendance;
create policy "Queue editors can manage staff attendance"
on public.staff_attendance for all to authenticated
using (public.can_edit_queue_branch(branch_slug))
with check (public.can_edit_queue_branch(branch_slug));

grant select, insert, update on public.staff_attendance to authenticated;
revoke delete on public.staff_attendance from authenticated;

create or replace view public.busy_staff_view
with (security_invoker = true)
as
select distinct
  sp.id as staff_id,
  sp.full_name,
  sp.role,
  sp.branch_slug,
  qa.booking_id,
  b.queue_number,
  b.status as booking_status,
  qa.status as assignment_status,
  qa.created_at as assigned_at
from public.staff_profiles sp
join public.queue_assignments qa on qa.staff_id = sp.id
join public.bookings b on b.id = qa.booking_id
where sp.role = 'staff'
  and coalesce(sp.is_active, true) = true
  and coalesce(sp.is_archived, false) = false
  and qa.status = 'active'
  and b.status in ('waiting', 'in_progress', 'final_checking')
  and coalesce(b.is_archived, false) = false;

create or replace view public.available_staff_view
with (security_invoker = true)
as
select
  sp.id as staff_id,
  sp.full_name,
  sp.role,
  sp.branch_slug,
  sp.phone
from public.staff_profiles sp
join public.staff_attendance sa
  on sa.staff_id = sp.id
  and sa.attendance_date = current_date
  and sa.status = 'present'
where sp.role = 'staff'
  and coalesce(sp.is_active, true) = true
  and coalesce(sp.is_archived, false) = false
  and not exists (
    select 1
    from public.queue_assignments qa
    join public.bookings b on b.id = qa.booking_id
    where qa.staff_id = sp.id
      and qa.status = 'active'
      and b.status in ('waiting', 'in_progress', 'final_checking')
      and coalesce(b.is_archived, false) = false
  );

grant select on public.available_staff_view to authenticated;
grant select on public.busy_staff_view to authenticated;

notify pgrst, 'reload schema';

commit;
