/**
 * Read-only diagnostics aggregator for Super Admin / ASA Notification Settings:
 * aggregates Web Push enrollment coverage across roles, active rules/templates counts,
 * live BusyBee credit balance, and masked recent SMS delivery telemetry.
 */
import { busybeeBalance } from './busybee.mjs'
import { loadAutomationState, sanitizeAutomationState } from './automationState.mjs'
import { diagnoseVapidConfig } from './webPush.mjs'
import { emptyPlatformCounts, summarizeSubscriptionsByPlatform } from '../src/lib/pushPlatform.js'
import { DEFAULT_NOTIFICATION_CONFIG } from '../src/lib/notificationConfig.js'

const ROLE_LABELS = Object.freeze({
  BossMich: 'Super Admin / Owner',
  assistant_super_admin: 'Assistant Super Admin',
  ops_lead: 'Ops Lead',
  admin: 'Branch Admin',
  team_lead: 'Team Lead',
  marketing: 'Marketing',
  finance: 'Finance / Audit',
  sales: 'Sales & Concierge',
  detailer: 'Detailer',
  washer: 'Washer',
  brand_ambassador: 'Brand Ambassador',
  customer: 'Customers',
})

export function maskPhoneSuffix(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length < 4) return '—'
  return `•••${digits.slice(-4)}`
}

export async function gatherNotificationDiagnostics(db, { isSuperAdmin, callerId }) {
  const [staffRes, pushRes, custPushCountRes, remindersRes, templatesRes, rawAutomationState] = await Promise.all([
    db.from('staff_profiles').select('id, role, full_name, phone').eq('is_active', true).eq('is_archived', false),
    db.from('push_subscriptions').select('user_id, endpoint, user_agent, updated_at'),
    db.from('customers').select('id', { count: 'exact', head: true }).eq('is_disabled', false).eq('is_archived', false),
    db.from('notification_settings').select('id', { count: 'exact', head: true }).eq('enabled', true),
    db.from('notification_templates').select('key', { count: 'exact', head: true }),
    loadAutomationState(db),
  ])

  const staffRows = staffRes?.data || []
  const pushRows = pushRes?.data || []
  const staffById = new Map(staffRows.map((s) => [s.id, s]))

  const roleAgg = new Map()
  for (const role of Object.keys(ROLE_LABELS)) {
    if (role === 'customer') continue
    roleAgg.set(role, { role, label: ROLE_LABELS[role], active_users: 0, subscribed_users: new Set(), subscriptions: 0 })
  }
  for (const s of staffRows) {
    const entry = roleAgg.get(s.role) || {
      role: s.role,
      label: ROLE_LABELS[s.role] || s.role,
      active_users: 0,
      subscribed_users: new Set(),
      subscriptions: 0,
    }
    entry.active_users += 1
    roleAgg.set(s.role, entry)
  }

  const customerSubscribedUsers = new Set()
  let customerSubCount = 0
  let staffSubCount = 0
  const staffPlatformCounts = emptyPlatformCounts()
  const customerPlatformCounts = emptyPlatformCounts()
  const callerRows = []
  const staffSubRows = []
  for (const p of pushRows) {
    if (p.user_id === callerId) callerRows.push(p)
    const s = staffById.get(p.user_id)
    if (s) {
      staffSubCount += 1
      staffSubRows.push(p)
      const entry = roleAgg.get(s.role)
      if (entry) {
        entry.subscriptions += 1
        entry.subscribed_users.add(p.user_id)
      }
    } else {
      customerSubCount += 1
      customerSubscribedUsers.add(p.user_id)
    }
  }
  Object.assign(staffPlatformCounts, summarizeSubscriptionsByPlatform(staffSubRows).counts)
  Object.assign(
    customerPlatformCounts,
    summarizeSubscriptionsByPlatform(pushRows.filter((p) => !staffById.has(p.user_id))).counts,
  )
  const callerPlatforms = summarizeSubscriptionsByPlatform(callerRows).counts
  const allPlatforms = summarizeSubscriptionsByPlatform(pushRows).counts
  const vapid = diagnoseVapidConfig()

  const byRole = [
    ...[...roleAgg.values()]
      .filter((r) => r.active_users > 0 || r.subscriptions > 0)
      .map((r) => ({
        role: r.role,
        label: r.label,
        active_users: r.active_users,
        subscribed_users: r.subscribed_users.size,
        subscriptions: r.subscriptions,
      })),
    {
      role: 'customer',
      label: ROLE_LABELS.customer,
      active_users: Number(custPushCountRes?.count || 0),
      subscribed_users: customerSubscribedUsers.size,
      subscriptions: customerSubCount,
    },
  ]

  let providerHealth = {
    configured: Boolean(process.env.BUSYBEE_API_KEY && process.env.BUSYBEE_CLIENT_ID),
    senderId: process.env.BUSYBEE_SENDER_ID || DEFAULT_NOTIFICATION_CONFIG.sms_sender_id,
    redacted: !isSuperAdmin,
  }
  let recentSmsEvents = []
  let callerPhone = null

  if (isSuperAdmin) {
    const caller = staffById.get(callerId)
    callerPhone = caller?.phone || null
    const [bal, eventsRes] = await Promise.all([
      busybeeBalance().catch((err) => ({ ok: false, configured: false, reason: String(err?.message || err) })),
      db
        .from('sms_events')
        .select('id, event_type, status, provider, provider_response, phone, created_at, sent_at')
        .order('created_at', { ascending: false })
        .limit(15),
    ])
    providerHealth = { ...bal, redacted: false }
    recentSmsEvents = (eventsRes?.data || []).map((ev) => ({
      id: ev.id,
      event_type: ev.event_type,
      status: ev.status,
      provider: ev.provider || 'busybee',
      provider_response: ev.provider_response || null,
      phone_masked: maskPhoneSuffix(ev.phone),
      created_at: ev.created_at,
      sent_at: ev.sent_at,
    }))
  }

  return {
    provider_health: providerHealth,
    push_stats: {
      total_subscriptions: pushRows.length,
      staff_subscriptions: staffSubCount,
      customer_subscriptions: customerSubCount,
      vapid_configured: vapid.configured && vapid.valid,
      vapid,
      by_platform: allPlatforms,
      staff_platforms: staffPlatformCounts,
      customer_platforms: customerPlatformCounts,
      caller_platforms: callerPlatforms,
      by_role: byRole,
    },
    automation_summary: {
      active_reminder_rules: Number(remindersRes?.count || 0),
      customized_templates: Number(templatesRes?.count || 0),
    },
    automation_state: sanitizeAutomationState(rawAutomationState),
    recent_sms_events: recentSmsEvents,
    caller_phone: callerPhone,
  }
}
