import { recordAutomationJobRuns } from './automationState.mjs'
import { json, setCors } from './httpUtil.mjs'
import { runMaintenanceReminders } from './maintenanceReminders.mjs'
import { resolveRunTrigger, scheduledRunGate } from './scheduledRun.mjs'
import { adminClient as admin } from './supabaseAdmin.mjs'

/** GET or POST. Vercel cron uses GET. Super Admin may run it by hand. */
export async function handleMaintenanceRemindersRequest(req, res) {
  setCors(res, 'GET, POST, OPTIONS', req)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'GET' && req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' }, req)

  const db = admin()
  const denied = await scheduledRunGate(req, db)
  if (denied) return json(res, denied.status, { error: denied.error }, req)

  try {
    const trigger = await resolveRunTrigger(req, db)
    const out = await runMaintenanceReminders(db)
    await recordAutomationJobRuns(db, [{
      jobKey: 'maintenance_reminders',
      trigger,
      status: out.skipped ? 'skipped' : 'ok',
      summary: out.skipped ? out.reason : `${out.sent || 0} sent · ${out.due || 0} due`,
    }])
    return json(res, 200, out, req)
  } catch (err) {
    return json(res, 500, { error: String(err.message || err) }, req)
  }
}
