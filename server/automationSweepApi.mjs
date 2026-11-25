/**
 * Unified Automation Sweep endpoint (`/api/notifications?operation=automation-sweep`).
 * Lets a single Vercel Cron, Supabase `pg_cron` (`pg_net`), Super Admin click, or
 * throttled Operations session sweep execute due notification automations without duplicating logic.
 */
import { manilaTodayISO } from '../src/lib/bookingLead.js'
import { isWithinQuietHours } from '../src/lib/notificationConfig.js'
import {
  AUTOMATION_JOB_KEYS,
  loadAutomationState,
  recordAutomationJobRuns,
  webhookTokenMatches,
} from './automationState.mjs'
import { runBirthdayAutomation } from './birthdayGreetingsApi.mjs'
import { runDetailingBookingReminders } from './bookingReminders.mjs'
import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'
import { runMaintenanceReminders } from './maintenanceReminders.mjs'
import { loadNotificationConfig } from './notificationConfigApi.mjs'
import { runPointsShopExpiry } from './pointsShop.mjs'
import { runRateVisitReminders } from './rateVisitReminders.mjs'
import { cronAuthorized } from './scheduledRun.mjs'
import { resolveActiveStaff } from './staffAuth.mjs'
import { adminClient as admin } from './supabaseAdmin.mjs'

const SWEEP_COOLDOWN_MS = 5 * 60 * 1000
const RATE_VISIT_CADENCE_MS = 15 * 60 * 1000

const OPS_SWEEP_ROLES = new Set([
  'BossMich',
  'assistant_super_admin',
  'admin',
  'team_lead',
  'operations_lead',
  'sales',
  'staff',
])
const MANUAL_SWEEP_ROLES = new Set(['BossMich', 'assistant_super_admin'])

function manilaHour(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now)
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24
}

export function isJobDueForSweep(jobKey, jobState, config, now = new Date(), { ignoreDailyHour = false } = {}) {
  const enabledMap = {
    booking_reminders: config.booking_reminders_enabled !== false,
    rate_visit: config.rate_visit_enabled !== false,
    maintenance_reminders: config.maintenance_reminders_enabled !== false,
    birthday_greetings: config.birthday_greetings_enabled !== false,
    points_shop_expiry: config.points_shop_expiry_enabled !== false,
  }
  if (!enabledMap[jobKey]) return false

  const lastAt = jobState?.last_run_at ? Date.parse(jobState.last_run_at) : NaN
  const nowMs = now.getTime()

  if (jobKey === 'rate_visit') {
    return !Number.isFinite(lastAt) || nowMs - lastAt >= RATE_VISIT_CADENCE_MS
  }

  const todayManila = manilaTodayISO(now)
  const lastDayManila = Number.isFinite(lastAt) ? manilaTodayISO(new Date(lastAt)) : null
  if (lastDayManila === todayManila) return false

  if (!ignoreDailyHour) {
    const targetHour = Number(config.daily_automation_hour_manila ?? 8)
    if (manilaHour(now) < targetHour) return false
  }
  return true
}

export async function executeAutomationSweep(db, { trigger = 'manual', force = false, now = new Date() } = {}) {
  const [config, state] = await Promise.all([loadNotificationConfig(db), loadAutomationState(db)])

  if (trigger === 'coded_sweep' && config.automation_mode === 'cron_only') {
    return { ok: true, skipped: true, reason: 'cron_only_mode', ran: [], results: {} }
  }

  if (trigger === 'coded_sweep' && !force && state.last_sweep_at) {
    const age = now.getTime() - Date.parse(state.last_sweep_at)
    if (Number.isFinite(age) && age < SWEEP_COOLDOWN_MS) {
      return { ok: true, skipped: true, reason: 'cooldown', ran: [], results: {} }
    }
  }

  if (isWithinQuietHours(config, now)) {
    return { ok: true, skipped: true, reason: 'quiet_hours', ran: [], results: {} }
  }

  const ignoreDailyHour = trigger === 'vercel_cron' || trigger === 'manual' || force
  const dueJobs = force
    ? AUTOMATION_JOB_KEYS.filter((k) => {
        if (k === 'booking_reminders') return config.booking_reminders_enabled !== false
        if (k === 'rate_visit') return config.rate_visit_enabled !== false
        if (k === 'maintenance_reminders') return config.maintenance_reminders_enabled !== false
        if (k === 'birthday_greetings') return config.birthday_greetings_enabled !== false
        if (k === 'points_shop_expiry') return config.points_shop_expiry_enabled !== false
        return false
      })
    : AUTOMATION_JOB_KEYS.filter((k) => isJobDueForSweep(k, state.jobs?.[k], config, now, { ignoreDailyHour }))

  if (!dueJobs.length) {
    await recordAutomationJobRuns(db, [], { markSweep: true, now })
    return { ok: true, skipped: true, reason: 'up_to_date', ran: [], results: {} }
  }

  const appUrl = String(process.env.PUBLIC_SITE_URL || process.env.VITE_SITE_URL || '').replace(/\/$/, '')
  const results = {}
  const telemetryUpdates = []

  for (const jobKey of dueJobs) {
    try {
      if (jobKey === 'booking_reminders') {
        const res = await runDetailingBookingReminders(db, manilaTodayISO(now))
        results[jobKey] = res
        telemetryUpdates.push({
          jobKey,
          trigger,
          status: res.skipped ? 'skipped' : 'ok',
          summary: res.skipped ? res.reason : `${res.sent || 0} sent · ${res.considered || 0} due`,
        })
      } else if (jobKey === 'rate_visit') {
        const res = await runRateVisitReminders(db, { appUrl, nowMs: now.getTime() })
        results[jobKey] = res
        telemetryUpdates.push({
          jobKey,
          trigger,
          status: res.skipped ? 'skipped' : 'ok',
          summary: res.skipped ? res.reason : `${res.sent || 0} sent · ${res.eligible || 0} eligible`,
        })
      } else if (jobKey === 'maintenance_reminders') {
        const res = await runMaintenanceReminders(db, now)
        results[jobKey] = res
        telemetryUpdates.push({
          jobKey,
          trigger,
          status: res.skipped ? 'skipped' : 'ok',
          summary: res.skipped ? res.reason : `${res.sent || 0} sent · ${res.due || 0} due`,
        })
      } else if (jobKey === 'birthday_greetings') {
        const res = await runBirthdayAutomation(db, { now })
        results[jobKey] = res
        const custScanned = Number(res.customers?.scanned || 0)
        const staffScanned = Number(res.staff?.scanned || 0)
        const skipped = Boolean(res.customers?.skipped && res.staff?.skipped)
        telemetryUpdates.push({
          jobKey,
          trigger,
          status: skipped ? 'skipped' : 'ok',
          summary: skipped ? (res.customers?.reason || 'skipped') : `${custScanned} customer · ${staffScanned} staff match`,
        })
      } else if (jobKey === 'points_shop_expiry') {
        const res = await runPointsShopExpiry(db, undefined, now)
        results[jobKey] = res
        telemetryUpdates.push({
          jobKey,
          trigger,
          status: res.skipped ? 'skipped' : 'ok',
          summary: res.skipped ? res.reason : `${res.expired || 0} expired · ${res.notified || 0} notified`,
        })
      }
    } catch (err) {
      results[jobKey] = { ok: false, error: String(err?.message || err) }
      telemetryUpdates.push({
        jobKey,
        trigger,
        status: 'error',
        summary: String(err?.message || err),
      })
    }
  }

  await recordAutomationJobRuns(db, telemetryUpdates, { markSweep: true, now })
  return { ok: true, skipped: false, trigger, ran: dueJobs, results }
}

export async function handleAutomationSweepRequest(req, res) {
  setCors(res, 'GET, POST, OPTIONS', req)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'GET' && req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' }, req)

  const db = admin()
  const body = req.method === 'POST' ? await readJsonBody(req).catch(() => ({})) : {}
  const requestedMode = String(body?.mode || '').trim().toLowerCase()

  let trigger = null
  if (cronAuthorized(req)) {
    trigger = 'vercel_cron'
  } else if (await webhookTokenMatches(req, db)) {
    trigger = 'webhook_cron'
  } else {
    const token = bearer(req)
    if (!token) return json(res, 401, { error: 'Unauthorized' }, req)
    const { data: userData, error } = await db.auth.getUser(token)
    if (error || !userData?.user) return json(res, 401, { error: 'Unauthorized' }, req)
    const staff = await resolveActiveStaff(db, null, {
      userId: userData.user.id,
      select: 'id, role, is_active',
    })
    if (!staff || !OPS_SWEEP_ROLES.has(staff.role)) return json(res, 403, { error: 'Forbidden' }, req)

    if (requestedMode === 'manual' || body?.force) {
      if (!MANUAL_SWEEP_ROLES.has(staff.role)) {
        return json(res, 403, { error: 'Super Admin or Assistant Super Admin required for manual sweep.' }, req)
      }
      trigger = 'manual'
    } else {
      trigger = 'coded_sweep'
    }
  }

  try {
    const force = Boolean(body?.force) && trigger === 'manual'
    const out = await executeAutomationSweep(db, { trigger, force })
    return json(res, 200, out, req)
  } catch (err) {
    return json(res, 500, { error: String(err?.message || err) }, req)
  }
}
