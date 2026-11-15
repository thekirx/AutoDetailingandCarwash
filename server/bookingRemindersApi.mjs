import { json, setCors } from './httpUtil.mjs'
import { runDetailingBookingReminders } from './bookingReminders.mjs'
import { runRateVisitReminders } from './rateVisitReminders.mjs'
import { scheduledRunGate } from './scheduledRun.mjs'
import { adminClient as admin } from './supabaseAdmin.mjs'

/** GET or POST. Vercel cron uses GET. Super Admin may run it by hand. */
export async function handleBookingRemindersRequest(req, res) {
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
    const detailing = await runDetailingBookingReminders(db)
    const appUrl = String(process.env.PUBLIC_SITE_URL || process.env.VITE_SITE_URL || '').replace(/\/$/, '')
    const rateVisit = await runRateVisitReminders(db, { appUrl })
    return json(res, 200, { ...detailing, rateVisit }, req)
  } catch (err) {
    return json(res, 500, { error: String(err.message || err) }, req)
  }
}
