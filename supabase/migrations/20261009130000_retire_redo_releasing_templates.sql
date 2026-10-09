-- Failed QA / redo is internal (no customer or ops notice) and For releasing is
-- retired (Final checking hands straight to For payment). Drop their templates so
-- the Notifications page does not offer dead copy.
delete from public.notification_templates
where key in (
  'booking.redo.customer',
  'booking.redo.ops',
  'booking.for_releasing.customer',
  'booking.for_releasing.ops'
);
