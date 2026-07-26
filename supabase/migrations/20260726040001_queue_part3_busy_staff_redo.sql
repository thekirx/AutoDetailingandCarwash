-- Part 3 follow-up: busy_staff includes redo (enum committed in prior migration)

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
  and qa.status = 'active'
  and b.status in ('waiting', 'in_progress', 'final_checking', 'redo')
  and coalesce(b.is_archived, false) = false;
