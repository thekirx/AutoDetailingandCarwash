/**
 * Finance accepted end-of-shift → SA / ASA finance_write push (+ optional inbox)
 * and owner daily SMS via BusyBee using formatBacoorReportText.
 */
import { createClient } from '@supabase/supabase-js'
import { formatBacoorReportText } from '../src/lib/bacoorDailyReport.js'
import { busybeeSendSms } from './busybee.mjs'
import { sendWebPushToUsers } from './webPush.mjs'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export function buildShiftCloseAcceptCopy({ branch = '', businessDate = '', closeId = '' } = {}) {
  const site = String(branch || 'branch').trim() || 'branch'
  const day = String(businessDate || '').slice(0, 10) || 'today'
  const id = String(closeId || Date.now())
  return {
    kind: 'payroll.pending_floor',
    title: `Floor pay ready · ${site}`,
    body: `End of shift accepted for ${site} · ${day}. Confirm floor payroll on Payroll (does not auto-pay).`,
    url: '/operations/payroll',
    tag: `shift_close:${id}`,
  }
}

function formatMoneyMinor(n) {
  return `₱${Math.round((Number(n) || 0) / 100).toLocaleString('en-PH')}`
}

/** Build owner SMS body from accepted close submitted snapshot. */
export function buildOwnerDailySmsFromClose({ branch, businessDate, submitted } = {}) {
  const report = {
    ...(submitted && typeof submitted === 'object' ? submitted : {}),
    branch: submitted?.branch || branch || '',
    branch_slug: submitted?.branch_slug || branch || '',
    date: submitted?.date || businessDate || '',
  }
  const text = formatBacoorReportText(report, formatMoneyMinor)
  // BusyBee multi-part ok; soft ceiling for accidental huge payloads
  return text.length > 1400 ? `${text.slice(0, 1390)}\n…` : text
}

/** SA + ASA with finance_write — same fan-out as money contract. */
export async function resolveFloorPayNotifyUserIds(db, { excludeUserId = null } = {}) {
  const ids = new Set()
  const { data: rows, error } = await db
    .from('staff_profiles')
    .select('id, role, permission_grants')
    .eq('is_active', true)
    .in('role', ['BossMich', 'assistant_super_admin'])
  if (error) throw error
  for (const row of rows || []) {
    if (excludeUserId && row.id === excludeUserId) continue
    if (row.role === 'BossMich') {
      ids.add(row.id)
      continue
    }
    const grants = row.permission_grants || {}
    if (grants.finance_write) ids.add(row.id)
  }
  return [...ids]
}

async function resolveOwnerSmsPhones(db) {
  const envPhone = String(process.env.OWNER_SMS_PHONE || process.env.HAKUM_OWNER_PHONE || '').trim()
  const phones = new Set()
  if (envPhone) phones.add(envPhone)
  const { data: bosses } = await db
    .from('staff_profiles')
    .select('phone')
    .eq('role', 'BossMich')
    .eq('is_active', true)
  for (const row of bosses || []) {
    if (row?.phone) phones.add(String(row.phone).trim())
  }
  return [...phones].filter(Boolean)
}

export async function notifyShiftCloseAccepted(input = {}) {
  const copy = buildShiftCloseAcceptCopy(input)
  const db = admin()
  const userIds = await resolveFloorPayNotifyUserIds(db, { excludeUserId: input.actorId || null })
  let push = { sent: 0 }
  if (userIds.length) {
    try {
      push = await sendWebPushToUsers({
        userIds,
        title: copy.title,
        body: copy.body,
        url: copy.url,
        tag: copy.tag,
        kind: copy.kind,
      })
    } catch (err) {
      push = { error: String(err.message || err) }
    }
  }

  let ownerSms = { sent: 0 }
  try {
    let submitted = input.submitted || null
    const closeMeta = { branch: input.branch, businessDate: input.businessDate }
    if (!submitted && input.closeId) {
      const { data: closeRow } = await db
        .from('shift_close_reports')
        .select('submitted, branch, business_date')
        .eq('id', input.closeId)
        .maybeSingle()
      submitted = closeRow?.submitted || null
      if (!closeMeta.branch && closeRow?.branch) closeMeta.branch = closeRow.branch
      if (!closeMeta.businessDate && closeRow?.business_date) closeMeta.businessDate = closeRow.business_date
    }
    const message = buildOwnerDailySmsFromClose({
      branch: closeMeta.branch,
      businessDate: closeMeta.businessDate,
      submitted,
    })
    const phones = await resolveOwnerSmsPhones(db)
    for (const phone of phones) {
      try {
        await busybeeSendSms({ phone, message })
        ownerSms.sent += 1
      } catch (err) {
        ownerSms.error = String(err.message || err)
      }
    }
    if (!phones.length) ownerSms = { sent: 0, skipped: 'no_owner_phone' }
  } catch (err) {
    ownerSms = { sent: 0, error: String(err.message || err) }
  }

  return { targets: userIds.length, push, copy, ownerSms }
}
