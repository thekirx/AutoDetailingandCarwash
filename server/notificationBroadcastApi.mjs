import { busybeeSendSms } from './busybee.mjs'
import { deliverUserNotifications } from './webPush.mjs'
import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'
import {
  renderNotificationMessage,
  validateNotificationCopy,
} from '../src/lib/notificationCopy.js'
import { isSmsNotificationsEnabled } from './notifyBooking.mjs'
import { safeNotificationPath } from './notificationTargetUrl.mjs'
import { resolveBroadcastAudience, resolveBroadcastDispatch } from './broadcastAudience.mjs'
import { adminClient as admin } from './supabaseAdmin.mjs'

const ALLOWED = new Set(['BossMich', 'assistant_super_admin', 'marketing'])
const ADMIN_MANAGE_ROLES = new Set(['BossMich', 'assistant_super_admin'])

const BROADCAST_SELECT_EXTENDED =
  'id, kind, channel, title, body, url, target_audience, audience_group, employee_scope, employee_roles, allow_multipart, branch_slug, sent_count, failed_count, sent_at, updated_at'
const BROADCAST_SELECT_LEGACY =
  'id, kind, channel, title, body, url, target_audience, branch_slug, sent_count, failed_count, sent_at'

function firstName(fullName) {
  const raw = String(fullName || '').trim()
  if (!raw) return 'there'
  return raw.split(/\s+/)[0]
}

async function loadStaff(db, token) {
  const { data: userData, error: userErr } = await db.auth.getUser(token)
  if (userErr || !userData?.user) return null
  const { data: staff } = await db
    .from('staff_profiles')
    .select('id, role, is_active, branch_slug')
    .eq('id', userData.user.id)
    .eq('is_active', true)
    .maybeSingle()
  return staff
}

async function selectBroadcastHistory(db, staffRole) {
  let q = db
    .from('notification_broadcasts')
    .select(BROADCAST_SELECT_EXTENDED)
    .order('sent_at', { ascending: false })
    .limit(30)
  if (!ADMIN_MANAGE_ROLES.has(staffRole)) {
    q = q.eq('audience_group', 'customers')
  }
  let { data, error } = await q
  if (error && /column .* does not exist/i.test(error.message || '')) {
    const legacy = await db
      .from('notification_broadcasts')
      .select(BROADCAST_SELECT_LEGACY)
      .order('sent_at', { ascending: false })
      .limit(30)
    data = legacy.data
    error = legacy.error
  }
  return { data: data || [], error }
}

async function resolveEmployeeIds(db, { employeeScope, employeeRoles, branchSlug }) {
  let q = db
    .from('staff_profiles')
    .select('id, full_name, role, branch_slug, is_active')
    .eq('is_active', true)

  if (employeeScope === 'roles' && employeeRoles.length) {
    q = q.in('role', employeeRoles)
  }

  const { data: staffRows, error } = await q.limit(1000)
  if (error) return { error: error.message, rows: [] }
  let rows = staffRows || []

  if (employeeScope === 'branch' && branchSlug && rows.length) {
    const want = String(branchSlug).toLowerCase()
    const { data: extra } = await db
      .from('staff_branch_assignments')
      .select('staff_id, branch_slug')
      .in('staff_id', rows.map((r) => r.id))
    const byStaff = new Map()
    for (const a of extra || []) {
      const list = byStaff.get(a.staff_id) || []
      list.push(String(a.branch_slug || '').toLowerCase())
      byStaff.set(a.staff_id, list)
    }
    rows = rows.filter(
      (r) =>
        String(r.branch_slug || '').toLowerCase() === want ||
        (byStaff.get(r.id) || []).includes(want),
    )
  }

  return { rows, error: null }
}

/**
 * GET    /api/notification-broadcast        — list recent broadcasts
 * POST   /api/notification-broadcast        — send custom push / announcement / SMS broadcast
 * PATCH  /api/notification-broadcast        — update saved broadcast metadata (SA / ASA)
 * DELETE /api/notification-broadcast?id=... — delete broadcast record (SA / ASA)
 */
export async function handleNotificationBroadcastRequest(req, res) {
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
    const { data, error } = await selectBroadcastHistory(db, staff.role)
    if (error) return json(res, 400, { error: error.message })
    return json(res, 200, {
      broadcasts: data,
      can_target_employees: ADMIN_MANAGE_ROLES.has(staff.role),
      can_manage_history: ADMIN_MANAGE_ROLES.has(staff.role),
    })
  }

  if (req.method === 'PATCH') {
    if (!ADMIN_MANAGE_ROLES.has(staff.role)) {
      return json(res, 403, { error: 'Only Super Admin or Assistant Super Admin can edit broadcasts.' })
    }
    const body = await readJsonBody(req)
    const id = String(body.id || '').trim()
    if (!id) return json(res, 400, { error: 'id is required.' })

    const { data: existing, error: findErr } = await db
      .from('notification_broadcasts')
      .select('id, channel, title, body, url, kind, audience_group, allow_multipart')
      .eq('id', id)
      .maybeSingle()
    if (findErr && /column .* does not exist/i.test(findErr.message || '')) {
      return json(res, 400, { error: 'Run the latest Supabase notifications migration to edit broadcast records.' })
    }
    if (findErr) return json(res, 400, { error: findErr.message })
    if (!existing) return json(res, 404, { error: 'Broadcast not found.' })

    const nextTitle = body.title !== undefined ? String(body.title || '').trim() : existing.title
    const nextBody = body.body !== undefined ? String(body.body || '').trim() : existing.body
    const allowMultiPart =
      typeof body.allow_multipart === 'boolean'
        ? body.allow_multipart
        : Boolean(existing.allow_multipart)

    const copyCheck = validateNotificationCopy({
      channel: existing.channel || 'push',
      title: nextTitle,
      body: nextBody,
      allowMultiPart,
      requireTitle: true,
      requireBody: true,
    })
    if (!copyCheck.ok) return json(res, 400, { error: copyCheck.error })

    const patch = {
      title: nextTitle,
      body: nextBody,
      kind: body.kind ? String(body.kind).trim() : existing.kind,
      url: body.url !== undefined ? safeNotificationPath(body.url, '/account') : existing.url,
      allow_multipart: allowMultiPart,
      updated_at: new Date().toISOString(),
    }
    const { data: updated, error: updErr } = await db
      .from('notification_broadcasts')
      .update(patch)
      .eq('id', id)
      .select(BROADCAST_SELECT_EXTENDED)
      .single()
    if (updErr) return json(res, 400, { error: updErr.message })
    return json(res, 200, { broadcast: updated })
  }

  if (req.method === 'DELETE') {
    if (!ADMIN_MANAGE_ROLES.has(staff.role)) {
      return json(res, 403, { error: 'Only Super Admin or Assistant Super Admin can delete broadcasts.' })
    }
    const url = new URL(req.url, 'http://localhost')
    const id = String(url.searchParams.get('id') || '').trim()
    if (!id) return json(res, 400, { error: 'id is required.' })
    const { data, error } = await db
      .from('notification_broadcasts')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle()
    if (error) return json(res, 400, { error: error.message })
    if (!data) return json(res, 404, { error: 'Broadcast not found.' })
    return json(res, 200, { deleted: id })
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  const body = await readJsonBody(req)
  const channel = ['push', 'sms', 'both'].includes(body.channel) ? body.channel : 'push'
  const allowMultiPart = Boolean(body.allow_multipart)
  const title = String(body.title || '').trim()
  const message = String(body.body || '').trim()
  if (!title || !message) return json(res, 400, { error: 'title and body are required' })

  const copyCheck = validateNotificationCopy({
    channel,
    title,
    body: message,
    allowMultiPart,
    requireTitle: true,
    requireBody: true,
  })
  if (!copyCheck.ok) {
    return json(res, 400, { error: copyCheck.error })
  }

  const dispatch = resolveBroadcastDispatch({
    audience_group: body.audience_group,
    target_audience: body.target_audience,
    branch_slug: body.branch_slug,
    employee_scope: body.employee_scope,
    employee_roles: body.employee_roles,
    channel,
    staffRole: staff.role,
  })
  if (!dispatch.ok) {
    return json(res, dispatch.status || 400, { error: dispatch.error })
  }

  const resolved = resolveBroadcastAudience(body.target_audience, body.branch_slug)
  if (!resolved.ok) {
    // Refuse rather than widen. "One branch" with no branch used to fall past
    // the compound guard below and message every customer in the company.
    if (dispatch.audienceGroup !== 'employees') {
      return json(res, 400, { error: resolved.error })
    }
  }

  const targetAudience = dispatch.audienceGroup === 'employees' ? 'all' : resolved.audience
  const branchSlug = dispatch.branchSlug

  const wantsSms =
    (channel === 'sms' || channel === 'both') && dispatch.audienceGroup !== 'employees'
  if (wantsSms && !(await isSmsNotificationsEnabled(db))) {
    return json(res, 400, { error: 'Shop SMS is turned off. Enable SMS notifications first.' })
  }

  let sent = 0
  let failed = 0
  let skipped = 0
  let customerSent = 0
  let employeeSent = 0
  const broadcastKind = String(body.kind || 'promo').trim() || 'promo'

  if (dispatch.audienceGroup === 'customers' || dispatch.audienceGroup === 'both') {
    const phoneAllow = new Set(
      (Array.isArray(body.phones) ? body.phones : [])
        .map((p) => String(p || '').replace(/\D/g, ''))
        .filter((d) => d.length >= 10),
    )

    let custQuery = db
      .from('customers')
      .select('id, phone, full_name, notify_sms, notify_push, is_disabled')
      .eq('role', 'customer')
      .eq('is_archived', false)
      .eq('is_disabled', false)

    let custEmpty = false
    if (targetAudience === 'branch') {
      const { data: bookingCusts } = await db
        .from('bookings')
        .select('customer_id')
        .eq('branch', branchSlug)
        .not('customer_id', 'is', null)
      const ids = (bookingCusts || []).map((b) => b.customer_id).filter(Boolean)
      if (!ids.length) custEmpty = true
      else custQuery = custQuery.in('id', ids)
    } else if (targetAudience === 'detailing' || targetAudience === 'wash') {
      const { data: svcRows } = await db
        .from('services')
        .select('id')
        .eq('pay_category', targetAudience)
      const svcIds = (svcRows || []).map((s) => s.id)
      if (!svcIds.length) {
        custEmpty = true
      } else {
        const { data: bookingCusts } = await db
          .from('bookings')
          .select('customer_id')
          .in('service_id', svcIds)
          .not('customer_id', 'is', null)
        const ids = [...new Set((bookingCusts || []).map((b) => b.customer_id).filter(Boolean))]
        if (!ids.length) custEmpty = true
        else custQuery = custQuery.in('id', ids)
      }
    }

    let audience = []
    if (!custEmpty) {
      const { data: customers, error: custErr } = await custQuery.limit(5000)
      if (custErr) return json(res, 400, { error: custErr.message })
      audience = customers || []
      if (phoneAllow.size) {
        audience = audience.filter((c) => phoneAllow.has(String(c.phone || '').replace(/\D/g, '')))
      }
    }

    if (audience.length && (channel === 'push' || channel === 'both')) {
      const userIds = audience.filter((c) => c.notify_push !== false).map((c) => c.id)
      skipped += audience.filter((c) => c.notify_push === false).length
      if (userIds.length) {
        const delivered = await deliverUserNotifications(db, {
          userIds,
          kind: broadcastKind,
          title,
          body: message,
          url: safeNotificationPath(body.url, '/account'),
          tag: broadcastKind,
          inbox: true,
          checkCustomerPrefs: false,
        })
        const pushCount = delivered.push?.sent || 0
        sent += pushCount
        customerSent += pushCount
        failed += delivered.push?.failed || 0
      }
    }

    if (audience.length && wantsSms) {
      const plateByCustomer = new Map()
      const audienceIds = audience.map((c) => c.id).filter(Boolean)
      if (audienceIds.length) {
        const { data: vehicles } = await db
          .from('vehicles')
          .select('customer_id, plate_number, updated_at')
          .in('customer_id', audienceIds)
          .eq('is_archived', false)
          .order('updated_at', { ascending: false })
          .limit(5000)
        for (const v of vehicles || []) {
          if (!plateByCustomer.has(v.customer_id) && v.plate_number) {
            plateByCustomer.set(v.customer_id, v.plate_number)
          }
        }
      }

      const smsTargets = []
      for (const c of audience) {
        if (c.notify_sms === false || !c.phone) {
          skipped += 1
          continue
        }
        smsTargets.push(c)
      }

      const SMS_CONCURRENCY = 4
      for (let i = 0; i < smsTargets.length; i += SMS_CONCURRENCY) {
        const batch = smsTargets.slice(i, i + SMS_CONCURRENCY)
        const settled = await Promise.allSettled(
          batch.map((c) => {
            const personalized = renderNotificationMessage(
              `${title}\n${message}`,
              {
                name: firstName(c.full_name),
                plate: plateByCustomer.get(c.id) || 'your car',
              },
              { keepMissing: true },
            )
            return busybeeSendSms({ phone: c.phone, message: personalized })
          }),
        )
        for (const resItem of settled) {
          if (resItem.status === 'fulfilled' && resItem.value?.ok !== false) {
            sent += 1
            customerSent += 1
          } else {
            failed += 1
          }
        }
      }
    }
  }

  // Employees strictly receive In-App Inbox + Web Push — NEVER BusyBee SMS.
  if (dispatch.audienceGroup === 'employees' || dispatch.audienceGroup === 'both') {
    const empRes = await resolveEmployeeIds(db, dispatch)
    if (empRes.error) return json(res, 400, { error: empRes.error })
    const staffIds = empRes.rows.map((r) => r.id).filter(Boolean)
    if (staffIds.length) {
      const staffUrlRaw = body.staff_url || (String(body.url || '').startsWith('/operations') ? body.url : '/operations/dashboard')
      const delivered = await deliverUserNotifications(db, {
        userIds: staffIds,
        kind: broadcastKind,
        title,
        body: message,
        url: safeNotificationPath(staffUrlRaw, '/operations/dashboard'),
        tag: `staff-${broadcastKind}`,
        inbox: true,
        checkCustomerPrefs: false,
      })
      const staffCount = Math.max(delivered.inbox?.inserted || 0, delivered.push?.sent || 0)
      sent += staffCount
      employeeSent += staffCount
      failed += delivered.push?.failed || 0
    }
  }

  const logRow = {
    kind: broadcastKind,
    channel: dispatch.audienceGroup === 'employees' ? 'push' : channel,
    title,
    body: message,
    url: safeNotificationPath(body.url, dispatch.audienceGroup === 'employees' ? '/operations/dashboard' : '/account') || null,
    target_audience: targetAudience,
    audience_group: dispatch.audienceGroup,
    employee_scope: dispatch.employeeScope,
    employee_roles: dispatch.employeeRoles,
    allow_multipart: allowMultiPart,
    branch_slug: branchSlug,
    sent_count: sent,
    failed_count: failed,
    sent_by: staff.id,
  }
  let { data: inserted, error: logErr } = await db
    .from('notification_broadcasts')
    .insert(logRow)
    .select(BROADCAST_SELECT_EXTENDED)
    .maybeSingle()
  if (logErr && /column .* does not exist|notification_broadcasts_kind_check/i.test(logErr.message || '')) {
    const legacyLog = {
      kind: ['promo', 'reminder', 'we_missed', 'aftercare', 'package_nudge', 'loyalty_nudge', 'thank_you', 'custom'].includes(broadcastKind)
        ? broadcastKind
        : 'custom',
      channel: logRow.channel,
      title,
      body: message,
      url: logRow.url,
      target_audience: targetAudience,
      branch_slug: branchSlug,
      sent_count: sent,
      failed_count: failed,
      sent_by: staff.id,
    }
    const retry = await db
      .from('notification_broadcasts')
      .insert(legacyLog)
      .select(BROADCAST_SELECT_LEGACY)
      .maybeSingle()
    inserted = retry.data
    logErr = retry.error
  }
  if (logErr) console.error('[broadcast] log failed', logErr.message)

  return json(res, 200, {
    sent,
    failed,
    skipped,
    customer_sent: customerSent,
    employee_sent: employeeSent,
    broadcast: inserted || null,
  })
}
