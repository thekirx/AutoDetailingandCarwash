import { createClient } from '@supabase/supabase-js'
import { canAccessPos, canManageMerchShop, getBranchScopeList } from '../src/auth/permissions.js'
import { normalizePickupCode, pickupCodeMatches, pickupDaysLeft, pickupPath, PICKUP_MASK } from '../src/lib/pointsShop.js'
import { bearer, json, rateLimit, readJsonBody, setCors } from './httpUtil.mjs'
import { scheduledRunGate } from './scheduledRun.mjs'
import { sendWebPushToUsers } from './webPush.mjs'

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase server configuration')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
const fail = (message, status = 400) => Object.assign(new Error(message), { status })
export function maskedPickup(row) {
  // An explicit projection prevents future secret columns being leaked by a spread.
  return { id: row.id, customer_id: row.customer_id, product_id: row.product_id,
    points_spent: row.points_spent, branch_slug: row.branch_slug, size_key: row.size_key,
    created_at: row.created_at, expires_at: row.expires_at, status: row.status,
    fulfilled_at: row.fulfilled_at, expired_at: row.expired_at,
    customers: row.customers, products: row.products, pickup_code: PICKUP_MASK }
}
export function assertPickupScope(profile, branch, scopedList = false) {
  if (!profile?.is_active || profile.is_archived || !(canAccessPos(profile) || canManageMerchShop(profile))) throw fail('Pickup access required.', 403)
  const scope = getBranchScopeList(profile)
  if (scope && ((!branch && !scopedList) || (branch && !scope.includes(branch)))) throw fail('Use your assigned branch.', 403)
  return scope
}
async function requireStaff(db, token) {
  if (!token) throw fail('Sign in required.', 401)
  const { data, error } = await db.auth.getUser(token)
  if (error || !data?.user) throw fail('Sign in required.', 401)
  const { data: profile, error: staffError } = await db.from('staff_profiles')
    .select('id, role, branch_slug, permission_grants, is_active, is_archived').eq('id', data.user.id).maybeSingle()
  if (staffError) throw staffError
  const assignments = await db.from('staff_branch_assignments').select('branch_slug').eq('staff_id', data.user.id)
  if (assignments.error) throw assignments.error
  if (profile) profile.branch_slugs = [...new Set([profile.branch_slug, ...(assignments.data || []).map((r) => r.branch_slug)].filter(Boolean))]
  return profile
}
export async function handlePointsShopRequest(req, res) {
  setCors(res, 'POST, OPTIONS', req)
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end() }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' }, req)
  try {
    const db = adminClient()
    const profile = await requireStaff(db, bearer(req))
    const body = await readJsonBody(req)
    const branch = String(body.branch_slug || '').trim()
    const scope = assertPickupScope(profile, branch, body.action === 'list')
    if (body.action === 'list') {
      let q = db.from('accessory_redemptions')
        .select('id, customer_id, product_id, points_spent, branch_slug, size_key, created_at, expires_at, status, fulfilled_at, expired_at, customers(full_name), products(name, photo_url)')
        .order('created_at', { ascending: false })
      if (branch) q = q.eq('branch_slug', branch)
      else if (scope) q = q.in('branch_slug', scope)
      if (body.customer_id) q = q.eq('customer_id', body.customer_id)
      const { data, error } = await q
      if (error) throw error
      return json(res, 200, { redemptions: (data || []).map(maskedPickup) }, req)
    }
    if (!['verify', 'handover'].includes(body.action)) throw fail('Unknown pickup action.')
    if (!branch || !body.id) throw fail('Choose a pickup at this branch.')
    rateLimit({ key: `points-shop-code:${profile.id}`, limit: 20, windowMs: 60_000 })
    const code = normalizePickupCode(body.code)
    const { data: row, error } = await db.from('accessory_redemptions')
      .select('id, branch_slug, customer_id, pickup_code, status, expires_at').eq('id', body.id).maybeSingle()
    if (error) throw error
    if (body.customer_id && row?.customer_id !== body.customer_id) throw fail('Code does not match this customer’s pickup.')
    if (!pickupCodeMatches(row, { id: body.id, branch, code })) throw fail('Code does not match this pickup, or the hold has expired.')
    if (body.action === 'verify') return json(res, 200, { matches: true }, req)
    const result = await db.rpc('handover_redemption', { p_branch: branch, p_code: code, p_staff: profile.id })
    if (result.error) throw result.error
    return json(res, 200, result.data, req)
  } catch (err) { return json(res, err.status || 400, { error: err.message || 'Unable to load pickups.' }, req) }
}

/** Inbox is durable and deduplicated; unavailable browser push never reverses a claim/refund. */
export async function sendShopMessage(db, row, event, sendPush = sendWebPushToUsers) {
  const branch = row.branches?.name || row.branch_slug || 'your branch'
  const item = row.products?.name || row.name || 'Your item'
  const days = pickupDaysLeft(row.expires_at)
  const title = event === 'claimed' ? `Your item is set aside at ${branch}` : event === 'expired' ? 'Your points have been returned' : `${days} ${days === 1 ? 'day' : 'days'} left to pick up your item`
  const body = event === 'expired'
    ? `${row.points_spent} points returned for ${item}. The item is back in stock.`
    : `${item} · ${branch}. ${event === 'claimed' ? 'We keep it for you for 10 days. ' : ''}Show your pickup pass and tell staff your code.`
  const payload = { user_id: row.customer_id, kind: 'points_shop', title, body, url: pickupPath(row.id), tag: `points-shop:${row.id}:${event}` }
  const inserted = await db.from('user_notifications').insert(payload)
  if (inserted.error?.code === '23505') return { duplicate: true }
  if (inserted.error) throw inserted.error
  try { return await sendPush({ userIds: [row.customer_id], ...payload }) }
  catch { return { inbox: true, push: false } }
}
export async function runPointsShopExpiry(db, sendPush = sendWebPushToUsers, now = new Date()) {
  const expired = await db.rpc('expire_redemptions')
  if (expired.error) throw expired.error
  const until = new Date(now.getTime() + 2 * 86400000).toISOString()
  const rows = await db.from('accessory_redemptions')
    .select('id, customer_id, points_spent, branch_slug, expires_at, status, products(name), branches(name)')
    .in('status', ['pending', 'expired']).lte('expires_at', until)
  if (rows.error) throw rows.error
  let notified = 0
  for (const row of rows.data || []) {
    if (row.status === 'pending' && new Date(row.expires_at) <= now) continue
    const result = await sendShopMessage(db, row, row.status === 'expired' ? 'expired' : 'reminder', sendPush)
    if (!result.duplicate) notified++
  }
  return { expired: expired.data, notified }
}
export async function handlePointsShopExpiryRequest(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { error: 'Method not allowed' }, req)
  try {
    const db = adminClient()
    const denied = await scheduledRunGate(req, db)
    if (denied) return json(res, denied.status, { error: denied.error }, req)
    return json(res, 200, await runPointsShopExpiry(db), req)
  } catch (err) { return json(res, 500, { error: err.message }, req) }
}
