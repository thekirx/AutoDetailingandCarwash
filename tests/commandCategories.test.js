import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  filterTicketsByFamily,
  parseQueueFamilyParam,
  boardStatusesForFamily,
  ticketQueueFamily,
  canSwitchQueueFamily,
  queueFamilyForProfile,
  QUEUE_FAMILIES,
  QUEUE_FAMILY_DETAILING,
  QUEUE_FAMILY_WASH,
} from '../src/lib/queueFamilies.js'
import { filterCustomersBySmartGroup, CRM_SMART_GROUP_PRESETS } from '../src/lib/crmSmartGroups.js'
import { getOpsBoardStatuses } from '../src/queue/queueLogic.js'
import {
  canAccessSettings,
  getOperationsNav,
  groupOperationsNav,
  getTeamLeadDock,
  redirectForRole,
  getDetailerDock,
  ROLES,
} from '../src/auth/permissions.js'
import { FORM_KINDS, templateFields } from '../src/lib/opsForms.js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('command category IA', () => {
  it('queue is wash-only; detailing tickets are filtered out', () => {
    assert.equal(QUEUE_FAMILIES.length, 1)
    assert.equal(QUEUE_FAMILIES[0].id, QUEUE_FAMILY_WASH)
    assert.equal(canSwitchQueueFamily({ role: 'BossMich' }), false)
    assert.equal(parseQueueFamilyParam('detailing'), QUEUE_FAMILY_DETAILING)
    assert.equal(parseQueueFamilyParam(''), QUEUE_FAMILY_WASH)
    assert.equal(queueFamilyForProfile('detailing', { role: 'detailer' }), QUEUE_FAMILY_WASH)
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
    assert.ok(!boardStatusesForFamily(['waiting', 'confirmed'], 'wash').includes('confirmed'))
  })

  it('ops queue board statuses stay wash lanes (no Assigned-to-Branch)', () => {
    const lanes = getOpsBoardStatuses({ role: 'team_lead', branch_slug: 'bacoor' }, { family: 'wash' })
    assert.ok(lanes.includes('waiting'))
    assert.ok(!lanes.includes('confirmed'))
  })

  it('Floor Board API can still request detailing lanes for network overview', () => {
    const lanes = getOpsBoardStatuses({ role: 'team_lead', branch_slug: 'bacoor' }, { family: 'detailing' })
    assert.ok(lanes.includes('confirmed'))
    assert.ok(lanes.includes('waiting'))
  })

  it('nav exposes one Queue command without detailing family link', () => {
    const sa = getOperationsNav({ role: 'BossMich' })
    const labels = sa.map((i) => i.label)
    const queueLinks = sa.filter((i) => String(i.to).startsWith('/operations/queue') && !String(i.to).includes('/new'))
    assert.ok(labels.includes('Floor Insight'))
    assert.equal(queueLinks.length, 1)
    assert.equal(queueLinks[0].label, 'Carwash Queue')
    assert.equal(queueLinks[0].to, '/operations/queue')
    assert.ok(!String(queueLinks[0].to).includes('family=detailing'))
    assert.equal(labels.includes('Car Wash Queue'), false)
    assert.equal(labels.includes('Detailing Queue'), false)
    assert.ok(labels.includes('Team Planner'))
    assert.equal(labels.includes('KPI'), false)
    assert.equal(labels.includes('Reviews'), false)
    assert.ok(labels.includes('Settings'))
    assert.equal(canAccessSettings({ role: 'BossMich' }), true)
    const dock = getTeamLeadDock({ role: 'team_lead', branch_slug: 'bacoor' })
    assert.ok(dock.some((i) => i.label === 'Carwash Board' && i.to === '/operations/queue'))
    assert.equal(dock.some((i) => i.label === 'Wash'), false)
    assert.equal(dock.some((i) => i.label === 'Detail'), false)
  })

  it('detailer lands on Bookings for detailing work', () => {
    assert.equal(redirectForRole(ROLES.DETAILER), '/operations/bookings')
    assert.ok(getDetailerDock({ role: ROLES.DETAILER }).some((i) => i.to === '/operations/bookings'))
    assert.ok(!getDetailerDock({ role: ROLES.DETAILER }).some((i) => String(i.to).includes('queue')))
  })

  it('queue page has no Wash/Detail family switcher', () => {
    const page = readFileSync(join(root, 'src/pages/OperationsPages.jsx'), 'utf8')
    assert.doesNotMatch(page, /aria-label="Service family"/)
    assert.match(page, /Detailing jobs belong on Bookings/)
    assert.match(page, /kinds=\{\['service', 'package'\]\}/)
  })

  it('Command sidebar groups Floor Insight, then Configuration, with Audit under Operations Insight', () => {
    const sa = getOperationsNav({ role: 'BossMich' })
    const groups = groupOperationsNav(sa)
    const ids = groups.map((g) => g.id)
    assert.deepEqual(ids, ['insight', 'hr', 'customers', 'config', 'ops-insight'])
    assert.equal(groups[0].label, 'Floor Insight')
    assert.deepEqual(groups[0].items.map((item) => item.label), [
      'Floor Insight',
      'Carwash Queue',
      'Detailing Schedule',
      'Team Planner',
      'Point of Sales',
      'Vouchers',
      'Inventory',
      'Financials',
      'Monthly salaries',
      'Approvals',
    ])
    assert.deepEqual(
      groups.find((g) => g.id === 'config').items.map((item) => item.label),
      [
        'Branches',
        'Services and Packages',
        'Detailing Packages',
        'Vehicle List',
        'RBAC Delegation',
        'Transfer car',
        'Content',
        'Settings',
      ],
    )
    assert.deepEqual(
      groups.find((g) => g.id === 'ops-insight').items.map((item) => item.label),
      ['History', 'Notifications', 'Audit', 'Data Center'],
    )
    assert.ok(!sa.some((i) => i.label === 'Console' || i.label === 'KPI' || i.label === 'Reviews' || i.label === 'Month KPI'))
    assert.ok(sa.some((i) => i.to === '/operations/vouchers' && i.label === 'Vouchers'))
    assert.ok(!sa.some((i) => i.to === '/operations/payroll' || i.to === '/operations/kpi' || i.to === '/operations/reviews'))
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
    assert.ok(FORM_KINDS.some((k) => k.value === 'detailing'))
    assert.equal(FORM_KINDS.length, 6)
    assert.equal(FORM_KINDS.some((k) => k.value === 'custom'), true)
    assert.ok(templateFields('equipment_repair').some((f) => f.key === 'equipment'))
    assert.ok(templateFields('cash_advance').some((f) => f.key === 'amount'))
    assert.ok(templateFields('detailing').some((f) => f.key === 'service'))
    const mig = readFileSync(join(root, 'supabase/migrations/20260809220000_planner_specialty_boards.sql'), 'utf8')
    assert.match(mig, /Complaints/)
    assert.match(mig, /Equipment Repairs/)
    assert.match(mig, /Employee Cash Advance/)
  })
})
