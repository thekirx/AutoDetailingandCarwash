/**
 * Shared paint-maintenance reminder send (cron + ops manual send).
 */
import { busybeeSendSms } from './busybee.mjs'
import { sendWebPushToUsers } from './webPush.mjs'
import { renderNotificationMessage } from '../src/lib/notificationCopy.js'
import { PAINT_MAINTENANCE_SLUG } from '../src/lib/paintMaintenance.js'

function settingFor(settings, servicesBySlug, serviceSlug, branchSlug, programKey) {
  const lookupSlugs = []
  if (
    programKey === 'paint_maintenance' ||
    String(serviceSlug).includes('ceramic') ||
    String(serviceSlug).includes('paint-protection')
  ) {
    lookupSlugs.push(PAINT_MAINTENANCE_SLUG)
  }
  lookupSlugs.push(String(serviceSlug || '').toLowerCase())

  const rows = settings || []
  for (const slug of lookupSlugs) {
    const svc = servicesBySlug.get(slug)
    const svcId = svc?.id || null
    if (!svcId && slug !== String(serviceSlug || '').toLowerCase()) continue
    const match =
      rows.find((s) => s.scope === 'per_service_branch' && s.service_id === svcId && s.branch_slug === branchSlug) ||
      rows.find((s) => s.scope === 'per_service' && s.service_id === svcId)
    if (match) return match
  }
  return (
    rows.find((s) => s.scope === 'per_branch' && s.branch_slug === branchSlug) ||
    rows.find((s) => s.scope === 'whole') ||
    { channel: 'both', title: null, message: null }
  )
}

/**
 * Send push/SMS for one schedule row and mark notified (unless dryRun).
 * @param {object} opts
 * @param {import('@supabase/supabase-js').SupabaseClient} opts.db
 * @param {object} opts.row vehicle_maintenance_schedules row
 * @param {object[]} [opts.settings] notification_settings
 * @param {Map<string, {id:string,slug:string,name:string}>} [opts.servicesBySlug]
 * @param {boolean} [opts.force] allow re-send when status=notified
 * @param {boolean} [opts.markNotified=true]
 */
export async function sendPaintMaintenanceReminder({
  db,
  row,
  settings = null,
  servicesBySlug = null,
  force = false,
  markNotified = true,
}) {
  if (!row?.id) return { ok: false, error: 'missing_row' }
  if (!force && row.status !== 'scheduled') {
    return { ok: false, error: 'not_scheduled', status: row.status }
  }

  let settingRows = settings
  if (!settingRows) {
    const { data } = await db
      .from('notification_settings')
      .select('scope, service_id, branch_slug, channel, frequency_months, enabled, title, message')
      .eq('enabled', true)
    settingRows = data || []
  }

  let bySlug = servicesBySlug
  if (!bySlug) {
    const { data: services } = await db.from('services').select('id, slug, name')
    bySlug = new Map((services || []).map((s) => [String(s.slug || '').toLowerCase(), s]))
  }

  const setting = settingFor(settingRows, bySlug, row.service_slug, row.branch_slug, row.program_key)
  const channel = setting.channel || 'both'
  const svc =
    bySlug.get(PAINT_MAINTENANCE_SLUG) || bySlug.get(String(row.service_slug || '').toLowerCase())
  const title =
    String(setting.title || '').trim() || 'Hakum Auto Care: Time for paint maintenance'
  const message = renderNotificationMessage(setting.message, {
    plate: row.plate_number,
    service: svc?.name || 'Paint Maintenance',
    name: row.customer_name,
    branch: row.branch_slug,
  })

  const result = { ok: true, push: null, sms: null, title, message }

  if (channel === 'push' || channel === 'both') {
    if (row.customer_id) {
      try {
        result.push = await sendWebPushToUsers({
          userIds: [row.customer_id],
          title,
          body: message,
          url: '/book',
          tag: `maintenance-${row.id}-${row.next_due_at}`,
          kind: 'maintenance_reminder',
        })
      } catch (err) {
        result.push = { ok: false, error: String(err?.message || err) }
      }
    } else {
      result.push = { ok: false, status: 'no_customer_id' }
    }
  }

  if (channel === 'sms' || channel === 'both') {
    if (row.customer_phone) {
      try {
        await busybeeSendSms({
          phone: row.customer_phone,
          message: `${title}\n${message}`.slice(0, 160),
        })
        result.sms = { ok: true }
      } catch (err) {
        result.sms = { ok: false, error: String(err?.message || err) }
      }
    } else {
      result.sms = { ok: false, status: 'no_phone' }
    }
  }

  if (markNotified) {
    const { error: upErr } = await db
      .from('vehicle_maintenance_schedules')
      .update({ status: 'notified', last_notified_at: new Date().toISOString() })
      .eq('id', row.id)
    if (upErr) result.markError = upErr.message
  }

  return result
}
