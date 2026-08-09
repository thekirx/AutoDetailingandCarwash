import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  filterTicketsByFamily,
  parseQueueFamilyParam,
  boardStatusesForFamily,
  ticketQueueFamily,
  QUEUE_FAMILY_DETAILING,
  QUEUE_FAMILY_WASH,
} from '../src/lib/queueFamilies.js'
import { filterCustomersBySmartGroup, CRM_SMART_GROUP_PRESETS } from '../src/lib/crmSmartGroups.js'
import { getOpsBoardStatuses } from '../src/queue/queueLogic.js'
import { canAccessSettings, getOperationsNav, getTeamLeadDock } from '../src/auth/permissions.js'
import { FORM_KINDS, templateFields } from '../src/lib/opsForms.js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('command category IA', () => {
  it('splits wash vs detailing queue families', () => {
    assert.equal(parseQueueFamilyParam('detailing'), QUEUE_FAMILY_DETAILING)
    assert.equal(parseQueueFamilyParam(''), QUEUE_FAMILY_WASH)
    assert.equal(ticketQueueFamily({ service_pay_category: 'wash' }), QUEUE_FAMILY_WASH)
    assert.equal(ticketQueueFamily({ service_pay_category: 'detailing' }), QUEUE_FAMILY_DETAILING)
    const rows = [
      { id: 1, service_pay_category: 'wash' },
      { id: 2, service_pay_category: 'detailing' },
      { id: 3, service_pay_category: 'package' },
    ]
    assert.deepEqual(
      filterTicketsByFamily(rows, 'wash').map((r) => r.id),
      [1, 3],
    )
    assert.deepEqual(
      filterTicketsByFamily(rows, 'detailing').map((r) => r.id),
      [2],
    )
    assert.ok(boardStatusesForFamily(['waiting'], 'detailing').includes('confirmed'))
  })

  it('detailing board statuses include Assigned to Branch', () => {
    const lanes = getOpsBoardStatuses({ role: 'team_lead', branch_slug: 'bacoor' }, { family: 'detailing' })
    assert.ok(lanes.includes('confirmed'))
    assert.ok(lanes.includes('waiting'))
  })

  it('nav exposes command categories', () => {
    const sa = getOperationsNav({ role: 'BossMich' })
    const labels = sa.map((i) => i.label)
    assert.ok(labels.includes('Floor Board'))
    assert.ok(labels.includes('Car Wash Queue'))
    assert.ok(labels.includes('Detailing Queue'))
    assert.ok(labels.includes('Hakum Planner'))
    assert.ok(labels.includes('Settings'))
    assert.equal(canAccessSettings({ role: 'BossMich' }), true)
    const dock = getTeamLeadDock({ role: 'team_lead', branch_slug: 'bacoor' })
    assert.ok(dock.some((i) => i.label === 'Wash'))
    assert.ok(dock.some((i) => i.label === 'Detail'))
  })

  it('CRM smart groups filter by visit timeline', () => {
    const now = Date.now()
    const customers = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const visits = [
      { customer_id: 'a', completed_at: new Date(now - 2 * 86400000).toISOString() },
      { customer_id: 'b', completed_at: new Date(now - 120 * 86400000).toISOString() },
    ]
    const recent = filterCustomersBySmartGroup(customers, visits, CRM_SMART_GROUP_PRESETS.find((p) => p.id === 'visited_7d'))
    assert.deepEqual(recent.map((c) => c.id), ['a'])
    const never = filterCustomersBySmartGroup(customers, visits, CRM_SMART_GROUP_PRESETS.find((p) => p.id === 'never'))
    assert.deepEqual(never.map((c) => c.id), ['c'])
    const lapsed = filterCustomersBySmartGroup(customers, visits, CRM_SMART_GROUP_PRESETS.find((p) => p.id === 'lapsed_90d'))
    assert.deepEqual(lapsed.map((c) => c.id), ['b'])
  })

  it('planner form kinds cover specialty boards', () => {
    assert.ok(FORM_KINDS.some((k) => k.value === 'equipment_repair'))
    assert.ok(FORM_KINDS.some((k) => k.value === 'cash_advance'))
    assert.ok(templateFields('equipment_repair').some((f) => f.key === 'equipment'))
    assert.ok(templateFields('cash_advance').some((f) => f.key === 'amount'))
    const mig = readFileSync(join(root, 'supabase/migrations/20260809220000_planner_specialty_boards.sql'), 'utf8')
    assert.match(mig, /Complaints/)
    assert.match(mig, /Equipment Repairs/)
    assert.match(mig, /Employee Cash Advance/)
  })
})
