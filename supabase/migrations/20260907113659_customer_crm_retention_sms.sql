-- CRM retention broadcast kinds + service-aware booking SMS defaults (outbound only).
-- SenderId HAKUM already approved; this is destination copy + CRM win-back catalog.

begin;

-- Polish + expand retention kinds (idempotent upsert by slug)
insert into public.notification_broadcast_kinds
  (slug, label, description, default_title, default_body, display_order, is_active)
values
  (
    'promo',
    'Promo',
    'Limited offers and seasonal deals',
    'Hakum: Special for you',
    'Hi {name}, enjoy a limited Hakum offer this week. Book: hakumautocare.com/book',
    10,
    true
  ),
  (
    'we_missed',
    'We missed you',
    'Win-back for quiet customers (30+ days)',
    'Hakum misses you',
    'Hi {name}, we miss caring for {plate}. Your shine is waiting — book: hakumautocare.com/book',
    20,
    true
  ),
  (
    'aftercare',
    'Aftercare check-in',
    '3–7 days after detailing / coating',
    'How is the shine?',
    'Hi {name}, how is {plate} looking after your last visit? Need a touch-up? hakumautocare.com/book',
    25,
    true
  ),
  (
    'package_nudge',
    'Package upsell',
    'Wash regulars → Express / Full Care packages',
    'Hakum packages',
    'Hi {name}, save time with a Hakum package for {plate}. See options: hakumautocare.com/book',
    28,
    true
  ),
  (
    'loyalty_nudge',
    'Loyalty nudge',
    'Close to free freshener / wax reward',
    'Almost there',
    'Hi {name}, you are close to a Hakum loyalty treat. One more visit: hakumautocare.com/book',
    32,
    true
  ),
  (
    'thank_you',
    'Thank you',
    'Same-day appreciation after completed visit',
    'Thank you',
    'Hi {name}, thank you for trusting Hakum with {plate}. See you on the next shine.',
    35,
    true
  ),
  (
    'reminder',
    'Service due',
    'Paint maintenance / ceramic refresh due',
    'Service due',
    'Hi {name}, {plate} may be due for care. Protect your finish: hakumautocare.com/book',
    40,
    true
  ),
  (
    'custom',
    'Custom',
    'Free-form broadcast',
    null,
    null,
    50,
    true
  )
on conflict (slug) do update set
  label = excluded.label,
  description = excluded.description,
  default_title = excluded.default_title,
  default_body = excluded.default_body,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  updated_at = now();

-- Refresh system booking SMS defaults when SA has not customized (empty overrides stay empty).
-- Only upsert keys we own; do not wipe custom SA titles.
insert into public.notification_templates (key, title, body, sms_body, enabled)
values
  (
    'booking.pending.customer',
    'Booking received',
    'We received your {service} request at {branch}. We will confirm shortly.',
    'Hakum: We got your {service} for {plate} at {branch}. We will confirm soon.',
    true
  ),
  (
    'booking.confirmed.customer',
    'Booking confirmed',
    'Your {service} is confirmed at {branch}.',
    'Hakum: {service} CONFIRMED for {plate} at {branch}{when}. See you!',
    true
  ),
  (
    'booking.waiting.customer',
    'In the queue',
    '{plate} is checked in for {service} at {branch}.',
    'Hakum: {plate} checked in for {service} at {branch}. You are in queue.',
    true
  ),
  (
    'booking.in_progress.customer',
    'Service in progress',
    'Our team is working on your {service} for {plate}.',
    'Hakum: Working on your {service} for {plate} now.',
    true
  ),
  (
    'booking.final_checking.customer',
    'Final checking',
    '{plate} ({service}) is on final QC.',
    'Hakum: {plate} ({service}) is on final QC. Almost ready.',
    true
  ),
  (
    'booking.for_releasing.customer',
    'Ready for release',
    '{plate} ({service}) is ready for release at {branch}.',
    'Hakum: {plate} ({service}) is ready for release at {branch}.',
    true
  ),
  (
    'booking.for_payment.customer',
    'Ready for payment',
    'Your {service} visit is ready for payment at the counter.',
    'Hakum: {plate} ({service}) is ready — please proceed to payment.',
    true
  ),
  (
    'booking.completed.customer',
    'Service complete',
    'Your {service} is complete. Thank you!',
    'Hakum: {service} for {plate} is done. Thank you! Book: hakumautocare.com/book',
    true
  ),
  (
    'booking.cancelled.customer',
    'Booking cancelled',
    'Your {service} booking at {branch} was cancelled.',
    'Hakum: Your {service} at {branch} was cancelled. Rebook anytime.',
    true
  ),
  (
    'booking.redo.customer',
    'Redo in progress',
    'We are sorry. We are redoing {service} on {plate} at {branch}.',
    'Hakum: Sorry — redoing {service} on {plate} at {branch}. We will update you.',
    true
  ),
  (
    'booking.photos_ready.customer',
    'Progress photos ready',
    'Progress photos for {plate} ({service}) are ready in the app.',
    'Hakum: Photos for {plate} ({service}) are ready in the Hakum app.',
    true
  )
on conflict (key) do update set
  title = excluded.title,
  body = excluded.body,
  sms_body = excluded.sms_body,
  enabled = true,
  updated_at = now();

commit;
