/**
 * Super Admin / Owner Notification Settings & Diagnostics API.
 * Reads and persists unified `app_settings.notification_config` (synced with `sms_notifications`),
 * aggregates Push subscription coverage via `notificationDiagnostics.mjs`, and allows
 * BossMich-only Status SMS health verification probes.
 */
import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'
import { resolveActiveStaff } from './staffAuth.mjs'
import { adminClient as admin } from './supabaseAdmin.mjs'
import { busybeeBalance, busybeeSendSms, normalizePhMobile } from './busybee.mjs'
import { gatherNotificationDiagnostics, maskPhoneSuffix } from './notificationDiagnostics.mjs'
import { diagnoseVapidConfig, sendWebPushToUsers } from './webPush.mjs'
import {
  NOTIFICATION_CONFIG_KEY,
  createDefaultNotificationConfig,
  resolveNotificationConfigRows,
  validateNotificationConfigPatch,
} from '../src/lib/notificationConfig.js'

const NOTIFICATION_CONFIG_ROLES = new Set(['BossMich', 'assistant_super_admin'])
const COOLDOWN_MS = 20_000

/** Safe config loader usable across backend dispatchers and crons (never throws on mock DBs). */
export async function loadNotificationConfig(db = admin()) {
  try {
    if (!db || typeof db.from !== 'function') return createDefaultNotificationConfig()
    const query = db.from('app_settings')?.select?.('key, value, updated_at')
    if (!query || typeof query.in !== 'function') return createDefaultNotificationConfig()
    const { data, error } = await query.in('key', [NOTIFICATION_CONFIG_KEY, 'sms_notifications'])
    if (error || !Array.isArray(data)) return createDefaultNotificationConfig()
    const configRow = data.find((r) => r.key === NOTIFICATION_CONFIG_KEY) || null
    const smsRow = data.find((r) => r.key === 'sms_notifications') || null
    return resolveNotificationConfigRows({ configRow, smsRow })
  } catch {
    return createDefaultNotificationConfig()
  }
}

async function persistNotificationConfig(db, config, actorId, action) {
  const nowIso = new Date().toISOString()
  const [cfgRes, smsRes] = await Promise.all([
    db
      .from('app_settings')
      .upsert({ key: NOTIFICATION_CONFIG_KEY, value: config, updated_at: nowIso }, { onConflict: 'key' }),
    db
      .from('app_settings')
      .upsert({ key: 'sms_notifications', value: { enabled: config.sms_enabled }, updated_at: nowIso }, { onConflict: 'key' }),
  ])
  if (cfgRes.error) throw new Error(cfgRes.error.message)
  if (smsRes.error) throw new Error(smsRes.error.message)

  await db.from('audit_logs').insert({
    action,
    actor_id: actorId,
    entity_type: 'app_settings',
    entity_id: NOTIFICATION_CONFIG_KEY,
    details: config,
  })
}

export async function handleNotificationConfigRequest(req, res) {
  setCors(res, 'GET, POST, PUT, PATCH, OPTIONS', req)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  const token = bearer(req)
  if (!token) return json(res, 401, { error: 'Unauthorized' }, req)
  const db = admin()
  const staff = await resolveActiveStaff(db, token, { select: 'id, role, is_active, full_name, phone' })
  if (!staff || !NOTIFICATION_CONFIG_ROLES.has(staff.role)) {
    return json(res, 403, { error: 'Forbidden' }, req)
  }

  const isSuperAdmin = staff.role === 'BossMich'

  if (req.method === 'GET') {
    const [config, diagnostics] = await Promise.all([
      loadNotificationConfig(db),
      gatherNotificationDiagnostics(db, { isSuperAdmin, callerId: staff.id }),
    ])
    return json(res, 200, {
      config,
      can_edit: isSuperAdmin,
      ...diagnostics,
    }, req)
  }

  if (!isSuperAdmin) {
    return json(res, 403, { error: 'Only the Super Admin / Owner can update or test notification configuration.' }, req)
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const body = await readJsonBody(req)
    const current = await loadNotificationConfig(db)
    const validated = validateNotificationConfigPatch(body?.config ?? body, current)
    if (!validated.ok) return json(res, 400, { error: validated.error }, req)

    try {
      await persistNotificationConfig(db, validated.config, staff.id, 'notification_config_updated')
      return json(res, 200, {
        ok: true,
        config: validated.config,
        sms_enabled: validated.config.sms_enabled,
      }, req)
    } catch (err) {
      return json(res, 500, { error: String(err?.message || err) }, req)
    }
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req)
    if (body?.action === 'reset_defaults') {
      const defaults = createDefaultNotificationConfig()
      try {
        await persistNotificationConfig(db, defaults, staff.id, 'notification_config_reset')
        return json(res, 200, { ok: true, config: defaults, sms_enabled: defaults.sms_enabled }, req)
      } catch (err) {
        return json(res, 500, { error: String(err?.message || err) }, req)
      }
    }

    if (body?.action === 'send_status_sms_test') {
      const targetPhone = normalizePhMobile(body.phone || staff.phone)
      if (!targetPhone || targetPhone.length < 12) {
        return json(res, 400, { error: 'Enter a valid Philippine mobile number (e.g. 09171234567) for verification.' }, req)
      }

      const sinceIso = new Date(Date.now() - COOLDOWN_MS).toISOString()
      const { data: recentProbe } = await db
        .from('sms_events')
        .select('id, created_at')
        .eq('event_type', 'sa_status_sms_test')
        .gte('created_at', sinceIso)
        .limit(1)
        .maybeSingle()
      if (recentProbe?.id) {
        return json(res, 429, { error: 'Please wait 20 seconds between status SMS verification tests.' }, req)
      }

      const currentConfig = await loadNotificationConfig(db)
      const message =
        'Hakum Auto Care: Super Admin Status SMS verification test passed (Detailing, Services & Packages updates active).'
      const sms = await busybeeSendSms({
        phone: targetPhone,
        message,
        senderId: currentConfig.sms_sender_id,
      })

      await db.from('sms_events').insert({
        phone: targetPhone,
        message,
        event_type: 'sa_status_sms_test',
        provider: 'busybee',
        status: sms.status,
        provider_response: sms.providerResponse || null,
        sent_at: sms.ok ? new Date().toISOString() : null,
      })

      await db.from('audit_logs').insert({
        action: 'notification_status_sms_test',
        actor_id: staff.id,
        entity_type: 'sms_events',
        entity_id: maskPhoneSuffix(targetPhone),
        details: { ok: sms.ok, status: sms.status, senderId: currentConfig.sms_sender_id },
      })

      const freshBalance = await busybeeBalance().catch(() => null)
      return json(res, sms.ok ? 200 : 502, {
        ok: sms.ok,
        sms,
        provider_health: freshBalance ? { ...freshBalance, redacted: false } : null,
      }, req)
    }

    if (body?.action === 'test_vapid_push') {
      const vapid = diagnoseVapidConfig()
      if (!vapid.configured || !vapid.valid) {
        return json(
          res,
          400,
          {
            ok: false,
            error: vapid.error || 'VAPID keys are not configured on the server.',
            vapid,
          },
          req,
        )
      }

      const rawPlatform = String(body.platform || 'all').toLowerCase()
      const platform = ['web', 'android', 'ios', 'all'].includes(rawPlatform) ? rawPlatform : 'all'
      const scope = body.scope === 'staff' ? 'staff' : 'self'
      let targetUserIds = [staff.id]
      if (scope === 'staff') {
        const { data: staffRows } = await db
          .from('push_subscriptions')
          .select('user_id')
          .in('role', ['BossMich', 'assistant_super_admin', 'admin', 'team_lead', 'ops_lead', 'marketing', 'sales', 'detailer', 'washer', 'brand_ambassador', 'finance'])
        const staffIds = [...new Set((staffRows || []).map((r) => r.user_id).filter(Boolean))]
        targetUserIds = staffIds.length ? staffIds : [staff.id]
      }

      const platformLabel =
        platform === 'ios' ? 'Mobile iOS' : platform === 'android' ? 'Mobile Android' : platform === 'web' ? 'Web Browser' : 'All Platforms'
      const title = `Hakum VAPID Test · ${platformLabel}`
      const msgBody = `Live Web Push verification for ${platformLabel} (${scope === 'staff' ? 'Enrolled Staff' : 'Super Admin'}).`
      const tag = `vapid-test-${platform}-${Date.now()}`
      const pushResult = await sendWebPushToUsers({
        userIds: targetUserIds,
        title,
        body: msgBody,
        url: '/operations/notifications?tab=settings',
        tag,
        kind: 'self_test',
        platform,
      })

      let inboxRow = null
      if (body.includeInbox !== false && pushResult.subscriptions > 0) {
        const { data: inserted } = await db
          .from('user_notifications')
          .insert({
            user_id: staff.id,
            kind: 'self_test',
            title,
            body: msgBody,
            url: '/operations/notifications?tab=settings',
            tag,
          })
          .select('id, title, body, url, kind, created_at')
          .maybeSingle()
        inboxRow = inserted || null
      }

      await db.from('audit_logs').insert({
        action: 'notification_vapid_push_test',
        actor_id: staff.id,
        entity_type: 'push_subscriptions',
        entity_id: platform,
        details: {
          scope,
          platform,
          subscriptions: pushResult.subscriptions,
          sent: pushResult.sent,
          failed: pushResult.failed,
          pruned: pushResult.pruned,
        },
      })

      return json(res, 200, {
        ok: true,
        vapid,
        scope,
        notification: inboxRow,
        ...pushResult,
      }, req)
    }

    if (body?.action === 'test_in_app') {
      const tag = `in-app-test-${Date.now()}`
      const title = 'Hakum In-App Notification Test'
      const msgBody = 'Realtime bell badge, sound chime, and foreground toast banner verified.'
      const { data: inserted, error: insErr } = await db
        .from('user_notifications')
        .insert({
          user_id: staff.id,
          kind: 'in_app_test',
          title,
          body: msgBody,
          url: '/operations/notifications?tab=settings',
          tag,
        })
        .select('id, user_id, kind, title, body, url, tag, created_at')
        .single()
      if (insErr) return json(res, 500, { error: insErr.message }, req)

      await db.from('audit_logs').insert({
        action: 'notification_in_app_test',
        actor_id: staff.id,
        entity_type: 'user_notifications',
        entity_id: inserted.id,
        details: { kind: inserted.kind },
      })

      return json(res, 200, {
        ok: true,
        notification: inserted,
      }, req)
    }

    return json(res, 400, { error: 'Unsupported action' }, req)
  }

  return json(res, 405, { error: 'Method not allowed' }, req)
}
