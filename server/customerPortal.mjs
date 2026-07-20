/**
 * Customer portal data (service role) — verifies JWT is a customer, then returns
 * history / active bookings / queue counts / branches.
 */
import { createClient } from '@supabase/supabase-js'
import { getQueueCounts } from '../src/queue/queueLogic.js'

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function loadCustomerPortal({ accessToken }) {
  if (!accessToken) throw Object.assign(new Error('Unauthorized'), { status: 401 })
  const admin = adminClient()
  const { data: userData, error: userError } = await admin.auth.getUser(accessToken)
  if (userError || !userData?.user) throw Object.assign(new Error('Unauthorized'), { status: 401 })

  const userId = userData.user.id
  const { data: customer } = await admin
    .from('customers')
    .select('id, full_name, phone, email, role')
    .eq('id', userId)
    .eq('role', 'customer')
    .eq('is_archived', false)
    .maybeSingle()

  const isCustomer =
    customer ||
    userData.user.user_metadata?.role === 'customer' ||
    (userData.user.email || '').includes('@customers.hakumautocare.com')

  if (!isCustomer) throw Object.assign(new Error('Customer account required.'), { status: 403 })

  const [branches, history, active, queue] = await Promise.all([
    admin.from('branches').select('slug, name, address, is_active').eq('is_active', true).eq('is_archived', false).order('name'),
    admin
      .from('bookings')
      .select('id, branch, status, vehicle_plate, vehicle_make, vehicle_model, final_price_minor, scheduled_start, created_at, customer_name')
      .eq('customer_id', userId)
      .order('created_at', { ascending: false })
      .limit(40),
    admin
      .from('bookings')
      .select('id, branch, status, vehicle_plate, scheduled_start, notes, final_price_minor')
      .eq('customer_id', userId)
      .in('status', ['waiting', 'in_progress', 'final_checking', 'for_payment'])
      .order('scheduled_start', { ascending: true }),
    admin
      .from('bookings')
      .select('id, branch, status')
      .in('status', ['waiting', 'in_progress', 'final_checking'])
      .eq('is_archived', false),
  ])

  const queueRows = queue.data || []
  const queueByBranch = {}
  for (const row of queueRows) {
    if (!queueByBranch[row.branch]) queueByBranch[row.branch] = []
    queueByBranch[row.branch].push(row)
  }
  const queueCounts = Object.fromEntries(
    Object.entries(queueByBranch).map(([slug, rows]) => [slug, getQueueCounts(rows)]),
  )

  return {
    profile: customer || {
      id: userId,
      full_name: userData.user.user_metadata?.full_name || 'Customer',
      phone: userData.user.user_metadata?.phone || null,
      email: userData.user.email,
      role: 'customer',
    },
    branches: branches.data || [],
    history: history.data || [],
    bookings: active.data || [],
    queueCounts,
  }
}

export async function handleCustomerPortalRequest(req, res, { getAccessToken }) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Method not allowed' }))
      return
    }
    const result = await loadCustomerPortal({ accessToken: getAccessToken() })
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    res.statusCode = err.status || 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: err.message || String(err) }))
  }
}
