import { webhookTokenMatches } from './automationState.mjs'
import { bearer } from './httpUtil.mjs'
import { resolveActiveStaff } from './staffAuth.mjs'

const RUN_ROLES = new Set(['BossMich', 'assistant_super_admin'])

/** Vercel cron sends Authorization: Bearer CRON_SECRET. An empty secret never matches. */
export function cronAuthorized(req) {
  const secret = String(process.env.CRON_SECRET || '').trim()
  if (!secret) return false
  const header = req.headers?.authorization || req.headers?.Authorization || ''
  return String(header) === `Bearer ${secret}`
}

/** Identify how an authorized run was invoked for telemetry logging. */
export async function resolveRunTrigger(req, db) {
  if (cronAuthorized(req)) return 'vercel_cron'
  if (await webhookTokenMatches(req, db)) return 'webhook_cron'
  return 'manual'
}

/**
 * Null when the caller may run a scheduled job.
 * Accepts Vercel CRON_SECRET, hashed Supabase pg_cron webhook token, or BossMich / assistant_super_admin session.
 * Otherwise { status, error } for the handler to send.
 */
export async function scheduledRunGate(req, db) {
  if (cronAuthorized(req)) return null
  if (await webhookTokenMatches(req, db)) return null
  const token = bearer(req)
  if (!token) return { status: 401, error: 'Unauthorized' }
  const { data: userData, error } = await db.auth.getUser(token)
  if (error || !userData?.user) return { status: 401, error: 'Unauthorized' }
  const staff = await resolveActiveStaff(db, null, {
    userId: userData.user.id,
    select: 'role, is_active',
  })
  if (!staff || !RUN_ROLES.has(staff.role)) return { status: 403, error: 'Forbidden' }
  return null
}
