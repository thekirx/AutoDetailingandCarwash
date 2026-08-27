-- QA fix: restore lane timestamps on operations_queue_board (FIFO + dwell + SLA).
-- Phase 7 recreate dropped waiting_at / for_payment_at / completed_at / cancelled_at.

drop view if exists public.operations_queue_board;

create view public.operations_queue_board
with (security_invoker = true)
as
select
  b.id as booking_id,
  b.branch,
  b.queue_number,
  b.queue_date,
  b.status,
  b.customer_id,
  b.vehicle_id,
  b.customer_name,
  b.customer_phone,
  b.customer_email,
  b.vehicle_plate,
  b.vehicle_make,
  b.vehicle_model,
  b.vehicle_year,
  b.vehicle_type,
  b.service_id,
  s.name as service_name,
  s.price_minor as base_price_minor,
  b.final_price_minor,
  b.assigned_staff_id,
  sp.full_name as assigned_staff_name,
  b.scheduled_start,
  b.scheduled_end,
  b.estimated_start,
  b.estimated_end,
  b.actual_start,
  b.actual_end,
  b.created_at,
  b.notes,
  b.visit_group_id,
  b.waiting_at,
  b.in_progress_at,
  b.final_checking_at,
  b.for_payment_at,
  b.completed_at,
  b.cancelled_at,
  b.redo_at,
  b.redo_reason,
  s.pay_category as service_pay_category,
  s.duration_minutes as service_duration_minutes,
  s.sla_minutes as service_sla_minutes
from public.bookings b
left join public.services s on s.id = b.service_id
left join public.staff_profiles sp on sp.id = b.assigned_staff_id
where coalesce(b.is_archived, false) = false;

grant select on public.operations_queue_board to authenticated;
