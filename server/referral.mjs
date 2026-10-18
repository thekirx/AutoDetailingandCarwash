/**
 * Refer a friend — server side (service role). Detailing and up only, never carwash.
 *
 * Qualification, refunds and the POS claim live in the database
 * (supabase/migrations/20261018120000_refer_a_friend.sql). This module reads
 * settings, hands out codes, links a friend at sign-up, builds the app payload
 * and sends the "reward ready" push.
 *
 * Every helper tolerates the migration not being applied yet: it reports the
 * program as off instead of throwing, so this code can ship before the SQL.
 */
import { createClient } from '@supabase/supabase-js'
import {
  REFERRAL_DEFAULTS,
  makeReferralCode,
  normalizeReferralCode,
  normalizeReferralSettings,
  referralLink,
} from '../src/lib/referral.js'
import { applyTemplateText } from '../src/lib/notificationTemplates.js'
import { phoneDigits } from '../src/lib/customerAuth.js'
import { bearer, clientIp, json, rateLimit, readJsonBody } from './httpUtil.mjs'

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const WASH_CATEGORIES = ['wash', 'package', 'addon']

function firstName(fullName) {
  return String(fullName || '').trim().split(/\s+/)[0] || ''
}

function manilaYear(date = new Date()) {
  return Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric' }).format(date))
}

/** Settings row + the live list of services that count / don't. Off when the table is missing. */
export async function loadReferralSettings(db) {
  const { data: row, error } = await db.from('referral_program_settings').select('*').eq('id', 1).maybeSingle()
  if (error || !row) return normalizeReferralSettings({ ...REFERRAL_DEFAULTS, enabled: false })

  const { data: services } = await db
    .from('services')
    .select('name, pay_category, referral_eligible')
    .eq('is_active', true)
    .eq('is_archived', false)
    .order('name')
  const rows = services || []
  const eligible = rows.filter((s) => s.referral_eligible).map((s) => s.name)
  const excluded = rows
    .filter((s) => !s.referral_eligible && WASH_CATEGORIES.includes(String(s.pay_category || '').toLowerCase()))
    .map((s) => s.name)
  return normalizeReferralSettings({ ...row, eligible_services: eligible, excluded_services: excluded })
}

/** Public: the inviter's first name for the sign-up banner. Nothing else ever leaves. */
export async function lookupReferrer(db, code) {
  const clean = normalizeReferralCode(code)
  if (!clean) return null
  const settings = await loadReferralSettings(db)
  if (!settings.enabled) return null
  const { data } = await db.from('customers').select('full_name').eq('referral_code', clean).maybeSingle()
  return data
    ? { code: clean, first_name: firstName(data.full_name) || 'a friend', reward_label: settings.reward_label }
    : null
}

/** Give a customer a code the first time they need one. Retries on the rare collision. */
export async function ensureReferralCode(db, customerId, fullName) {
  const { data: row, error } = await db.from('customers').select('referral_code').eq('id', customerId).maybeSingle()
  if (error) return ''
  if (row?.referral_code) return row.referral_code
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = makeReferralCode(firstName(fullName))
    const { data: saved, error: saveError } = await db
      .from('customers')
      .update({ referral_code: code })
      .eq('id', customerId)
      .is('referral_code', null)
      .select('referral_code')
      .maybeSingle()
    if (!saveError && saved?.referral_code) return saved.referral_code
    if (saveError && saveError.code !== '23505') return ''
    const { data: again } = await db.from('customers').select('referral_code').eq('id', customerId).maybeSingle()
    if (again?.referral_code) return again.referral_code
  }
  return ''
}

/**
 * Link a new account to its referrer. Never throws and never blocks sign-up:
 * returns { linked: false, reason } when the code or the friend doesn't qualify.
 */
export async function linkReferralAtSignup(db, { friendId, friendPhone, code, isNewAccount }) {
  try {
    const clean = normalizeReferralCode(code)
    if (!clean) return { linked: false, reason: 'no_code' }
    if (!isNewAccount) return { linked: false, reason: 'not_new' }
    const settings = await loadReferralSettings(db)
    if (!settings.enabled) return { linked: false, reason: 'off' }

    const { data: referrer } = await db.from('customers').select('id, phone').eq('referral_code', clean).maybeSingle()
    if (!referrer?.id) return { linked: false, reason: 'unknown_code' }
    if (referrer.id === friendId) return { linked: false, reason: 'self' }
    const a = phoneDigits(referrer.phone).slice(-10)
    const b = phoneDigits(friendPhone).slice(-10)
    if (a && b && a === b) return { linked: false, reason: 'self' }

    const { count } = await db
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', friendId)
      .eq('status', 'paid')
    if ((count || 0) > 0) return { linked: false, reason: 'has_history' }

    const { error } = await db.from('customer_referrals').insert({ referrer_id: referrer.id, friend_id: friendId, code: clean })
    if (error) return { linked: false, reason: error.code === '23505' ? 'already_linked' : 'error' }
    return { linked: true }
  } catch {
    return { linked: false, reason: 'error' }
  }
}

/** Why a pending friend hasn't qualified yet — "carwash_only" when they've paid but only for washes. */
async function waitingReasons(db, friendIds) {
  if (!friendIds.length) return {}
  const { data } = await db
    .from('sales')
    .select('customer_id, status')
    .in('customer_id', friendIds)
    .eq('status', 'paid')
  const paid = new Set((data || []).map((s) => s.customer_id))
  return Object.fromEntries(friendIds.map((id) => [id, paid.has(id) ? 'carwash_only' : 'no_visit']))
}

/** Rewards tab payload. `null` when the program is off or not installed. */
export async function portalReferral(db, { userId, fullName, origin }) {
  const settings = await loadReferralSettings(db)
  if (!settings.enabled) return null
  const code = await ensureReferralCode(db, userId, fullName)
  const [refs, rewards] = await Promise.all([
    db
      .from('customer_referrals')
      .select('id, friend_id, status, qualified_at, created_at, customers!customer_referrals_friend_id_fkey(full_name)')
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    db
      .from('customer_referral_rewards')
      .select('id, role, status, expires_at, claimed_at')
      .eq('customer_id', userId)
      .in('status', ['available', 'claimed'])
      .order('granted_at', { ascending: false })
      .limit(20),
  ])
  const rows = refs.data || []
  const reasons = await waitingReasons(
    db,
    rows.filter((r) => r.status === 'pending').map((r) => r.friend_id),
  )
  const year = manilaYear()
  const now = Date.now()
  return {
    enabled: true,
    code,
    link: referralLink(code, origin),
    reward_label: settings.reward_label,
    validity_days: settings.validity_days,
    yearly_cap: settings.yearly_cap,
    used_this_year: rows.filter((r) => r.status === 'qualified' && r.qualified_at && manilaYear(new Date(r.qualified_at)) === year).length,
    referrals: rows.map((r) => ({
      id: r.id,
      first_name: firstName(r.customers?.full_name) || 'A friend',
      status: r.status,
      waiting_reason: r.status === 'pending' ? reasons[r.friend_id] || 'no_visit' : null,
    })),
    rewards: (rewards.data || []).filter((w) => w.status === 'claimed' || new Date(w.expires_at).getTime() > now),
  }
}

/** Push + inbox to both sides once a sale qualified a referral. Idempotent via notified_at. */
export async function notifyReferralForSale(db, saleId, { sendPush, templates = {} } = {}) {
  const { data: ref } = await db
    .from('customer_referrals')
    .select('id, referrer_id, friend_id, status, notified_at')
    .eq('qualifying_sale_id', saleId)
    .maybeSingle()
  if (!ref || ref.status !== 'qualified' || ref.notified_at) return { skipped: true }
  const { data: claimed } = await db
    .from('customer_referrals')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', ref.id)
    .is('notified_at', null)
    .select('id')
    .maybeSingle()
  if (!claimed) return { skipped: true }

  const settings = await loadReferralSettings(db)
  const tpl = templates['referral.reward']
  if (tpl && tpl.enabled === false) return { skipped: true, reason: 'disabled' }
  const { data: people } = await db.from('customers').select('id, full_name').in('id', [ref.referrer_id, ref.friend_id])
  const sent = []
  for (const person of people || []) {
    const vars = { name: firstName(person.full_name) || 'Hi', days: String(settings.validity_days) }
    const title = applyTemplateText(tpl?.title, vars, 'Your refer-a-friend reward is ready')
    const body = applyTemplateText(
      tpl?.body,
      vars,
      `${vars.name}, your refer-a-friend reward is in Rewards. Use it on a detailing service or higher within ${vars.days} days.`,
    )
    await db.from('user_notifications').insert({
      user_id: person.id,
      kind: 'referral_reward',
      title,
      body,
      url: '/account/loyalty',
      tag: `referral-${ref.id}-${person.id}`,
    })
    if (sendPush) {
      try {
        await sendPush({ userIds: [person.id], title, body, url: '/account/loyalty', tag: `referral-${ref.id}`, kind: 'referral_reward' })
      } catch {
        /* inbox already has it */
      }
    }
    sent.push(person.id)
  }
  return { ok: true, sent }
}

async function requireStaff(db, token) {
  if (!token) throw Object.assign(new Error('Sign in first.'), { status: 401 })
  const { data, error } = await db.auth.getUser(token)
  if (error || !data?.user) throw Object.assign(new Error('Sign in first.'), { status: 401 })
  const { data: staff } = await db.from('staff_profiles').select('id, is_active').eq('id', data.user.id).maybeSingle()
  if (!staff?.is_active) throw Object.assign(new Error('Staff only.'), { status: 403 })
  return data.user.id
}

/**
 * /api/referral
 *   GET  ?view=settings          public settings (on/off, reward words, what counts)
 *   GET  ?view=lookup&code=X     inviter's first name for the sign-up banner (rate limited)
 *   POST { action: 'notify', sale_id }   staff, after a POS sale: push if it qualified a referral
 */
export async function handleReferralRequest(req, res) {
  try {
    const url = new URL(req.url || '/', 'http://localhost')
    const method = String(req.method || 'GET').toUpperCase()
    // Every public page's footer asks for this, so it never errors: anything it
    // can't read (no service key locally, migration pending) means "program off".
    if (method === 'GET' && (url.searchParams.get('view') || 'settings') === 'settings') {
      let settings = normalizeReferralSettings({ ...REFERRAL_DEFAULTS, enabled: false })
      try {
        settings = await loadReferralSettings(adminClient())
      } catch {
        /* off */
      }
      return json(res, 200, { settings }, req)
    }
    const db = adminClient()
    if (method === 'GET') {
      const view = url.searchParams.get('view') || 'settings'
      if (view === 'lookup') {
        rateLimit({ key: `referral-lookup:${clientIp(req)}`, limit: 20, windowMs: 60_000 })
        const found = await lookupReferrer(db, url.searchParams.get('code'))
        return found ? json(res, 200, found, req) : json(res, 404, { error: 'Not found' }, req)
      }
      return json(res, 404, { error: 'Not found' }, req)
    }
    if (method === 'POST') {
      await requireStaff(db, bearer(req))
      const body = await readJsonBody(req)
      if (body?.action !== 'notify' || !body?.sale_id) return json(res, 400, { error: 'sale_id required' }, req)
      const { sendWebPushToUsers } = await import('./webPush.mjs')
      const { loadTemplateMap } = await import('./notificationTemplatesDb.mjs')
      const templates = await loadTemplateMap(db).catch(() => ({}))
      const result = await notifyReferralForSale(db, body.sale_id, { sendPush: sendWebPushToUsers, templates })
      return json(res, 200, result, req)
    }
    return json(res, 405, { error: 'Method not allowed' }, req)
  } catch (err) {
    return json(res, err.status || 500, { error: err.status ? err.message : 'Something went wrong' }, req)
  }
}
