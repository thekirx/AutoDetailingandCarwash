import { createClient } from '@supabase/supabase-js'
import { referralStaffOptionLabel } from '../src/lib/referralSource.js'
import { json, setCors } from './httpUtil.mjs'

const ROLES = ['staff', 'detailer', 'team_lead', 'admin', 'sales']

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

/** Active crew, staff, and branch admins, with the branch each person is linked to. */
export async function listReferralStaff(db) {
  const [{ data, error }, branches] = await Promise.all([
    db
      .from('staff_profiles')
      .select('id, full_name, role, branch_slug')
      .eq('is_active', true)
      .eq('is_archived', false)
      .in('role', ROLES)
      .order('full_name')
      .limit(400),
    db.from('branches').select('slug, name'),
  ])
  if (error) throw error
  const branchNames = Object.fromEntries((branches.data || []).map((row) => [row.slug, row.name]))
  return (data || [])
    .map((row) => {
      const full_name = String(row.full_name || '').trim()
      return {
        id: row.id,
        full_name,
        role: row.role,
        label: referralStaffOptionLabel({ ...row, full_name }, branchNames),
      }
    })
    .filter((row) => row.full_name)
}

export async function handleReferralStaffRequest(req, res) {
  setCors(res, 'GET, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
  try {
    const staff = await listReferralStaff(adminClient())
    return json(res, 200, { staff })
  } catch (err) {
    return json(res, 500, { error: String(err.message || err) })
  }
}
