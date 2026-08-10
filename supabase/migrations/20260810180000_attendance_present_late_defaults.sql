-- Attendance: present OR late are assignable; default register roles = clock roles.

begin;

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
  and sa.attendance_date = (timezone('Asia/Manila', now()))::date
  and sa.status in ('present', 'late')
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

insert into public.app_settings (key, value, updated_at)
values (
  'attendance_roles',
  '{"roles":["staff","team_lead","admin"]}'::jsonb,
  now()
)
on conflict (key) do nothing;

notify pgrst, 'reload schema';

commit;
