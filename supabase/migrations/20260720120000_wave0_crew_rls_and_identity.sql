-- Wave 0: Team Lead / BossMich can manage branch staff; attendance marked_by may be staff_profiles.id
begin;

drop policy if exists "Admins can insert staff profiles" on public.staff_profiles;
drop policy if exists "Admins can update staff profiles" on public.staff_profiles;
drop policy if exists "Queue managers can manage branch staff" on public.staff_profiles;

create policy "Queue managers can insert branch staff"
on public.staff_profiles for insert to authenticated
with check (
  (select public.is_admin())
  or (
    (select public.is_team_lead())
    and branch_slug = (select public.current_user_branch())
    and role = 'staff'
  )
);

create policy "Queue managers can update branch staff"
on public.staff_profiles for update to authenticated
using (
  (select public.is_admin())
  or (
    (select public.is_team_lead())
    and branch_slug = (select public.current_user_branch())
  )
)
with check (
  (select public.is_admin())
  or (
    (select public.is_team_lead())
    and branch_slug = (select public.current_user_branch())
    and role = 'staff'
  )
);

commit;
