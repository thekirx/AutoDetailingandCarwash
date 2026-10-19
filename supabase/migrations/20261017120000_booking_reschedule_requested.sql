-- Customer asked to move a detailing visit. No new date until staff call and set scheduled_start.
alter table public.bookings
  add column if not exists reschedule_requested_at timestamptz;

comment on column public.bookings.reschedule_requested_at is
  'Set when the customer asks to reschedule, before in progress. Cleared when staff save a new final schedule.';
