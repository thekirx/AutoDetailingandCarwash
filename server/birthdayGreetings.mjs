/**
 * Grant the yearly birthday free-service perk and send greeting push + SMS.
 * Idempotent per customer/year via customer_birthday_perks unique key.
 */
import { createClient } from '@supabase/supabase-js'
import { BIRTHDAY_GIFT_LABEL, birthdayPerkExpiresAt, birthdayQueryDays, isBirthdayToday, mintBirthdayCode } from '../src/lib/birthdayPerk.js'
import { CUSTOMER_VOUCHERS_PATH } from '../src/lib/customerAccountNav.js'
import { applyTemplateText } from '../src/lib/notificationTemplates.js'
import { busybeeSendSms } from './busybee.mjs'
import { isSmsNotificationsEnabled } from './notifyBooking.mjs'
import { loadTemplateMap, templateEnabled } from './notificationTemplatesDb.mjs'
import { sendWebPushToUsers } from './webPush.mjs'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function writeInbox(db, userId, payload) {
  if (!userId) return { inserted: 0 }
  const { error } = await db.from('user_notifications').insert({
    user_id: userId,
    kind: payload.kind,
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag,
  })
  return error ? { error: error.message } : { inserted: 1 }
}

async function logSmsEvent(db, { phone, message, eventType, customerId, bookingId, status, providerResponse }) {
  await db.from('sms_events').insert({
    phone,
    message,
    event_type: eventType,
    customer_id: customerId || null,
    booking_id: bookingId || null,
    provider: 'busybee',
    status,
    provider_response: providerResponse || null,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
  })
}

const PERK_COLS = 'id, customer_id, perk_year, status, expires_at, greeting_sent_at, claimed_at, code'

async function attachBirthdayCode(db, row) {
  if (!row || row.code) return row
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = mintBirthdayCode()
    const { data, error } = await db
      .from('customer_birthday_perks')
      .update({ code })
      .eq('id', row.id)
      .is('code', null)
      .select(PERK_COLS)
      .maybeSingle()
    if (!error && data?.code) return data
    if (error?.code === '23505') continue
    if (error) throw new Error(error.message)
    const again = await db.from('customer_birthday_perks').select(PERK_COLS).eq('id', row.id).maybeSingle()
    if (again.data?.code) return again.data
  }
  throw new Error('Could not mint a birthday code.')
}

export async function listBirthdayCustomers(db, today = new Date()) {
  const { year, days } = birthdayQueryDays(today)
  const seen = new Map()
  for (const { month, day } of days) {
    const { data, error } = await db.rpc('list_birthday_customers', {
      p_month: month,
      p_day: day,
    })
    if (error) throw new Error(error.message)
    for (const row of data || []) seen.set(row.id, row)
  }
  return { year, customers: [...seen.values()] }
}

export async function ensureBirthdayPerk(db, customer, { year, now = new Date() } = {}) {
  const { year: y } = birthdayQueryDays(now)
  const perkYear = year || y
  const existing = await db
    .from('customer_birthday_perks')
    .select(PERK_COLS)
    .eq('customer_id', customer.id)
    .eq('perk_year', perkYear)
    .maybeSingle()
  if (existing.error) throw new Error(existing.error.message)
  if (existing.data) return attachBirthdayCode(db, existing.data)

  const expires = birthdayPerkExpiresAt(now).toISOString()
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = mintBirthdayCode()
    const { data, error } = await db
      .from('customer_birthday_perks')
      .insert({
        customer_id: customer.id,
        perk_year: perkYear,
        status: 'available',
        expires_at: expires,
        code,
      })
      .select(PERK_COLS)
      .maybeSingle()
    if (!error && data) return data
    if (error?.code === '23505') {
      const again = await db
        .from('customer_birthday_perks')
        .select(PERK_COLS)
        .eq('customer_id', customer.id)
        .eq('perk_year', perkYear)
        .maybeSingle()
      if (again.data) return attachBirthdayCode(db, again.data)
      continue
    }
    if (error) throw new Error(error.message)
  }
  throw new Error('Could not mint a birthday code.')
}

export async function sendBirthdayGreeting(db, customer, perk, templates = {}) {
  const tpl = templates['birthday.greeting']
  if (tpl && tpl.enabled === false) return { skipped: true, reason: 'disabled' }
  if (perk?.greeting_sent_at) return { skipped: true, reason: 'already_sent' }

  const code = String(perk?.code || '').trim()
  const vars = { name: customer.full_name || 'there', code }
  const title = applyTemplateText(tpl?.title, vars, 'Happy birthday from Hakum')
  let body = applyTemplateText(
    tpl?.body,
    vars,
    `Happy birthday ${vars.name}! Enjoy a ${BIRTHDAY_GIFT_LABEL} on us. Your code is ${code}. Show it at any Hakum branch. It lasts 7 days.`,
  )
  let sms = applyTemplateText(
    tpl?.sms_body,
    vars,
    `Hakum Auto Care: Happy birthday ${vars.name}! Your ${BIRTHDAY_GIFT_LABEL} is ready. Your birthday code is ${code}. Show it at the branch. It lasts 7 days.`,
  )
  if (code && !body.includes(code)) body = `${body} Code ${code}. Valid 7 days.`
  if (code && !sms.includes(code)) sms = `${sms} Code ${code}. Valid 7 days.`

  const inbox = await writeInbox(db, customer.id, {
    kind: 'birthday_greeting',
    title,
    body,
    url: CUSTOMER_VOUCHERS_PATH,
    tag: `birthday-${customer.id}-${perk?.perk_year || new Date().getFullYear()}`,
  })

  let push = null
  try {
    push = await sendWebPushToUsers({
      userIds: [customer.id],
      title,
      body,
      url: CUSTOMER_VOUCHERS_PATH,
      tag: `birthday-${customer.id}`,
      kind: 'birthday_greeting',
    })
  } catch (err) {
    push = { error: String(err.message || err) }
  }

  let smsResult = null
  const phone = String(customer.phone || '').trim()
  if (phone && (await isSmsNotificationsEnabled(db))) {
    smsResult = await busybeeSendSms({ phone, message: sms })
    await logSmsEvent(db, {
      phone,
      message: sms,
      eventType: 'birthday_greeting',
      customerId: customer.id,
      status: smsResult.status,
      providerResponse: smsResult.providerResponse,
    })
  }

  if (perk?.id) {
    await db
      .from('customer_birthday_perks')
      .update({ greeting_sent_at: new Date().toISOString() })
      .eq('id', perk.id)
      .is('greeting_sent_at', null)
  }

  return { ok: true, inbox, push, sms: smsResult }
}

/** Customer SMS + inbox when the bay starts their car on their birthday. The code stays off the staff card. */
export async function sendBirthdayQueueStart(db, booking) {
  if (!booking?.id || !booking.customer_id) return { skipped: true, reason: 'no_customer' }
  const { data: customer, error } = await db
    .from('customers')
    .select('id, full_name, phone, date_of_birth')
    .eq('id', booking.customer_id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!customer || !isBirthdayToday(customer.date_of_birth)) return { skipped: true, reason: 'not_birthday' }

  const tag = `birthday-start-${booking.id}`
  const [{ data: priorSms }, { data: priorNote }] = await Promise.all([
    db.from('sms_events').select('id').eq('event_type', 'birthday_queue_start').eq('booking_id', booking.id).limit(1).maybeSingle(),
    db.from('user_notifications').select('id').eq('tag', tag).limit(1).maybeSingle(),
  ])
  if (priorSms?.id || priorNote?.id) return { skipped: true, reason: 'already_sent' }

  const { year } = birthdayQueryDays()
  const perk = await ensureBirthdayPerk(db, customer, { year })
  const code = String(perk?.code || '').trim()
  const name = customer.full_name || 'there'
  const body = code
    ? `Happy birthday ${name}! We started on your car. Show code ${code} at the counter. It lasts 7 days.`
    : `Happy birthday ${name}! We started on your car.`
  const inbox = await writeInbox(db, customer.id, {
    kind: 'birthday_queue_start',
    title: 'Happy birthday',
    body,
    url: CUSTOMER_VOUCHERS_PATH,
    tag,
  })
  let push = null
  try {
    push = await sendWebPushToUsers({
      userIds: [customer.id],
      title: 'Happy birthday',
      body,
      url: CUSTOMER_VOUCHERS_PATH,
      tag,
      kind: 'birthday_queue_start',
    })
  } catch (err) {
    push = { error: String(err.message || err) }
  }
  let smsResult = null
  const phone = String(customer.phone || '').trim()
  if (phone && (await isSmsNotificationsEnabled(db))) {
    smsResult = await busybeeSendSms({ phone, message: `Hakum Auto Care: ${body}` })
    await logSmsEvent(db, {
      phone,
      message: `Hakum Auto Care: ${body}`,
      eventType: 'birthday_queue_start',
      customerId: customer.id,
      bookingId: booking.id,
      status: smsResult.status,
      providerResponse: smsResult.providerResponse,
    })
  }
  return { ok: true, inbox, push, sms: smsResult }
}

/**
 * Grant perk + greet one customer if today is their birthday.
 */
export async function grantBirthdayIfDue(db, customer, { now = new Date(), sendGreeting = true } = {}) {
  if (!customer?.id || !isBirthdayToday(customer.date_of_birth, now)) {
    return { skipped: true, reason: 'not_birthday' }
  }
  const { year } = birthdayQueryDays(now)
  const perk = await ensureBirthdayPerk(db, customer, { year, now })
  let greeting = null
  if (sendGreeting && perk && !perk.greeting_sent_at) {
    const templates = await loadTemplateMap(db)
    if (templateEnabled(templates, 'birthday.greeting')) {
      greeting = await sendBirthdayGreeting(db, customer, perk, templates)
    }
  }
  return { ok: true, perk, greeting }
}

export async function runBirthdayGreetings(db = admin(), { now = new Date() } = {}) {
  const { year, customers } = await listBirthdayCustomers(db, now)
  const templates = await loadTemplateMap(db)
  const results = []
  for (const customer of customers) {
    const perk = await ensureBirthdayPerk(db, customer, { year, now })
    let greeting = null
    if (perk && !perk.greeting_sent_at && templateEnabled(templates, 'birthday.greeting')) {
      greeting = await sendBirthdayGreeting(db, customer, perk, templates)
    }
    results.push({ customer_id: customer.id, perk_id: perk?.id, greeting })
  }
  return { year, scanned: customers.length, results }
}
