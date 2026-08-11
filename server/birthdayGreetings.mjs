/**
 * Grant the yearly birthday free-service perk and send greeting push + SMS.
 * Idempotent per customer/year via customer_birthday_perks unique key.
 */
import { createClient } from '@supabase/supabase-js'
import { birthdayPerkExpiresAt, birthdayQueryDays, isBirthdayToday } from '../src/lib/birthdayPerk.js'
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

async function logSmsEvent(db, { phone, message, eventType, customerId, status, providerResponse }) {
  await db.from('sms_events').insert({
    phone,
    message,
    event_type: eventType,
    customer_id: customerId || null,
    provider: 'busybee',
    status,
    provider_response: providerResponse || null,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
  })
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
  const expires = birthdayPerkExpiresAt(now).toISOString()
  const { data, error } = await db
    .from('customer_birthday_perks')
    .upsert(
      {
        customer_id: customer.id,
        perk_year: perkYear,
        status: 'available',
        expires_at: expires,
      },
      { onConflict: 'customer_id,perk_year', ignoreDuplicates: true },
    )
    .select('id, customer_id, perk_year, status, expires_at, greeting_sent_at, claimed_at')
    .maybeSingle()
  if (error && error.code !== '23505') {
    const existing = await db
      .from('customer_birthday_perks')
      .select('id, customer_id, perk_year, status, expires_at, greeting_sent_at, claimed_at')
      .eq('customer_id', customer.id)
      .eq('perk_year', perkYear)
      .maybeSingle()
    if (existing.error) throw new Error(existing.error.message)
    return existing.data
  }
  if (data) return data
  const { data: row, error: readErr } = await db
    .from('customer_birthday_perks')
    .select('id, customer_id, perk_year, status, expires_at, greeting_sent_at, claimed_at')
    .eq('customer_id', customer.id)
    .eq('perk_year', perkYear)
    .maybeSingle()
  if (readErr) throw new Error(readErr.message)
  return row
}

export async function sendBirthdayGreeting(db, customer, perk, templates = {}) {
  const tpl = templates['birthday.greeting']
  if (tpl && tpl.enabled === false) return { skipped: true, reason: 'disabled' }
  if (perk?.greeting_sent_at) return { skipped: true, reason: 'already_sent' }

  const vars = { name: customer.full_name || 'there' }
  const title = applyTemplateText(tpl?.title, vars, 'Happy birthday from Hakum')
  const body = applyTemplateText(
    tpl?.body,
    vars,
    `Happy birthday ${vars.name}! Enjoy a free service on us this year.`,
  )
  const sms = applyTemplateText(
    tpl?.sms_body,
    vars,
    `Hakum Auto Care: Happy birthday ${vars.name}! Your free birthday service is ready.`,
  )

  const inbox = await writeInbox(db, customer.id, {
    kind: 'birthday_greeting',
    title,
    body,
    url: '/account',
    tag: `birthday-${customer.id}-${perk?.perk_year || new Date().getFullYear()}`,
  })

  let push = null
  try {
    push = await sendWebPushToUsers({
      userIds: [customer.id],
      title,
      body,
      url: '/account',
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
