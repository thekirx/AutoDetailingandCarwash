import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  BUSYBEE_PUSH_BODY_MAX,
  BUSYBEE_PUSH_TITLE_MAX,
  BUSYBEE_SMS_MULTIPART_MAX,
  BUSYBEE_SMS_SINGLE_MAX,
  analyzeBusybeeSms,
  validateNotificationCopy,
} from '../src/lib/notificationCopy.js'
import {
  SYSTEM_TEMPLATES,
  mergeNotificationTemplates,
  templateByKey,
} from '../src/lib/notificationTemplates.js'
import { resolveBroadcastDispatch } from '../server/broadcastAudience.mjs'
import { validateSystemTemplatePatch } from '../server/notificationTemplatesApi.mjs'
import { validateSmsTemplatePayload } from '../server/smsTemplatesApi.mjs'
import { buildOpsEventCopy } from '../server/notifyOpsEvent.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(resolve(root, p), 'utf8')

describe('BusyBee SMS & Push strict character validation', () => {
  it('enforces 160-char GSM-7 default and allows opt-in multi-part up to 306', () => {
    const okSingle = analyzeBusybeeSms('A'.repeat(BUSYBEE_SMS_SINGLE_MAX))
    assert.equal(okSingle.ok, true)
    assert.equal(okSingle.encoding, 'GSM-7')
    assert.equal(okSingle.credits, 1)

    const overDefault = analyzeBusybeeSms('A'.repeat(BUSYBEE_SMS_SINGLE_MAX + 1), { allowMultiPart: false })
    assert.equal(overDefault.ok, false)
    assert.match(overDefault.error, /160/)

    const okMulti = analyzeBusybeeSms('A'.repeat(BUSYBEE_SMS_MULTIPART_MAX), { allowMultiPart: true })
    assert.equal(okMulti.ok, true)
    assert.equal(okMulti.credits, 2)

    const overMulti = analyzeBusybeeSms('A'.repeat(BUSYBEE_SMS_MULTIPART_MAX + 1), { allowMultiPart: true })
    assert.equal(overMulti.ok, false)
    assert.match(overMulti.error, /306/)
  })

  it('detects UCS-2 Unicode characters and reports carrier 70-char segmentation warning', () => {
    const unicode = analyzeBusybeeSms('Hakum Auto Care promo — ₱500 off ceramic! 🚗', { allowMultiPart: false })
    assert.equal(unicode.ok, true)
    assert.equal(unicode.encoding, 'UCS-2')
    assert.equal(unicode.hasUnicode, true)
    assert.match(unicode.warning, /70 chars/)
  })

  it('rejects oversized Push titles (>65) and bodies (>200) via validateNotificationCopy', () => {
    assert.equal(
      validateNotificationCopy({ channel: 'push', title: 'T'.repeat(BUSYBEE_PUSH_TITLE_MAX + 1), body: 'Hi' }).ok,
      false,
    )
    assert.equal(
      validateNotificationCopy({ channel: 'push', title: 'Hi', body: 'B'.repeat(BUSYBEE_PUSH_BODY_MAX + 1) }).ok,
      false,
    )
    assert.equal(
      validateNotificationCopy({ channel: 'push', title: 'Notice', body: 'Team update today' }).ok,
      true,
    )
  })
})

describe('System templates catalog trigger linkage & server validators', () => {
  it('includes ops system event templates with trigger_event, trigger_route, and recipient_summary', () => {
    for (const key of [
      'ops.crew_assigned',
      'ops.sheet_submitted',
      'ops.sheet_reviewed',
      'ops.cash_advance_submitted',
      'ops.cash_advance_approved',
      'ops.attendance_location_alert',
      'ops.booking_reschedule',
      'ops.review',
      'ops.complaint',
    ]) {
      assert.ok(templateByKey(key), `${key} must be registered`)
    }
    const merged = mergeNotificationTemplates([
      { key: 'booking.confirmed.customer', title: 'Custom title', sms_body: 'Custom SMS', allow_multipart: true },
    ])
    for (const row of merged) {
      assert.ok(row.trigger_event, `${row.key} missing trigger_event`)
      assert.ok(row.trigger_route?.startsWith('/'), `${row.key} missing trigger_route`)
      assert.ok(row.recipient_summary, `${row.key} missing recipient_summary`)
    }
    assert.equal(merged.length, SYSTEM_TEMPLATES.length)
    const edited = merged.find((r) => r.key === 'booking.confirmed.customer')
    assert.equal(edited.has_override, true)
    assert.equal(edited.allow_multipart, true)
  })

  it('allows custom SA overrides in buildOpsEventCopy', () => {
    const custom = buildOpsEventCopy(
      'crew_assigned',
      { bookingId: 'b1', plate: 'XYZ-99', service: 'Wash', branchName: 'Bacoor' },
      { has_override: true, title: 'Car ready: {plate}', body: '{service} waiting @ {branch}' },
    )
    assert.equal(custom.title, 'Car ready: XYZ-99')
    assert.equal(custom.body, 'Wash waiting @ Bacoor')
  })

  it('validates system template patches cleanly and blocks >160 SMS unless allow_multipart is opted in', () => {
    const sys = templateByKey('booking.confirmed.customer')
    assert.equal(
      validateSystemTemplatePatch(sys, { sms_body: 'X'.repeat(170), allow_multipart: false }).ok,
      false,
    )
    assert.equal(
      validateSystemTemplatePatch(sys, { sms_body: 'X'.repeat(170), allow_multipart: true }).ok,
      true,
    )
    const opsOnlyPush = templateByKey('ops.crew_assigned')
    assert.equal(
      validateSystemTemplatePatch(opsOnlyPush, { title: 'Hi', body: 'Ready', allow_multipart: true }).ok,
      false,
    )
  })

  it('validates reusable SMS template CRUD payloads against BusyBee rules', () => {
    assert.equal(
      validateSmsTemplatePayload({ name: 'Promo', template_type: 'promo', body: 'X'.repeat(161) }).ok,
      false,
    )
    assert.equal(
      validateSmsTemplatePayload({
        name: 'Long Promo',
        template_type: 'promo',
        body: 'X'.repeat(220),
        allow_multipart: true,
      }).ok,
      true,
    )
    assert.equal(
      validateSmsTemplatePayload({ name: 'Bad', template_type: 'unknown_kind', body: 'Hello' }).ok,
      false,
    )
  })
})

describe('Employee / Customer / Both broadcast dispatch & UI wiring contracts', () => {
  it('blocks Marketing (403) from targeting employees or both while allowing SA/ASA', () => {
    const mktEmp = resolveBroadcastDispatch({ audience_group: 'employees', channel: 'push', staffRole: 'marketing' })
    assert.equal(mktEmp.ok, false)
    assert.equal(mktEmp.status, 403)

    const mktBoth = resolveBroadcastDispatch({ audience_group: 'both', channel: 'push', staffRole: 'marketing' })
    assert.equal(mktBoth.ok, false)
    assert.equal(mktBoth.status, 403)

    const mktCust = resolveBroadcastDispatch({ audience_group: 'customers', target_audience: 'all', channel: 'push', staffRole: 'marketing' })
    assert.equal(mktCust.ok, true)

    const saEmpSms = resolveBroadcastDispatch({ audience_group: 'employees', channel: 'sms', staffRole: 'BossMich' })
    assert.equal(saEmpSms.ok, false)
    assert.equal(saEmpSms.status, 400)

    const custSmsBroadcast = resolveBroadcastDispatch({ audience_group: 'customers', target_audience: 'all', channel: 'sms', staffRole: 'BossMich' })
    assert.equal(custSmsBroadcast.ok, false)
    assert.equal(custSmsBroadcast.status, 400)

    const saRoles = resolveBroadcastDispatch({
      audience_group: 'employees',
      employee_scope: 'roles',
      employee_roles: ['detailer', 'team_lead'],
      channel: 'push',
      staffRole: 'assistant_super_admin',
    })
    assert.equal(saRoles.ok, true)
    assert.deepEqual(saRoles.employeeRoles, ['detailer', 'team_lead'])
  })

  it('wires Settings tile, NotificationTemplatesPanel Reset/Preview, Broadcast CRUD, and SMS templates API', () => {
    const settings = read('src/pages/SettingsHubPage.jsx')
    assert.match(settings, /\/operations\/notifications\?tab=templates/)
    assert.match(settings, /Notifications & SMS/)

    const tplPanel = read('src/pages/notifications/NotificationTemplatesPanel.jsx')
    assert.match(tplPanel, /Reset to default/)
    assert.match(tplPanel, /analyzeBusybeeSms/)
    assert.match(tplPanel, /Rendered preview/)

    const notifPage = read('src/pages/NotificationsPage.jsx')
    assert.match(notifPage, /Employees & Customers/)
    assert.match(notifPage, /method: 'PATCH'/)
    assert.match(notifPage, /method: 'DELETE'/)

    const smsPage = read('src/pages/SmsPage.jsx')
    assert.match(smsPage, /\/api\/notifications\?operation=sms-templates/)
    assert.match(smsPage, /analyzeBusybeeSms/)
    assert.match(smsPage, /Manual &amp; promo SMS disabled/)

    const lifecycle = read('server/lifecycleSms.mjs')
    assert.match(lifecycle, /status_sms_only/)
    const busybeeApi = read('server/busybeeApi.mjs')
    assert.match(busybeeApi, /Manual and promo SMS sending is disabled/)

    assert.match(notifPage, /isSuperAdmin\(profile\)/)
    assert.match(notifPage, /\/api\/busybee/)
    assert.match(notifPage, /BusyBee BrandTxt SMS Balance/)
    assert.equal(templateByKey('birthday.greeting')?.channel, 'push')
    assert.equal(templateByKey('lifecycle.welcome_app')?.channel, 'push')
    assert.equal(templateByKey('reminder.paint_maintenance')?.channel, 'push')
    assert.equal(templateByKey('booking.confirmed.customer')?.channel, 'both')
  })
})
