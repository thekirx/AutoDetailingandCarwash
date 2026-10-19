import { bearer } from './httpUtil.mjs'

const RUN_ROLES = new Set(['BossMich', 'assistant_super_admin'])

/** Vercel cron sends Authorization: Bearer CRON_SECRET. An empty secret never matches. */
export function cronAuthorized(req) {
  const secret = String(process.env.CRON_SECRET || '').trim()
  if (!secret) return false
  const header = req.headers?.authorization || req.headers?.Authorization || ''
  return String(header) === `Bearer ${secret}`
}

/**
 * Null when the caller may run a scheduled job.
 * Otherwise { status, error } for the handler to send.
 */
export async function scheduledRunGate(req, db) {
  if (cronAuthorized(req)) return null
  const token = bearer(req)
  if (!token) return { status: 401, error: 'Unauthorized' }
  const { data: userData, error } = await db.auth.getUser(token)
  if (error || !userData?.user) return { status: 401, error: 'Unauthorized' }
  const { data: staff } = await db
    .from('staff_profiles')
    .select('role, is_active')
    .eq('id', userData.user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (!staff || !RUN_ROLES.has(staff.role)) return { status: 403, error: 'Forbidden' }
  return null
}
