import { createClient } from '@supabase/supabase-js'
import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'
import { runBirthdayGreetings } from './birthdayGreetings.mjs'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const RUN_ROLES = new Set(['BossMich', 'assistant_super_admin'])

function cronAuthorized(req) {
  const secret = String(process.env.CRON_SECRET || '').trim()
  if (!secret) return false
  const header = String(req.headers?.authorization || '')
  return header === `Bearer ${secret}`
}

async function loadStaff(db, token) {
  const { data: userData, error: userErr } = await db.auth.getUser(token)
  if (userErr || !userData?.user) return null
  const { data: staff } = await db
    .from('staff_profiles')
    .select('id, role, is_active')
    .eq('id', userData.user.id)
    .eq('is_active', true)
    .maybeSingle()
  return staff
}

/**
 * POST /api/birthday-greetings
 * Cron (CRON_SECRET) or Super Admin: grant today's birthday perks and send greetings.
 */
export async function handleBirthdayGreetingsRequest(req, res) {
  setCors(res, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  const db = admin()
  if (!cronAuthorized(req)) {
    const token = bearer(req)
    if (!token) return json(res, 401, { error: 'Unauthorized' })
    const staff = await loadStaff(db, token)
    if (!staff || !RUN_ROLES.has(staff.role)) return json(res, 403, { error: 'Forbidden' })
  }

  await readJsonBody(req).catch(() => ({}))
  try {
    const result = await runBirthdayGreetings(db)
    return json(res, 200, result)
  } catch (err) {
    return json(res, 500, { error: err.message || String(err) })
  }
}
