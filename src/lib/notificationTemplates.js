/**
 * System push + SMS catalog. Defaults live here; SA overrides persist in
 * notification_templates. Senders always fall back to these strings.
 */
import { renderNotificationMessage } from './notificationCopy.js'
import { smsCustomerName } from './queueStatusSms.js'
import { BIRTHDAY_GIFT_LABEL } from './birthdayPerk.js'
import { VISIT_REWARDS } from './rewardsCatalog.js'

export const TEMPLATE_CATEGORIES = [
  { id: 'booking_status', label: 'Service status', hint: 'Customer Push & BusyBee SMS (Detailing, Services & Packages status updates only)' },
  { id: 'ops_status', label: 'Ops status', hint: 'Staff Push & Inbox when a visit moves' },
  { id: 'birthday', label: 'Birthday', hint: 'Push & In-App Inbox greeting + free-service perk' },
  { id: 'lifecycle', label: 'Lifecycle', hint: 'Push & In-App Inbox welcome, loyalty & visit milestones' },
  { id: 'ops_forms', label: 'Ops forms', hint: 'Staff Push & Inbox complaint and form alerts' },
  { id: 'reminder', label: 'Reminders', hint: 'Push & In-App Inbox paint-maintenance copy' },
  { id: 'custom', label: 'Custom templates', hint: 'Push & In-App Inbox promotions and branch alerts' },
]

const BOOKING_TOKENS = ['name', 'plate', 'service', 'branch', 'when']
const NAME_TOKENS = ['name']
const APP_TOKENS = ['name', 'appUrl']

function row(partial) {
  return {
    channel: 'both',
    audience: 'customer',
    enabled: true,
    allow_multipart: false,
    tokens: BOOKING_TOKENS,
    description: '',
    title: '',
    body: '',
    sms_body: '',
    ...partial,
  }
}

const TRIGGER_META_BY_KEY = {
  'booking.pending.customer': { trigger_event: 'Booking submitted (/book or detailing form)', trigger_route: '/account', recipient_summary: 'Customer (Push, Inbox & BusyBee SMS — Detailing, Services & Packages)' },
  'booking.confirmed.customer': { trigger_event: 'Staff confirms booking', trigger_route: '/account', recipient_summary: 'Customer (Push, Inbox & BusyBee SMS — Detailing, Services & Packages)' },
  'booking.waiting.customer': { trigger_event: 'Car checked into bay queue', trigger_route: '/account/queue', recipient_summary: 'Customer (Push, Inbox & BusyBee SMS — Detailing, Services & Packages)' },
  'booking.in_progress.customer': { trigger_event: 'Detailing / wash started', trigger_route: '/account/queue', recipient_summary: 'Customer (Push, Inbox & BusyBee SMS — Detailing, Services & Packages)' },
  'booking.final_checking.customer': { trigger_event: 'Bay marks Final QC', trigger_route: '/account/queue', recipient_summary: 'Customer (Push, Inbox & BusyBee SMS — Detailing, Services & Packages)' },
  'booking.for_payment.customer': { trigger_event: 'Bay sends car to POS cashier', trigger_route: '/account/queue', recipient_summary: 'Customer (Push, Inbox & BusyBee SMS — Detailing, Services & Packages)' },
  'booking.completed.customer': { trigger_event: 'POS payment completed', trigger_route: '/account', recipient_summary: 'Customer (Push, Inbox & BusyBee SMS — Detailing, Services & Packages)' },
  'booking.cancelled.customer': { trigger_event: 'Booking cancelled', trigger_route: '/account', recipient_summary: 'Customer (Push, Inbox & BusyBee SMS — Detailing, Services & Packages)' },
  'booking.photos_ready.customer': { trigger_event: 'After-photos uploaded for booking', trigger_route: '/account', recipient_summary: 'Customer (Push, Inbox & BusyBee SMS — Detailing, Services & Packages)' },
  'birthday.greeting': { trigger_event: 'Daily 08:00 Manila birthday scan', trigger_route: '/account/vouchers', recipient_summary: 'Birthday customers (In-App Inbox & Web Push)' },
  'lifecycle.welcome_app': { trigger_event: 'First customer account signup', trigger_route: '/account', recipient_summary: 'New customer (In-App Inbox & Web Push)' },
  'lifecycle.loyalty_claim': { trigger_event: 'Loyalty reward redeemed at POS', trigger_route: '/account/vouchers', recipient_summary: 'Customer (In-App Inbox & Web Push)' },
  'lifecycle.rate_visit': { trigger_event: '15 mins after completed visit', trigger_route: '/account', recipient_summary: 'Customer (In-App Inbox & Web Push)' },
  'ops.crew_assigned': { trigger_event: 'Crew member assigned to queue car', trigger_route: '/operations/my-tasks', recipient_summary: 'Assigned Detailer / Staff / TL (In-App + Push)' },
  'ops.sheet_submitted': { trigger_event: 'Branch daily sheet submitted', trigger_route: '/operations/finance?tab=sheets', recipient_summary: 'BossMich & ASA Finance (In-App + Push)' },
  'ops.sheet_reviewed': { trigger_event: 'Owner approves or returns daily sheet', trigger_route: '/operations/pos?tab=sheet', recipient_summary: 'Submitting Branch Admin (In-App + Push)' },
  'ops.cash_advance_submitted': { trigger_event: 'Employee requests cash advance', trigger_route: '/operations/pos?tab=sheet', recipient_summary: 'Branch Admin (In-App + Push)' },
  'ops.cash_advance_approved': { trigger_event: 'Cash advance approved with code', trigger_route: '/operations/pos?tab=sheet', recipient_summary: 'Branch Admin (In-App + Push)' },
  'ops.attendance_location_alert': { trigger_event: 'Blocked GPS / tampered clock-in attempt', trigger_route: '/operations/attendance', recipient_summary: 'BossMich, ASA & Branch Admin (Push)' },
  'ops.booking_reschedule': { trigger_event: 'Customer requests booking reschedule', trigger_route: '/operations/bookings', recipient_summary: 'Admin, TL, Sales, ASA & BossMich (In-App + Push)' },
  'ops.complaint': { trigger_event: 'Customer complaint form submitted', trigger_route: '/operations/forms/results', recipient_summary: 'BossMich, ASA & Branch Admin (In-App + Push)' },
  'ops.review': { trigger_event: 'Customer visit feedback submitted', trigger_route: '/operations/forms/results', recipient_summary: 'BossMich, ASA, Ops Lead & Admin (In-App + Push)' },
  'reminder.paint_maintenance': { trigger_event: '6-month Ceramic/PPF maintenance schedule', trigger_route: '/book', recipient_summary: 'Detailing customers (In-App Inbox & Web Push)' },
}

export function templateTriggerMeta(sys) {
  if (!sys) return { trigger_event: 'System trigger', trigger_route: '/operations', recipient_summary: 'Targeted users' }
  if (TRIGGER_META_BY_KEY[sys.key]) return TRIGGER_META_BY_KEY[sys.key]
  if (sys.key?.startsWith('lifecycle.visit_reward_')) {
    return {
      trigger_event: 'Completed visit hits loyalty milestone',
      trigger_route: '/account/vouchers',
      recipient_summary: 'Customer (In-App Inbox & Web Push)',
    }
  }
  if (sys.audience === 'ops' || sys.key?.endsWith('.ops')) {
    const isPos = sys.key === 'booking.for_payment.ops'
    const isBookings = sys.key === 'booking.pending.ops' || sys.key === 'booking.confirmed.ops' || sys.key === 'booking.cancelled.ops'
    return {
      trigger_event: sys.description || 'Queue / booking update',
      trigger_route: isPos ? '/operations/pos' : isBookings ? '/operations/bookings' : '/operations/queue',
      recipient_summary: 'Branch ops crew & Super Admin (In-App + Push)',
    }
  }
  return {
    trigger_event: sys.description || 'Automated notification trigger',
    trigger_route: '/account',
    recipient_summary: sys.audience === 'ops' ? 'Operations staff' : 'Customers',
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
    body: 'We received your {service} request at {branch}. We will confirm shortly.',
    sms_body: 'Hakum: We got your {service} for {plate} at {branch}. We will confirm soon.',
    display_order: 10,
  }),
  row({
    key: 'booking.confirmed.customer',
    category: 'booking_status',
    label: 'Booking confirmed',
    description: 'Customer when the shop confirms the booking',
    kind: 'booking_confirm',
    title: 'Booking confirmed',
    body: 'Your {service} is confirmed at {branch}.',
    sms_body: 'Hakum: {service} CONFIRMED for {plate} at {branch}{when}. See you!',
    display_order: 20,
  }),
  row({
    key: 'booking.waiting.customer',
    category: 'booking_status',
    label: 'In the queue',
    description: 'Customer when the car is waiting. SMS rotates 20 lines unless this SMS text is edited.',
    kind: 'booking_status',
    title: 'In the queue',
    body: '{plate} is checked in for {service} at {branch}.',
    sms_body: 'Hakum: {plate} checked in for {service} at {branch}. You are in queue.',
    display_order: 30,
  }),
  row({
    key: 'booking.in_progress.customer',
    category: 'booking_status',
    label: 'Service in progress',
    description: 'Customer when service starts. SMS rotates 20 lines unless this SMS text is edited.',
    kind: 'booking_status',
    title: 'Service in progress',
    body: 'Our team is working on your {service} for {plate}.',
    sms_body: 'Hakum: Working on your {service} for {plate} now.',
    display_order: 40,
  }),
  row({
    key: 'booking.final_checking.customer',
    category: 'booking_status',
    label: 'Final checking',
    description: 'Customer on final check. SMS rotates 20 lines unless this SMS text is edited.',
    kind: 'booking_status',
    title: 'Final checking',
    body: '{plate} ({service}) is on final QC.',
    sms_body: 'Hakum: {plate} ({service}) is on final QC. Almost ready.',
    display_order: 50,
  }),
  row({
    key: 'booking.for_payment.customer',
    category: 'booking_status',
    label: 'Ready for payment',
    description: 'Customer ready to pay. SMS rotates 20 lines and adds the name when we have one, unless this SMS text is edited.',
    kind: 'booking_status',
    title: 'Ready for payment',
    body: 'Your {service} visit is ready for payment at the counter.',
    sms_body: 'Hakum: {plate} ({service}) is ready — please proceed to payment.',
    display_order: 60,
  }),
  row({
    key: 'booking.completed.customer',
    category: 'booking_status',
    label: 'Service complete',
    description: 'Customer when the visit is released. SMS rotates 20 lines unless this SMS text is edited.',
    kind: 'booking_status',
    title: 'Service complete',
    body: 'Your {service} is complete. Thank you!',
    sms_body: 'Hakum: {service} for {plate} is done. Thank you! Book: hakumautocare.com/book',
    display_order: 70,
  }),
  row({
    key: 'booking.cancelled.customer',
    category: 'booking_status',
    label: 'Booking cancelled',
    description: 'Customer when a booking is cancelled',
    kind: 'booking_status',
    title: 'Booking cancelled',
    body: 'Your {service} booking at {branch} was cancelled.',
    sms_body: 'Hakum: Your {service} at {branch} was cancelled. Rebook anytime.',
    display_order: 80,
  }),
  row({
    key: 'booking.photos_ready.customer',
    category: 'booking_status',
    label: 'Progress photos ready',
    description: 'Customer when progress photos are available',
    kind: 'booking_photos',
    title: 'Progress photos ready',
    body: 'Progress photos for {plate} ({service}) are ready in the app.',
    sms_body: 'Hakum: Photos for {plate} ({service}) are ready in the Hakum app.',
    display_order: 95,
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
    key: 'birthday.greeting',
    category: 'birthday',
    channel: 'push',
    label: 'Birthday greeting',
    description: `Push + Inbox on the customer birthday. Mentions the ${BIRTHDAY_GIFT_LABEL} perk.`,
    kind: 'birthday_greeting',
    tokens: ['name', 'code'],
    title: 'Happy birthday from Hakum',
    body: `Happy birthday {name}! Enjoy a ${BIRTHDAY_GIFT_LABEL} on us. Your code is {code}. Show it at any Hakum branch. It lasts 7 days.`,
    sms_body:
      `Hakum Auto Care: Happy birthday {name}! Your ${BIRTHDAY_GIFT_LABEL} is ready. Your birthday code is {code}. Show it at the branch. It lasts 7 days.`,
    display_order: 200,
  }),

  row({
    key: 'lifecycle.welcome_app',
    category: 'lifecycle',
    channel: 'push',
    label: 'Welcome / download app',
    description: 'First-account alert after signup (In-App + Push only)',
    kind: 'welcome_app',
    tokens: APP_TOKENS,
    title: 'Welcome to Hakum Auto Care',
    body: 'Track your vehicle queue live, book detailing visits, and earn loyalty rewards in your Hakum account.',
    sms_body:
      'Welcome to Hakum Auto Care! Thank you for joining us. Download our app at {appUrl} to book visits, track your car live, and earn loyalty rewards. Enjoy the full Hakum experience!',
    display_order: 210,
  }),
  row({
    key: 'lifecycle.loyalty_claim',
    category: 'lifecycle',
    channel: 'push',
    label: 'Loyalty claim thanks',
    description: 'In-App + Push thank-you after a loyalty reward is redeemed at POS',
    kind: 'loyalty_claim',
    tokens: NAME_TOKENS,
    title: 'Loyalty reward claimed',
    body: 'Thank you for claiming your loyalty reward! Your next reward progress is live in your account.',
    sms_body:
      'Hakum Auto Care: Thank you for claiming your loyalty reward! Keep those visits coming, your next treat is already on the way.',
    display_order: 220,
  }),
  ...VISIT_REWARDS.map((reward, index) => row({
    key: `lifecycle.visit_reward_${reward.visit}`,
    category: 'lifecycle',
    channel: 'push',
    label: `Visit ${reward.visit} reward`,
    description: `In-App + Push alert when completed visits reach ${reward.visit}, any car`,
    kind: `visit_reward_${reward.visit}`,
    tokens: NAME_TOKENS,
    title: `Visit ${reward.visit} reward unlocked`,
    body: `That's visit ${reward.visit}! Your reward is ready: ${reward.label}. Ask the branch on your next visit.`,
    sms_body: `Hakum Auto Care: That's visit ${reward.visit}. Your reward is ready: ${reward.label}. Ask the branch.`,
    display_order: 230 + index,
  })),
  row({
    key: 'lifecycle.rate_visit',
    category: 'lifecycle',
    channel: 'push',
    label: 'Rate your visit',
    description: 'In-App + Push feedback prompt after a completed wash or detailing visit',
    kind: 'rate_visit',
    tokens: [...NAME_TOKENS, 'appUrl'],
    title: 'How was your Hakum visit?',
    body: 'Open your Hakum account to rate your visit or share feedback with our team.',
    sms_body:
      'Hakum Auto Care: How was your visit? Open your account ({appUrl}/account) to rate it — thumbs up or tell us what went wrong.',
    display_order: 245,
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
    key: 'ops.crew_assigned',
    category: 'ops_status',
    audience: 'ops',
    channel: 'push',
    label: 'Ops · Crew assigned to car',
    description: 'Detailer / crew push when assigned to a bay ticket',
    kind: 'crew_assigned',
    tokens: ['plate', 'service', 'branch'],
    title: 'New car assigned',
    body: '{plate} · {service} @ {branch}',
    display_order: 185,
  }),
  row({
    key: 'ops.sheet_submitted',
    category: 'ops_forms',
    audience: 'ops',
    channel: 'push',
    label: 'Ops · Daily sheet submitted',
    description: 'SA & Finance ASA push when a branch submits the Daily Sheet',
    kind: 'sheet_submitted',
    tokens: ['name', 'branch', 'when'],
    title: 'Daily sheet to approve · {branch}',
    body: '{name} submitted {when}. Approve or return in Finance.',
    display_order: 252,
  }),
  row({
    key: 'ops.sheet_reviewed',
    category: 'ops_forms',
    audience: 'ops',
    channel: 'push',
    label: 'Ops · Daily sheet approved / returned',
    description: 'Branch Admin push when Owner reviews their Daily Sheet',
    kind: 'sheet_reviewed',
    tokens: ['branch', 'when'],
    title: 'Daily sheet reviewed · {branch}',
    body: '{when}: Daily sheet status updated — check POS sheet tab.',
    display_order: 254,
  }),
  row({
    key: 'ops.cash_advance_submitted',
    category: 'ops_forms',
    audience: 'ops',
    channel: 'push',
    label: 'Ops · Cash advance request',
    description: 'Branch Admin push when an employee submits a cash advance request',
    kind: 'cash_advance_submitted',
    tokens: ['name', 'branch'],
    title: 'Cash advance request',
    body: '{name} requested a cash advance @ {branch}.',
    display_order: 255,
  }),
  row({
    key: 'ops.cash_advance_approved',
    category: 'ops_forms',
    audience: 'ops',
    channel: 'push',
    label: 'Ops · Cash advance approved',
    description: 'Branch Admin push with release code when cash advance is approved',
    kind: 'cash_advance_approved',
    tokens: ['name', 'branch', 'code'],
    title: 'Cash advance approved',
    body: '{name} @ {branch} · Code {code}. Enter on Daily Sheet to release cash.',
    display_order: 256,
  }),
  row({
    key: 'ops.attendance_location_alert',
    category: 'ops_forms',
    audience: 'ops',
    channel: 'push',
    label: 'Ops · Tampered GPS clock-in alert',
    description: 'Security push when staff tries to clock in with spoofed/mock GPS',
    kind: 'attendance_location_alert',
    tokens: ['name', 'branch'],
    title: 'Time-in blocked · {branch}',
    body: '{name} tried to time in with a faked or tampered location. Review on Attendance.',
    display_order: 257,
  }),
  row({
    key: 'ops.booking_reschedule',
    category: 'ops_forms',
    audience: 'ops',
    channel: 'push',
    label: 'Ops · Customer reschedule request',
    description: 'Ops push when a customer asks to move their booking date',
    kind: 'booking_reschedule',
    tokens: ['name', 'plate'],
    title: 'Customer wants a new date',
    body: '{name} · {plate} asked to reschedule. Call them to confirm a new time.',
    display_order: 258,
  }),
  row({
    key: 'ops.review',
    category: 'ops_forms',
    audience: 'ops',
    channel: 'push',
    label: 'Ops · Customer visit review',
    description: 'Ops push when a customer submits a visit rating/review',
    kind: 'review',
    tokens: ['name', 'branch'],
    title: 'New customer review',
    body: '{name} @ {branch} submitted visit feedback.',
    display_order: 259,
  }),

  row({
    key: 'reminder.paint_maintenance',
    category: 'reminder',
    channel: 'push',
    label: 'Paint maintenance default',
    description: 'Default Push + Inbox copy for paint-maintenance reminder rules',
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

/** Overlay SA row onto the code default. Unknown keys are ignored unless marked is_custom or prefixed custom. */
export function mergeNotificationTemplates(dbRows = []) {
  const byKey = new Map((dbRows || []).map((row) => [row.key, row]))
  const systemMerged = SYSTEM_TEMPLATES.map((sys) => {
    const db = byKey.get(sys.key)
    const meta = templateTriggerMeta(sys)
    const defaults = {
      ...meta,
      default_title: sys.title,
      default_body: sys.body,
      default_sms_body: sys.sms_body,
      has_override: Boolean(db),
      allow_multipart: Boolean(db?.allow_multipart),
    }
    if (!db) return { ...sys, ...defaults }
    return {
      ...sys,
      ...defaults,
      title: db.title != null && String(db.title).trim() !== '' ? String(db.title) : sys.title,
      body: db.body != null && String(db.body).trim() !== '' ? String(db.body) : sys.body,
      sms_body: db.sms_body != null && String(db.sms_body).trim() !== '' ? String(db.sms_body) : sys.sms_body,
      enabled: db.enabled !== false,
      updated_at: db.updated_at || null,
    }
  })

  const customRows = (dbRows || [])
    .filter((r) => r && (r.is_custom === true || (typeof r.key === 'string' && r.key.startsWith('custom.'))))
    .map((db) => {
      const channel = 'push'
      return {
        key: db.key,
        category: db.category || 'custom',
        label: db.label || db.key.replace(/^custom\./, '').replace(/_/g, ' '),
        description: db.description || 'Custom shop notification template',
        channel,
        audience: db.audience || 'customer',
        tokens: BOOKING_TOKENS,
        title: db.title || '',
        body: db.body || '',
        sms_body: db.sms_body || '',
        enabled: db.enabled !== false,
        allow_multipart: Boolean(db.allow_multipart),
        is_custom: true,
        has_override: true,
        trigger_event: 'Custom trigger / broadcast',
        trigger_route: '/account',
        recipient_summary: db.audience === 'ops' ? 'Operations staff' : 'Targeted customers',
        updated_at: db.updated_at || null,
      }
    })

  return [...systemMerged, ...customRows]
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
  const serviceRaw = booking.service_name || booking.services?.name || 'service'
  const service =
    String(serviceRaw).length > 28 ? `${String(serviceRaw).slice(0, 25)}…` : String(serviceRaw)
  return {
    name: smsCustomerName(booking) || 'Customer',
    plate: booking.vehicle_plate || 'your vehicle',
    service,
    branch: booking.branch_name || booking.branch || 'Hakum',
    when,
  }
}
