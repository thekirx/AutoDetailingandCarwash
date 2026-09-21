-- Shop TV: car + crew + payment/release lanes. Still no customer PII (no name/phone/email).
-- Wash QC (final_checking) and detailing for_releasing stay customer-visible on the 3-lane TV board.

drop view if exists public.public_queue_floor;

create view public.public_queue_floor
with (security_invoker = false)
as
select
  b.id as booking_id,
  b.visit_group_id,
  b.branch,
  b.queue_number,
  b.status,
  b.vehicle_plate,
  b.vehicle_make,
  b.vehicle_model,
  b.vehicle_type,
  s.name as service_name,
  s.pay_category as service_pay_category,
  (
    select coalesce(string_agg(distinct trim(sp.full_name), ', ' order by trim(sp.full_name)), '')
    from public.queue_assignments qa
    join public.staff_profiles sp on sp.id = qa.staff_id
    where qa.booking_id = b.id
      and qa.status = 'active'
      and coalesce(trim(sp.full_name), '') <> ''
  ) as crew_names
from public.bookings b
left join public.services s on s.id = b.service_id
where b.status in ('waiting', 'in_progress', 'final_checking', 'for_payment', 'for_releasing')
  and coalesce(b.is_archived, false) = false;

comment on view public.public_queue_floor is
  'Shop TV: plate, vehicle, service kind, crew names. No customer PII. Poll this view — do not subscribe to bookings WAL.';

revoke all on public.public_queue_floor from public, anon, authenticated;
grant select on public.public_queue_floor to anon, authenticated;
