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
  setCors(res, 'GET, POST, PATCH, DELETE, OPTIONS', req)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  try {
    const token = bearer(req)
    if (!token) return json(res, 401, { error: 'Unauthorized' }, req)
    const db = admin()
    const staff = await loadStaff(db, token)
    if (!staff || !ALLOWED.has(staff.role)) return json(res, 403, { error: 'Forbidden' }, req)

    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost')
      const branch = url.searchParams.get('branch')
      let query = db.from('notification_settings').select(SELECT_COLS)
      if (branch) query = query.eq('branch_slug', branch)
      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) return json(res, 400, { error: error.message }, req)
      return json(res, 200, { settings: data || [], limits: { sms: BUSYBEE_SMS_SINGLE_MAX } }, req)
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req)
      const ruleId = body.id ? String(body.id).trim() : null
      const scoped = resolveNotificationScope({
        scope: body.scope,
        service_id: body.service_id,
        branch_slug: body.branch_slug,
      })
      if (!scoped.ok) return json(res, 400, { error: scoped.error }, req)

      // Detailing-only when a service is picked.
      if (scoped.service_id) {
        const { data: svc } = await db
          .from('services')
          .select('id, pay_category, slug')
          .eq('id', scoped.service_id)
          .maybeSingle()
        if (!svc) return json(res, 400, { error: 'Service not found.' }, req)
        const cat = String(svc.pay_category || '').toLowerCase()
        const slug = String(svc.slug || '').toLowerCase()
        const detailingSlugs = new Set(['ceramic-coating', 'nano-ceramic-tint', 'paint-protection-film'])
        if (cat !== 'detailing' && !detailingSlugs.has(slug)) {
          return json(res, 400, { error: 'Reminders are limited to detailing services.' }, req)
        }
      }

      const requestedChannel = String(body.channel || 'push').trim().toLowerCase()
      if (requestedChannel !== 'push') {
        return json(res, 400, {
          error: 'Reminders use Web Push & In-App Inbox only (SMS is reserved for Detailing, Services & Packages status updates).',
        }, req)
      }
      const channel = 'push'
      const tMax = titleMaxForChannel(channel)
      if (body.title && String(body.title).trim().length > tMax) {
        return json(res, 400, {
          error: `Title must be ${tMax} characters or fewer.`,
        }, req)
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
        }, req)
      }
      if (!copy.message) {
        return json(res, 400, { error: 'Write a custom reminder message.' }, req)
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

      let scopeLookup = db.from('notification_settings').select('id').eq('scope', scoped.scope)
      scopeLookup = scoped.service_id ? scopeLookup.eq('service_id', scoped.service_id) : scopeLookup.is('service_id', null)
      scopeLookup = scoped.branch_slug ? scopeLookup.eq('branch_slug', scoped.branch_slug) : scopeLookup.is('branch_slug', null)
      const { data: matchingScopeRows } = await scopeLookup

      const targetId = ruleId || matchingScopeRows?.[0]?.id || null
      if (targetId) {
        const duplicateIds = (matchingScopeRows || []).map((r) => r.id).filter((id) => id !== targetId)
        if (duplicateIds.length) {
          await db.from('notification_settings').delete().in('id', duplicateIds)
        }
        const { data, error } = await db
          .from('notification_settings')
          .update(payload)
          .eq('id', targetId)
          .select(SELECT_COLS)
          .single()
        if (error) return json(res, 400, { error: error.message }, req)
        return json(res, 200, { setting: data }, req)
      }

      payload.created_by = staff.id
      const { data, error } = await db
        .from('notification_settings')
        .insert(payload)
        .select(SELECT_COLS)
        .single()
      if (error) return json(res, 400, { error: error.message }, req)
      return json(res, 200, { setting: data }, req)
    }

    if (req.method === 'PATCH') {
      const body = await readJsonBody(req)
      const id = String(body.id || '').trim()
      if (!id) return json(res, 400, { error: 'id required' }, req)

      const { data: existing, error: findErr } = await db
        .from('notification_settings')
        .select(SELECT_COLS)
        .eq('id', id)
        .maybeSingle()
      if (findErr) return json(res, 400, { error: findErr.message }, req)
      if (!existing) return json(res, 404, { error: 'Reminder rule not found.' }, req)

      const patch = { updated_at: new Date().toISOString() }
      if (typeof body.enabled === 'boolean') patch.enabled = body.enabled

      if (body.frequency_months !== undefined) {
        patch.frequency_months = Math.min(24, Math.max(1, Number(body.frequency_months) || 6))
      }

      if (body.channel || body.title !== undefined || body.message !== undefined) {
        if (body.channel && String(body.channel).trim().toLowerCase() !== 'push') {
          return json(res, 400, {
            error: 'Reminders use Web Push & In-App Inbox only (SMS is reserved for Detailing, Services & Packages status updates).',
          }, req)
        }
        const channel = 'push'
        const title = body.title !== undefined ? String(body.title).trim() : existing.title
        const message = body.message !== undefined ? String(body.message).trim() : existing.message
        const tMax = titleMaxForChannel(channel)
        const mMax = messageMaxForChannel(channel)
        if (title && title.length > tMax) {
          return json(res, 400, { error: `Title must be ${tMax} characters or fewer.` }, req)
        }
        if (message && message.length > mMax) {
          return json(res, 400, { error: `Message must be ${mMax} characters or fewer.` }, req)
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
      if (updErr) return json(res, 400, { error: updErr.message }, req)
      return json(res, 200, { setting: updated }, req)
    }

    if (req.method === 'DELETE') {
      const url = new URL(req.url, 'http://localhost')
      const id = url.searchParams.get('id')
      if (!id) return json(res, 400, { error: 'id required' }, req)
      const { error } = await db.from('notification_settings').delete().eq('id', id)
      if (error) return json(res, 400, { error: error.message }, req)
      return json(res, 200, { ok: true }, req)
    }

    return json(res, 405, { error: 'Method not allowed' }, req)
  } catch (err) {
    return json(res, err?.status || 500, { error: String(err?.message || err) }, req)
  }
}
