-- Shop TV kiosk board: plate + service catalog fields only (no phone / name / email).
-- Customer kiosk keeps using public_queue_counts (counts only).

create or replace view public.public_queue_floor
with (security_invoker = false)
as
select
  b.branch,
  b.queue_number,
  b.status,
  b.vehicle_plate,
  s.name as service_name,
  s.pay_category as service_pay_category
from public.bookings b
left join public.services s on s.id = b.service_id
where b.status in ('waiting', 'in_progress', 'final_checking')
  and coalesce(b.is_archived, false) = false
  and (
    lower(coalesce(s.pay_category, 'general')) = 'detailing'
    or b.status in ('in_progress', 'final_checking')
    or coalesce(b.queue_date, (timezone('Asia/Manila', b.created_at))::date)
      = (timezone('Asia/Manila', now()))::date
  );

comment on view public.public_queue_floor is
  'Shop TV kiosk: queue number, plate, service name/kind. No customer PII. Customer boards use public_queue_counts only.';

revoke all on public.public_queue_floor from public, anon, authenticated;
grant select on public.public_queue_floor to anon, authenticated;
