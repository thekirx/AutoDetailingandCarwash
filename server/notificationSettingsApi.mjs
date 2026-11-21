import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'
import {
  BUSYBEE_SMS_SINGLE_MAX,
  clampNotificationCopy,
  messageMaxForChannel,
  resolveNotificationScope,
  titleMaxForChannel,
} from '../src/lib/notificationCopy.js'
import { resolveActiveStaff } from './staffAuth.mjs'
import { adminClient as admin } from './supabaseAdmin.mjs'

const ALLOWED = new Set(['BossMich', 'assistant_super_admin'])

async function loadStaff(db, token) {
  return resolveActiveStaff(db, token, { select: 'id, role, is_active' })
}

const SELECT_COLS =
  'id, scope, service_id, branch_slug, channel, frequency_months, enabled, title, message, created_at, updated_at'

/**
 * GET    /api/notification-settings
 * POST   /api/notification-settings — create or edit scoped detailing reminder with custom copy
 * PATCH  /api/notification-settings — update existing reminder rule (e.g. quick toggle or edit)
 * DELETE /api/notification-settings?id=...
 */
export async function handleNotificationSettingsRequest(req, res) {
  setCors(res, 'GET, POST, PATCH, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  const token = bearer(req)
  if (!token) return json(res, 401, { error: 'Unauthorized' })
  const db = admin()
  const staff = await loadStaff(db, token)
  if (!staff || !ALLOWED.has(staff.role)) return json(res, 403, { error: 'Forbidden' })

  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost')
    const branch = url.searchParams.get('branch')
    let query = db.from('notification_settings').select(SELECT_COLS)
    if (branch) query = query.eq('branch_slug', branch)
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) return json(res, 400, { error: error.message })
    return json(res, 200, { settings: data || [], limits: { sms: BUSYBEE_SMS_SINGLE_MAX } })
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req)
    const ruleId = body.id ? String(body.id).trim() : null
    const scoped = resolveNotificationScope({
      scope: body.scope,
      service_id: body.service_id,
      branch_slug: body.branch_slug,
    })
    if (!scoped.ok) return json(res, 400, { error: scoped.error })

    // Detailing-only when a service is picked.
    if (scoped.service_id) {
      const { data: svc } = await db
        .from('services')
        .select('id, pay_category, slug')
        .eq('id', scoped.service_id)
        .maybeSingle()
      if (!svc) return json(res, 400, { error: 'Service not found.' })
      const cat = String(svc.pay_category || '').toLowerCase()
      const slug = String(svc.slug || '').toLowerCase()
      const detailingSlugs = new Set(['ceramic-coating', 'nano-ceramic-tint', 'paint-protection-film'])
      if (cat !== 'detailing' && !detailingSlugs.has(slug)) {
        return json(res, 400, { error: 'Reminders are limited to detailing services.' })
      }
    }

    const requestedChannel = String(body.channel || 'push').trim().toLowerCase()
    if (requestedChannel !== 'push') {
      return json(res, 400, {
        error: 'Reminders use Web Push & In-App Inbox only (SMS is reserved for Detailing, Services & Packages status updates).',
      })
    }
    const channel = 'push'
    const tMax = titleMaxForChannel(channel)
    if (body.title && String(body.title).trim().length > tMax) {
      return json(res, 400, {
        error: `Title must be ${tMax} characters or fewer.`,
      })
    }
    const copy = clampNotificationCopy({
      channel,
      title: body.title,
      message: body.message,
    })
    const mMax = messageMaxForChannel(channel)
    if (body.message && String(body.message).trim().length > mMax) {
      return json(res, 400, {
        error: `Message must be ${mMax} characters or fewer (BusyBee ${channel === 'push' ? 'push' : 'SMS'} limit).`,
      })
    }
    if (!copy.message) {
      return json(res, 400, { error: 'Write a custom reminder message.' })
    }

    const payload = {
      scope: scoped.scope,
      service_id: scoped.service_id,
      branch_slug: scoped.branch_slug,
      channel: copy.channel,
      title: copy.title,
      message: copy.message,
      frequency_months: Math.min(24, Math.max(1, Number(body.frequency_months) || 6)),
      enabled: body.enabled !== false,
      updated_at: new Date().toISOString(),
    }

    if (ruleId) {
      // Clean up any other conflicting row with the same scope
      let conflictDel = db.from('notification_settings').delete().neq('id', ruleId).eq('scope', scoped.scope)
      if (scoped.service_id) conflictDel = conflictDel.eq('service_id', scoped.service_id)
      else conflictDel = conflictDel.is('service_id', null)
      if (scoped.branch_slug) conflictDel = conflictDel.eq('branch_slug', scoped.branch_slug)
      else conflictDel = conflictDel.is('branch_slug', null)
      await conflictDel

      const { data, error } = await db
        .from('notification_settings')
        .update(payload)
        .eq('id', ruleId)
        .select(SELECT_COLS)
        .single()
      if (error) return json(res, 400, { error: error.message })
      return json(res, 200, { setting: data })
    }

    payload.created_by = staff.id

    // Upsert by unique scope index — delete conflicting row then insert keeps it simple.
    let del = db.from('notification_settings').delete().eq('scope', scoped.scope)
    if (scoped.service_id) del = del.eq('service_id', scoped.service_id)
    else del = del.is('service_id', null)
    if (scoped.branch_slug) del = del.eq('branch_slug', scoped.branch_slug)
    else del = del.is('branch_slug', null)
    await del

    const { data, error } = await db
      .from('notification_settings')
      .insert(payload)
      .select(SELECT_COLS)
      .single()
    if (error) return json(res, 400, { error: error.message })
    return json(res, 200, { setting: data })
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req)
    const id = String(body.id || '').trim()
    if (!id) return json(res, 400, { error: 'id required' })

    const { data: existing, error: findErr } = await db
      .from('notification_settings')
      .select(SELECT_COLS)
      .eq('id', id)
      .maybeSingle()
    if (findErr) return json(res, 400, { error: findErr.message })
    if (!existing) return json(res, 404, { error: 'Reminder rule not found.' })

    const patch = { updated_at: new Date().toISOString() }
    if (typeof body.enabled === 'boolean') patch.enabled = body.enabled

    if (body.frequency_months !== undefined) {
      patch.frequency_months = Math.min(24, Math.max(1, Number(body.frequency_months) || 6))
    }

    if (body.channel || body.title !== undefined || body.message !== undefined) {
      if (body.channel && String(body.channel).trim().toLowerCase() !== 'push') {
        return json(res, 400, {
          error: 'Reminders use Web Push & In-App Inbox only (SMS is reserved for Detailing, Services & Packages status updates).',
        })
      }
      const channel = 'push'
      const title = body.title !== undefined ? String(body.title).trim() : existing.title
      const message = body.message !== undefined ? String(body.message).trim() : existing.message
      const tMax = titleMaxForChannel(channel)
      const mMax = messageMaxForChannel(channel)
      if (title && title.length > tMax) {
        return json(res, 400, { error: `Title must be ${tMax} characters or fewer.` })
      }
      if (message && message.length > mMax) {
        return json(res, 400, { error: `Message must be ${mMax} characters or fewer.` })
      }
      patch.channel = channel
      patch.title = title || null
      patch.message = message || existing.message
    }

    const { data: updated, error: updErr } = await db
      .from('notification_settings')
      .update(patch)
      .eq('id', id)
      .select(SELECT_COLS)
      .single()
    if (updErr) return json(res, 400, { error: updErr.message })
    return json(res, 200, { setting: updated })
  }

  if (req.method === 'DELETE') {
    const url = new URL(req.url, 'http://localhost')
    const id = url.searchParams.get('id')
    if (!id) return json(res, 400, { error: 'id required' })
    const { error } = await db.from('notification_settings').delete().eq('id', id)
    if (error) return json(res, 400, { error: error.message })
    return json(res, 200, { ok: true })
  }

  return json(res, 405, { error: 'Method not allowed' })
}
