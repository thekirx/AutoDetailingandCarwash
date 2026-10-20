/**
 * Day-of staff birthday inbox + web push. No SMS (BusyBee stays customer-only; no owner SMS).
 * Idempotent per staff/year via user_notifications.tag.
 */
import { createClient } from '@supabase/supabase-js'
import { birthdayQueryDays, isBirthdayToday } from '../src/lib/birthdayPerk.js'
import { sendWebPushToUsers } from './webPush.mjs'

// ponytail: scan active staff with DOB; Manila day via isBirthdayToday. Ceiling ~few hundred staff rows.

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
  if (error?.code === '23505') return { inserted: 0, duplicate: true }
  return error ? { error: error.message } : { inserted: 1 }
}

export function staffBirthdayTag(staffId, year) {
  return `staff-birthday-${staffId}-${year}`
}

export async function listStaffBirthdaysToday(db, today = new Date()) {
  const { year } = birthdayQueryDays(today)
  const { data, error } = await db
    .from('staff_profiles')
    .select('id, full_name, date_of_birth, is_active, home_branch')
    .eq('is_active', true)
    .not('date_of_birth', 'is', null)
  if (error) throw new Error(error.message)
  const staff = (data || []).filter((row) => isBirthdayToday(row.date_of_birth, today))
  return { year, staff }
}

export async function greetStaffBirthday(db, staff, { year }) {
  const first = String(staff.full_name || 'teammate').trim().split(/\s+/)[0] || 'teammate'
  const title = 'Happy birthday'
  const body = `Happy birthday, ${first}. Have a great day on the floor.`
  const url = '/operations/attendance'
  const tag = staffBirthdayTag(staff.id, year)
  const kind = 'staff_birthday'

  const existing = await db
    .from('user_notifications')
    .select('id')
    .eq('user_id', staff.id)
    .eq('tag', tag)
    .maybeSingle()
  if (existing.error) throw new Error(existing.error.message)
  if (existing.data) return { skipped: true, reason: 'already_sent', tag }

  const inbox = await writeInbox(db, staff.id, { kind, title, body, url, tag })
  if (inbox.error) throw new Error(inbox.error)
  const push = await sendWebPushToUsers({
    userIds: [staff.id],
    title,
    body,
    url,
    tag,
    kind,
  })
  return { ok: true, inbox, push, tag }
}

/** Cron entry: inbox + push only. Never SMS. */
export async function runStaffBirthdayGreetings(db = admin(), { now = new Date() } = {}) {
  const { year, staff } = await listStaffBirthdaysToday(db, now)
  const results = []
  for (const row of staff) {
    try {
      results.push({ staff_id: row.id, ...(await greetStaffBirthday(db, row, { year })) })
    } catch (err) {
      results.push({ staff_id: row.id, error: err.message || String(err) })
    }
  }
  return { year, scanned: staff.length, results, channel: 'inbox_push_only' }
}
