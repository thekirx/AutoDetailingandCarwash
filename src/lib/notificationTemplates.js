/**
 * System push + SMS catalog. Defaults live here; SA overrides persist in
 * notification_templates. Senders always fall back to these strings.
 */
import { renderNotificationMessage } from './notificationCopy.js'

export const TEMPLATE_CATEGORIES = [
  { id: 'booking_status', label: 'Service status', hint: 'Customer texts when a visit moves' },
  { id: 'ops_status', label: 'Ops status', hint: 'Staff push when a visit moves' },
  { id: 'birthday', label: 'Birthday', hint: 'Greeting and free-service perk' },
  { id: 'lifecycle', label: 'Lifecycle', hint: 'Welcome, loyalty, visit milestones' },
  { id: 'ops_forms', label: 'Ops forms', hint: 'Complaint and form alerts' },
  { id: 'reminder', label: 'Reminders', hint: 'Default paint-maintenance copy' },
]

const BOOKING_TOKENS = ['name', 'plate', 'service', 'branch', 'when']
const NAME_TOKENS = ['name']
const APP_TOKENS = ['name', 'appUrl']

function row(partial) {
  return {
    channel: 'both',
    audience: 'customer',
    enabled: true,
    tokens: BOOKING_TOKENS,
    description: '',
    title: '',
    body: '',
    sms_body: '',
    ...partial,
  }
}

export const SYSTEM_TEMPLATES = [
  row({
    key: 'booking.pending.customer',
    category: 'booking_status',
    label: 'Booking received',
    description: 'Customer when a booking is submitted',
    kind: 'booking_received',
    title: 'Booking received',
    body: 'We received your request at {branch}. We will confirm shortly.',
    sms_body:
      'Hakum Auto Care: We received your booking for {plate} at {branch}. We will confirm soon.',
    display_order: 10,
  }),
  row({
    key: 'booking.confirmed.customer',
    category: 'booking_status',
    label: 'Booking confirmed',
    description: 'Customer when the shop confirms the booking',
    kind: 'booking_confirm',
    title: 'Booking confirmed',
    body: 'You are confirmed at {branch}.',
    sms_body: 'Hakum Auto Care: Your booking is CONFIRMED ({branch}{when}). See you soon!',
    display_order: 20,
  }),
  row({
    key: 'booking.waiting.customer',
    category: 'booking_status',
    label: 'In the queue',
    description: 'Customer when the car is waiting on the floor',
    kind: 'booking_status',
    title: 'In the queue',
    body: 'Waiting at {branch}.',
    sms_body: 'Hakum Auto Care: {plate} is waiting in the {branch} queue.',
    display_order: 30,
  }),
  row({
    key: 'booking.in_progress.customer',
    category: 'booking_status',
    label: 'Service in progress',
    description: 'Customer when detailing starts',
    kind: 'booking_status',
    title: 'Service in progress',
    body: '{plate} is being detailed.',
    sms_body: "Hakum Auto Care: We're working on {plate} now.",
    display_order: 40,
  }),
  row({
    key: 'booking.final_checking.customer',
    category: 'booking_status',
    label: 'Final checking',
    description: 'Customer when the car is on final check',
    kind: 'booking_status',
    title: 'Final checking',
    body: '{plate} is on final checking.',
    sms_body: 'Hakum Auto Care: {plate} is on final checking.',
    display_order: 50,
  }),
  row({
    key: 'booking.for_payment.customer',
    category: 'booking_status',
    label: 'Ready for payment',
    description: 'Customer when the visit is ready at POS',
    kind: 'booking_status',
    title: 'Ready for payment',
    body: 'Your visit is ready for payment at the counter.',
    sms_body: 'Hakum Auto Care: {plate} is ready. Please proceed to payment.',
    display_order: 60,
  }),
  row({
    key: 'booking.completed.customer',
    category: 'booking_status',
    label: 'Service complete',
    description: 'Customer when the visit is released',
    kind: 'booking_status',
    title: 'Service complete',
    body: 'Your service is complete. Thank you!',
    sms_body: 'Hakum Auto Care: {plate} is done. Thank you for choosing Hakum!',
    display_order: 70,
  }),
  row({
    key: 'booking.cancelled.customer',
    category: 'booking_status',
    label: 'Booking cancelled',
    description: 'Customer when a booking is cancelled',
    kind: 'booking_status',
    title: 'Booking cancelled',
    body: 'Booking at {branch} was cancelled.',
    sms_body: 'Hakum Auto Care: Your booking at {branch} was cancelled. Message us if you need to rebook.',
    display_order: 80,
  }),
  row({
    key: 'booking.redo.customer',
    category: 'booking_status',
    label: 'Redo in progress',
    description: 'Customer when a job is sent back for redo',
    kind: 'booking_status',
    title: 'We are sorry — redoing your service',
    body: 'We are sorry. {plate} is back on the floor for a redo at {branch}.',
    sms_body: 'Hakum Auto Care: We are sorry. We are redoing {plate} at {branch}. We will update you shortly.',
    display_order: 90,
  }),

  row({
    key: 'booking.pending.ops',
    category: 'ops_status',
    audience: 'ops',
    channel: 'push',
    label: 'Ops · New booking',
    description: 'Staff when a booking lands',
    kind: 'ops_booking_received',
    title: 'New booking',
    body: '{name} · {plate} @ {branch}',
    display_order: 110,
  }),
  row({
    key: 'booking.confirmed.ops',
    category: 'ops_status',
    audience: 'ops',
    channel: 'push',
    label: 'Ops · Booking confirmed',
    kind: 'ops_booking_confirm',
    title: 'Booking confirmed',
    body: '{plate} confirmed @ {branch}',
    display_order: 120,
  }),
  row({
    key: 'booking.waiting.ops',
    category: 'ops_status',
    audience: 'ops',
    channel: 'push',
    label: 'Ops · New queue ticket',
    kind: 'ops_booking_status',
    title: 'New queue ticket',
    body: '{plate} waiting @ {branch}',
    display_order: 130,
  }),
  row({
    key: 'booking.in_progress.ops',
    category: 'ops_status',
    audience: 'ops',
    channel: 'push',
    label: 'Ops · In progress',
    kind: 'ops_booking_status',
    title: 'In progress',
    body: '{plate} in progress @ {branch}',
    display_order: 140,
  }),
  row({
    key: 'booking.final_checking.ops',
    category: 'ops_status',
    audience: 'ops',
    channel: 'push',
    label: 'Ops · Final checking',
    kind: 'ops_booking_status',
    title: 'Final checking',
    body: '{plate} final check @ {branch}',
    display_order: 150,
  }),
  row({
    key: 'booking.for_payment.ops',
    category: 'ops_status',
    audience: 'ops',
    channel: 'push',
    label: 'Ops · Ready for payment',
    kind: 'ops_booking_status',
    title: 'Ready for payment',
    body: '{plate} → POS @ {branch}',
    display_order: 160,
  }),
  row({
    key: 'booking.completed.ops',
    category: 'ops_status',
    audience: 'ops',
    channel: 'push',
    label: 'Ops · Visit completed',
    kind: 'ops_booking_status',
    title: 'Visit completed',
    body: '{plate} completed @ {branch}',
    display_order: 170,
  }),
  row({
    key: 'booking.cancelled.ops',
    category: 'ops_status',
    audience: 'ops',
    channel: 'push',
    label: 'Ops · Booking cancelled',
    kind: 'ops_booking_status',
    title: 'Booking cancelled',
    body: '{plate} cancelled @ {branch}',
    display_order: 180,
  }),
  row({
    key: 'booking.redo.ops',
    category: 'ops_status',
    audience: 'ops',
    channel: 'push',
    label: 'Ops · Redo',
    kind: 'ops_booking_status',
    title: 'Redo on floor',
    body: '{plate} redo @ {branch}',
    display_order: 190,
  }),

  row({
    key: 'birthday.greeting',
    category: 'birthday',
    label: 'Birthday greeting',
    description: 'Push + SMS on the customer birthday. Mentions the free service perk.',
    kind: 'birthday_greeting',
    tokens: NAME_TOKENS,
    title: 'Happy birthday from Hakum',
    body: 'Happy birthday {name}! Enjoy a free service on us this year. Show this at any Hakum branch.',
    sms_body:
      'Hakum Auto Care: Happy birthday {name}! Your free birthday service is ready. Visit any branch to claim it.',
    display_order: 200,
  }),

  row({
    key: 'lifecycle.welcome_app',
    category: 'lifecycle',
    channel: 'sms',
    label: 'Welcome / download app',
    description: 'First-account SMS after signup',
    kind: 'welcome_app',
    tokens: APP_TOKENS,
    sms_body:
      'Welcome to Hakum Auto Care! Thank you for joining us. Download our app at {appUrl} to book visits, track your car live, and earn loyalty rewards. Enjoy the full Hakum experience!',
    display_order: 210,
  }),
  row({
    key: 'lifecycle.loyalty_claim',
    category: 'lifecycle',
    channel: 'sms',
    label: 'Loyalty claim thanks',
    description: 'SMS after a loyalty free line is redeemed at POS',
    kind: 'loyalty_claim',
    tokens: NAME_TOKENS,
    sms_body:
      'Hakum Auto Care: Thank you for claiming your loyalty reward! Keep those visits coming, your next treat is already on the way.',
    display_order: 220,
  }),
  row({
    key: 'lifecycle.visit_milestone_4',
    category: 'lifecycle',
    channel: 'sms',
    label: '4th visit milestone',
    description: 'SMS on the 4th completed visit of each 10-visit cycle',
    kind: 'visit_milestone_4',
    tokens: NAME_TOKENS,
    sms_body:
      "Hakum Auto Care: That's your 4th completed visit! You're only 2 visits away from a free car freshener or coffee on us.",
    display_order: 230,
  }),
  row({
    key: 'lifecycle.visit_milestone_10',
    category: 'lifecycle',
    channel: 'sms',
    label: '10th visit milestone',
    description: 'SMS on the 10th completed visit of each cycle',
    kind: 'visit_milestone_10',
    tokens: NAME_TOKENS,
    sms_body:
      'Hakum Auto Care: 10 visits, amazing! Your loyalty card is back to zero. Claim your free premium wax on your next visit. Thank you!',
    display_order: 240,
  }),

  row({
    key: 'ops.complaint',
    category: 'ops_forms',
    audience: 'ops',
    channel: 'push',
    label: 'New complaint',
    description: 'Staff when a customer complaint form is submitted',
    kind: 'ops_complaint',
    tokens: ['name', 'branch'],
    title: 'New complaint',
    body: '{name} @ {branch}',
    display_order: 250,
  }),

  row({
    key: 'reminder.paint_maintenance',
    category: 'reminder',
    label: 'Paint maintenance default',
    description: 'Default copy for new paint-maintenance reminder rules',
    kind: 'paint_maintenance',
    title: 'Hakum Auto Care: Time for paint maintenance',
    body: 'Hi {name}, {plate} is due for paint maintenance. Book your next visit at hakumautocare.com/book.',
    sms_body: 'Hi {name}, {plate} is due for paint maintenance. Book your next visit at hakumautocare.com/book.',
    display_order: 260,
  }),
]

export const SYSTEM_TEMPLATE_KEYS = SYSTEM_TEMPLATES.map((t) => t.key)

export function templateByKey(key) {
  return SYSTEM_TEMPLATES.find((t) => t.key === key) || null
}

export function bookingTemplateKey(status, audience = 'customer') {
  return `booking.${status}.${audience}`
}

/** Overlay SA row onto the code default. Unknown keys are ignored. */
export function mergeNotificationTemplates(dbRows = []) {
  const byKey = new Map((dbRows || []).map((row) => [row.key, row]))
  return SYSTEM_TEMPLATES.map((sys) => {
    const db = byKey.get(sys.key)
    if (!db) return { ...sys }
    return {
      ...sys,
      title: db.title != null && String(db.title).trim() !== '' ? String(db.title) : sys.title,
      body: db.body != null && String(db.body).trim() !== '' ? String(db.body) : sys.body,
      sms_body: db.sms_body != null && String(db.sms_body).trim() !== '' ? String(db.sms_body) : sys.sms_body,
      enabled: db.enabled !== false,
      updated_at: db.updated_at || null,
    }
  })
}

export function templatesByKeyMap(merged = SYSTEM_TEMPLATES) {
  return Object.fromEntries((merged || []).map((row) => [row.key, row]))
}

export function applyTemplateText(text, vars = {}, fallback = '') {
  const raw = String(text || '').trim()
  if (!raw) return fallback
  return renderNotificationMessage(raw, vars)
}

export function bookingNotifyVars(booking = {}) {
  const whenRaw = booking.scheduled_start
  let when = ''
  if (whenRaw) {
    try {
      when = `, ${new Date(whenRaw).toLocaleString('en-PH')}`
    } catch {
      when = ''
    }
  }
  return {
    name: booking.customer_name || 'Customer',
    plate: booking.vehicle_plate || 'your vehicle',
    service: booking.service_name || booking.services?.name || 'detailing',
    branch: booking.branch || 'Hakum',
    when,
  }
}
