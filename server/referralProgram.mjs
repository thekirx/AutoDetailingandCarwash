import { createClient } from '@supabase/supabase-js'
import { normalizeReferralProgram } from '../src/lib/referralProgram.js'
import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function canEditReferralProgram(staff) {
  if (!staff?.is_active || staff.is_archived) return false
  return staff.role === 'BossMich' || staff.role === 'assistant_super_admin'
}

async function readProgram(db) {
  const { data, error } = await db.rpc('referral_program_settings')
  if (error) throw Object.assign(new Error(error.message), { status: 400 })
  const row = Array.isArray(data) ? data[0] : data
  return normalizeReferralProgram(row || {})
}

/** SA and ASA read and save the friend-referral points and detailing discount. */
export async function handleReferralProgramRequest(req, res) {
  setCors(res, 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'GET' && req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
  try {
    const token = bearer(req)
    if (!token) return json(res, 401, { error: 'Sign in required.' })
    const db = adminClient()
    const { data: userData, error: userError } = await db.auth.getUser(token)
    if (userError || !userData?.user) return json(res, 401, { error: 'Sign in required.' })
    const { data: staff } = await db
      .from('staff_profiles')
      .select('role, is_active, is_archived')
      .eq('id', userData.user.id)
      .maybeSingle()
    if (!canEditReferralProgram(staff)) {
      return json(res, 403, { error: 'Only a super admin or assistant admin can change the referral program.' })
    }

    if (req.method === 'GET') return json(res, 200, { program: await readProgram(db) })

    const body = await readJsonBody(req)
    const program = normalizeReferralProgram({
      friend_points: body.friend_points,
      discount_percent: body.discount_percent,
    })
    const { error } = await db.from('app_settings').upsert(
      {
        key: 'referral_program',
        value: program,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    )
    if (error) return json(res, 400, { error: error.message })
    return json(res, 200, { ok: true, program })
  } catch (err) {
    return json(res, err.status || 500, { error: String(err.message || err) })
  }
}
