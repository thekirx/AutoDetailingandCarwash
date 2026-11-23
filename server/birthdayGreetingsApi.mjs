import { isWithinQuietHours } from '../src/lib/notificationConfig.js'
import { recordAutomationJobRuns } from './automationState.mjs'
import { json, readJsonBody, setCors } from './httpUtil.mjs'
import { runBirthdayGreetings } from './birthdayGreetings.mjs'
import { loadNotificationConfig } from './notificationConfigApi.mjs'
import { resolveRunTrigger, scheduledRunGate } from './scheduledRun.mjs'
import { runStaffBirthdayGreetings } from './staffBirthdayGreetings.mjs'
import { adminClient as admin } from './supabaseAdmin.mjs'

export async function runBirthdayAutomation(db, { now = new Date() } = {}) {
  const config = await loadNotificationConfig(db)
  if (config.birthday_greetings_enabled === false) {
    return {
      customers: { skipped: true, reason: 'disabled_by_admin', scanned: 0, results: [] },
      staff: { skipped: true, reason: 'disabled_by_admin', scanned: 0, results: [] },
    }
  }
  if (isWithinQuietHours(config, now)) {
    return {
      customers: { skipped: true, reason: 'quiet_hours', scanned: 0, results: [] },
      staff: { skipped: true, reason: 'quiet_hours', scanned: 0, results: [] },
    }
  }
  const [customers, staff] = await Promise.all([
    config.birthday_include_customers !== false
      ? runBirthdayGreetings(db, { now })
      : Promise.resolve({ skipped: true, reason: 'customers_disabled', scanned: 0, results: [] }),
    config.birthday_include_staff !== false
      ? runStaffBirthdayGreetings(db, { now })
      : Promise.resolve({ skipped: true, reason: 'staff_disabled', scanned: 0, results: [] }),
  ])
  return { customers, staff }
}

/** GET or POST. Vercel cron uses GET. Super Admin may run it by hand. */
export async function handleBirthdayGreetingsRequest(req, res) {
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

  if (req.method === 'POST') await readJsonBody(req).catch(() => ({}))
  try {
    const trigger = await resolveRunTrigger(req, db)
    const out = await runBirthdayAutomation(db)
    const custScanned = Number(out.customers?.scanned || 0)
    const staffScanned = Number(out.staff?.scanned || 0)
    const skipped = Boolean(out.customers?.skipped && out.staff?.skipped)
    await recordAutomationJobRuns(db, [{
      jobKey: 'birthday_greetings',
      trigger,
      status: skipped ? 'skipped' : 'ok',
      summary: skipped
        ? (out.customers?.reason || out.staff?.reason || 'skipped')
        : `${custScanned} customer · ${staffScanned} staff match`,
    }])
    return json(res, 200, out, req)
  } catch (err) {
    return json(res, 500, { error: err.message || String(err) }, req)
  }
}
