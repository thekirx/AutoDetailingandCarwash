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
import { canAccessSettings, getOperationsNav, groupOperationsNav, getTeamLeadDock } from '../src/auth/permissions.js'
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

  it('nav exposes one Queue command, not separate wash and detailing links', () => {
    const sa = getOperationsNav({ role: 'BossMich' })
    const labels = sa.map((i) => i.label)
    const queueLinks = sa.filter((i) => String(i.to).startsWith('/operations/queue') && !String(i.to).includes('/new'))
    assert.ok(labels.includes('Floor Board'))
    assert.equal(queueLinks.length, 1)
    assert.equal(queueLinks[0].label, 'Queue')
    assert.equal(queueLinks[0].to, '/operations/queue')
    assert.equal(labels.includes('Car Wash Queue'), false)
    assert.equal(labels.includes('Detailing Queue'), false)
    assert.ok(labels.includes('Planner'))
    assert.equal(labels.includes('Hakum Planner'), false)
    assert.ok(labels.includes('Settings'))
    assert.equal(canAccessSettings({ role: 'BossMich' }), true)
    const dock = getTeamLeadDock({ role: 'team_lead', branch_slug: 'bacoor' })
    assert.ok(dock.some((i) => i.label === 'Queue' && i.to === '/operations/queue'))
    assert.equal(dock.some((i) => i.label === 'Wash'), false)
    assert.equal(dock.some((i) => i.label === 'Detail'), false)
  })

  it('Command sidebar groups SA nav by shop day, not one dump', () => {
    const sa = getOperationsNav({ role: 'BossMich' })
    const groups = groupOperationsNav(sa)
    const ids = groups.map((g) => g.id)
    assert.deepEqual(ids, ['floor', 'counter', 'customers', 'books', 'work', 'company'])
    assert.equal(groups.find((g) => g.id === 'floor').items[0].label, 'Console')
    assert.ok(groups.find((g) => g.id === 'floor').items.some((i) => i.label === 'Queue'))
    assert.ok(groups.find((g) => g.id === 'floor').items.some((i) => i.label === 'Bookings'))
    assert.ok(groups.find((g) => g.id === 'counter').items.some((i) => i.to === '/operations/pos'))
    assert.ok(groups.find((g) => g.id === 'books').items.some((i) => i.to === '/operations/payroll'))
    assert.ok(groups.find((g) => g.id === 'company').items.some((i) => i.to === '/operations/settings'))
    const labels = sa.map((i) => i.label)
    assert.ok(labels.indexOf('Queue') < labels.indexOf('POS'))
    assert.ok(labels.indexOf('Bookings') < labels.indexOf('Settings'))
    const layout = readFileSync(join(root, 'src/layouts/OperationsLayout.jsx'), 'utf8')
    const css = readFileSync(join(root, 'src/styles.css'), 'utf8')
    assert.match(layout, /groupOperationsNav/)
    assert.match(layout, /CommandNavList/)
    assert.doesNotMatch(layout, /SidebarGroupLabel>Command</)
    assert.match(layout, /--sidebar-width': '15rem'/)
    assert.match(css, /\.command-nav-btn\s*\{[^}]*min-height:\s*2\.75rem/s)
    assert.match(css, /\.command-nav-btn\[aria-current="page"\]\s*\{[^}]*#c4a35a/s)
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
    assert.equal(FORM_KINDS.length, 4)
    assert.equal(FORM_KINDS.some((k) => k.value === 'custom'), false)
    assert.ok(templateFields('equipment_repair').some((f) => f.key === 'equipment'))
    assert.ok(templateFields('cash_advance').some((f) => f.key === 'amount'))
    const mig = readFileSync(join(root, 'supabase/migrations/20260809220000_planner_specialty_boards.sql'), 'utf8')
    assert.match(mig, /Complaints/)
    assert.match(mig, /Equipment Repairs/)
    assert.match(mig, /Employee Cash Advance/)
  })
})
