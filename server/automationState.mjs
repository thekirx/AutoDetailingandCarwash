/**
 * Server-side automation telemetry ledger & hashed webhook scheduler token store.
 * Persists safely inside `app_settings.notification_automation_runs`.
 * Never stores raw webhook tokens in Postgres — only SHA-256 hex digest + 4-char hint.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { bearer } from './httpUtil.mjs'

export const AUTOMATION_STATE_KEY = 'notification_automation_runs'

export const AUTOMATION_JOB_KEYS = Object.freeze([
  'booking_reminders',
  'rate_visit',
  'maintenance_reminders',
  'birthday_greetings',
  'points_shop_expiry',
])

export function createEmptyAutomationState() {
  const jobs = {}
  for (const key of AUTOMATION_JOB_KEYS) {
    jobs[key] = {
      last_run_at: null,
      last_trigger: null,
      last_status: null,
      last_summary: null,
    }
  }
  return {
    webhook_token_hash: null,
    webhook_token_hint: null,
    webhook_rotated_at: null,
    last_sweep_at: null,
    jobs,
  }
}

export function normalizeAutomationState(raw) {
  const base = createEmptyAutomationState()
  const src = raw && typeof raw === 'object' ? raw : {}
  const jobs = { ...base.jobs }
  for (const key of AUTOMATION_JOB_KEYS) {
    const entry = src.jobs?.[key]
    if (entry && typeof entry === 'object') {
      jobs[key] = {
        last_run_at: entry.last_run_at || null,
        last_trigger: entry.last_trigger || null,
        last_status: entry.last_status || null,
        last_summary: entry.last_summary || null,
      }
    }
  }
  return {
    webhook_token_hash: typeof src.webhook_token_hash === 'string' && /^[a-f0-9]{64}$/i.test(src.webhook_token_hash)
      ? src.webhook_token_hash.toLowerCase()
      : null,
    webhook_token_hint: typeof src.webhook_token_hint === 'string' ? src.webhook_token_hint : null,
    webhook_rotated_at: src.webhook_rotated_at || null,
    last_sweep_at: src.last_sweep_at || null,
    jobs,
  }
}

export async function loadAutomationState(db) {
  try {
    if (!db || typeof db.from !== 'function') return createEmptyAutomationState()
    const query = db.from('app_settings')?.select?.('value')
    if (!query || typeof query.eq !== 'function' || typeof query.maybeSingle !== 'function') {
      return createEmptyAutomationState()
    }
    const { data, error } = await query.eq('key', AUTOMATION_STATE_KEY).maybeSingle()
    if (error || !data?.value) return createEmptyAutomationState()
    return normalizeAutomationState(data.value)
  } catch {
    return createEmptyAutomationState()
  }
}

async function persistAutomationState(db, state) {
  if (!db || typeof db.from !== 'function') return false
  const table = db.from('app_settings')
  if (!table || typeof table.upsert !== 'function') return false
  const { error } = await table.upsert(
    {
      key: AUTOMATION_STATE_KEY,
      value: state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  )
  return !error
}

export async function recordAutomationJobRuns(db, updates = [], { markSweep = false, now = new Date() } = {}) {
  try {
    const state = await loadAutomationState(db)
    const nowIso = now instanceof Date ? now.toISOString() : new Date(now).toISOString()
    let changed = false
    for (const item of updates) {
      if (!item || !AUTOMATION_JOB_KEYS.includes(item.jobKey)) continue
      state.jobs[item.jobKey] = {
        last_run_at: nowIso,
        last_trigger: item.trigger || 'manual',
        last_status: item.status || 'ok',
        last_summary: item.summary ? String(item.summary).slice(0, 180) : null,
      }
      changed = true
    }
    if (markSweep) {
      state.last_sweep_at = nowIso
      changed = true
    }
    if (changed) await persistAutomationState(db, state)
    return state
  } catch {
    return null
  }
}

export function hashWebhookToken(rawToken) {
  return createHash('sha256').update(String(rawToken || '')).digest('hex')
}

export async function webhookTokenMatches(req, db) {
  const token = bearer(req)
  if (!token || token.split('.').length === 3) return false
  const state = await loadAutomationState(db)
  if (!state.webhook_token_hash) return false
  try {
    const actual = Buffer.from(hashWebhookToken(token), 'hex')
    const expected = Buffer.from(state.webhook_token_hash, 'hex')
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export async function mintAutomationWebhookToken(db, actorId) {
  const rawToken = `hkcron_${randomBytes(24).toString('base64url')}`
  const state = await loadAutomationState(db)
  const nowIso = new Date().toISOString()
  state.webhook_token_hash = hashWebhookToken(rawToken)
  state.webhook_token_hint = rawToken.slice(-4)
  state.webhook_rotated_at = nowIso

  const saved = await persistAutomationState(db, state)
  if (!saved) throw new Error('Could not persist automation webhook token hash.')

  await db.from('audit_logs').insert({
    action: 'automation_webhook_token_rotated',
    actor_id: actorId,
    entity_type: 'app_settings',
    entity_id: AUTOMATION_STATE_KEY,
    details: { hint: state.webhook_token_hint },
  })

  return { token: rawToken, state }
}

export async function revokeAutomationWebhookToken(db, actorId) {
  const state = await loadAutomationState(db)
  state.webhook_token_hash = null
  state.webhook_token_hint = null
  state.webhook_rotated_at = new Date().toISOString()

  const saved = await persistAutomationState(db, state)
  if (!saved) throw new Error('Could not clear automation webhook token.')

  await db.from('audit_logs').insert({
    action: 'automation_webhook_token_revoked',
    actor_id: actorId,
    entity_type: 'app_settings',
    entity_id: AUTOMATION_STATE_KEY,
    details: {},
  })

  return { state }
}

export function sanitizeAutomationState(state, env = process.env) {
  const normalized = normalizeAutomationState(state)
  return {
    cron_secret_configured: Boolean(String(env.CRON_SECRET || '').trim()),
    webhook_configured: Boolean(normalized.webhook_token_hash),
    webhook_token_hint: normalized.webhook_token_hint,
    webhook_rotated_at: normalized.webhook_rotated_at,
    last_sweep_at: normalized.last_sweep_at,
    jobs: normalized.jobs,
  }
}
