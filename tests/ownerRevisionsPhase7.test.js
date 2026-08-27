/**
 * Owner Revisions Phase 7 seams: vehicle icons, car-size/best sellers helpers,
 * chemical usage stub, resolveEffectiveRole, SLA overage, customer notify prefs.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { aggregateBestSellers } from '../src/lib/crmInsights.js'
import {
  VEHICLE_ICON_PRESETS,
  aggregateCarSizePerSale,
  aggregateChemicalUsageByWeek,
  chemicalUsageNeedsStub,
  customerNotifyAllowed,
  canCreateStaffRoleOverride,
  canRevokeStaffRoleOverride,
  isOverSla,
  normalizeVehicleIcon,
  resolveEffectiveRole,
} from '../src/lib/ownerRevisionsPhase7.js'
import { ROLES } from '../src/auth/permissions.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

describe('vehicle icon presets', () => {
  it('normalizes known keys and rejects junk', () => {
    assert.ok(VEHICLE_ICON_PRESETS.length >= 4)
    assert.equal(normalizeVehicleIcon('SUV'), 'suv')
    assert.equal(normalizeVehicleIcon('nope'), null)
  })
})

describe('floor board insights helpers', () => {
  it('aggregates car size per sale from bookings.vehicle_type', () => {
    const rows = aggregateCarSizePerSale([
      { total_minor: 10000, bookings: { vehicle_type: 'medium' } },
      { total_minor: 20000, vehicle_type: 'large' },
      { total_minor: 5000, bookings: { vehicle_type: 'medium' } },
    ])
    assert.equal(rows[0].size, 'medium')
    assert.equal(rows[0].count, 2)
    assert.equal(rows[0].total_minor, 15000)
  })

  it('pins best sellers via aggregateBestSellers', () => {
    const top = aggregateBestSellers(
      [
        { name: 'Wash', item_type: 'service', line_total_minor: 50000 },
        { name: 'Wash', item_type: 'service', line_total_minor: 30000 },
        { name: 'Coffee', item_type: 'product', line_total_minor: 10000 },
      ],
      2,
    )
    assert.equal(top[0].name, 'Wash')
    assert.equal(top[0].total, 800)
  })

  it('chemical usage charts from recon lines; empty → stub', () => {
    assert.equal(chemicalUsageNeedsStub([]), true)
    assert.equal(chemicalUsageNeedsStub([{ status: 'rejected' }]), true)
    const weeks = aggregateChemicalUsageByWeek(
      [
        {
          week_of: '2026-08-17',
          status: 'approved',
          inventory_recon_lines: [
            { product_id: 'p1', previous_qty: 40, leftover_qty: 28 },
          ],
        },
      ],
      { p1: { price_minor: 1000 } },
    )
    assert.equal(weeks.length, 1)
    assert.equal(weeks[0].usage_qty, 12)
    assert.equal(weeks[0].cost_minor, 12000)
    assert.equal(chemicalUsageNeedsStub([{ status: 'approved' }]), false)
  })
})

describe('resolveEffectiveRole', () => {
  it('applies team_lead override for that Manila day only', () => {
    const profile = { id: 's1', role: ROLES.STAFF, branch_slug: 'manila' }
    assert.equal(resolveEffectiveRole(profile, [], '2026-08-27'), ROLES.STAFF)
    assert.equal(
      resolveEffectiveRole(
        profile,
        [{ staff_id: 's1', role: ROLES.TEAM_LEAD, branch_slug: 'manila', on_date: '2026-08-27' }],
        '2026-08-27',
      ),
      ROLES.TEAM_LEAD,
    )
    assert.equal(
      resolveEffectiveRole(
        profile,
        [{ staff_id: 's1', role: ROLES.TEAM_LEAD, branch_slug: 'manila', on_date: '2026-08-26' }],
        '2026-08-27',
      ),
      ROLES.STAFF,
    )
  })

  it('SA/ASA/BA create; only SA revoke', () => {
    assert.equal(canCreateStaffRoleOverride({ role: ROLES.ADMIN }), true)
    assert.equal(canCreateStaffRoleOverride({ role: ROLES.SUPER_ADMIN }), true)
    assert.equal(canCreateStaffRoleOverride({ role: ROLES.STAFF }), false)
    assert.equal(canRevokeStaffRoleOverride({ role: ROLES.SUPER_ADMIN }), true)
    assert.equal(canRevokeStaffRoleOverride({ role: ROLES.ADMIN }), false)
  })
})

describe('SLA + customer notify prefs', () => {
  it('isOverSla when dwell exceeds sla_minutes', () => {
    assert.equal(isOverSla(45, 30), true)
    assert.equal(isOverSla(30, 30), false)
    assert.equal(isOverSla(90, null), false)
  })

  it('customerNotifyAllowed skips disabled / muted channels', () => {
    assert.equal(customerNotifyAllowed({ is_disabled: true }, 'sms'), false)
    assert.equal(customerNotifyAllowed({ notify_sms: false }, 'sms'), false)
    assert.equal(customerNotifyAllowed({ notify_sms: false }, 'push'), true)
    assert.equal(customerNotifyAllowed({ notify_push: false }, 'push'), false)
    assert.equal(customerNotifyAllowed({ notify_sms: true, notify_push: true }, 'sms'), true)
  })
})

describe('Phase 7 migration + UI seams (source scan)', () => {
  it('migration defines icon, sla, notify flags, staff_role_overrides, queue board SLA cols', () => {
    const sql = read('supabase/migrations/20260827150000_owner_revisions_phase7.sql')
    assert.match(sql, /vehicles[\s\S]*icon/)
    assert.match(sql, /sla_minutes/)
    assert.match(sql, /notify_sms/)
    assert.match(sql, /notify_push/)
    assert.match(sql, /is_disabled/)
    assert.match(sql, /staff_role_overrides/)
    assert.match(sql, /unique \(staff_id, role, branch_slug, on_date\)/)
    assert.match(sql, /service_sla_minutes/)
    assert.match(sql, /service_duration_minutes/)
  })

  it('UI + notify seams wire Phase 7 fields', () => {
    const floor = read('src/pages/SuperAdminFloorBoard.jsx')
    const crm = read('src/pages/CrmPage.jsx')
    const svc = read('src/pages/ServicesManagePage.jsx')
    const people = read('src/pages/PeopleManagePage.jsx')
    const auth = read('src/auth/AuthProvider.jsx')
    const notify = read('server/notifyBooking.mjs')
    const queue = read('src/pages/TeamLeadQueuePage.jsx')
    assert.match(floor, /carSizeBySale|Car size per sale/)
    assert.match(floor, /bestSellers|Best package/)
    assert.match(floor, /Needs Sunday recon|chemicalUsage/)
    assert.match(crm, /VEHICLE_ICON_PRESETS/)
    assert.match(crm, /notify_sms/)
    assert.match(crm, /is_disabled/)
    assert.match(svc, /duration_minutes/)
    assert.match(svc, /sla_minutes/)
    assert.match(people, /staff_role_overrides/)
    assert.match(people, /Temp Team Lead/)
    assert.match(auth, /resolveEffectiveRole/)
    assert.match(notify, /customerNotifyAllowed/)
    assert.match(queue, /isOverSla/)
  })
})
