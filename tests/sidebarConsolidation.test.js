import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ROLES,
  getOperationsNav,
  allowRoute,
} from '../src/auth/permissions.js'
import { opsRouteKeyFromPath } from '../src/auth/authRedirect.js'
import { buildSmartSearchDestinations } from '../src/lib/smartSearchCatalog.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

describe('sidebar consolidation, dropdown accordions, and hub RBAC', () => {
  it('consolidates Catalog & Inventory with expandable children for SA/ASA and removes Config duplicates', () => {
    const bossNav = getOperationsNav({ role: ROLES.SUPER_ADMIN })
    const catalog = bossNav.find((item) => item.to === '/operations/inventory')
    assert.ok(catalog)
    assert.equal(catalog.label, 'Catalog & Inventory')
    assert.deepEqual(
      catalog.children.map((c) => c.to),
      [
        '/operations/inventory?tab=services&scope=bay',
        '/operations/inventory?tab=services&scope=detailing',
        '/operations/inventory?tab=merch',
        '/operations/inventory?tab=recon',
      ],
    )
    assert.ok(!bossNav.some((item) => item.group === 'config' && item.to.includes('tab=bay')))
    assert.ok(!bossNav.some((item) => item.group === 'config' && item.to.includes('tab=detailing')))
  })

  it('gives Branch Admin scoped Catalog & Inventory children (Restock Merch + Sunday Recon)', () => {
    const ba = { role: ROLES.ADMIN, branch_slug: 'bacoor' }
    const baNav = getOperationsNav(ba)
    const catalog = baNav.find((item) => item.to === '/operations/inventory')
    assert.ok(catalog)
    assert.equal(catalog.label, 'Catalog & Inventory')
    assert.deepEqual(
      catalog.children.map((c) => [c.label, c.to]),
      [
        ['Restock Merch', '/operations/inventory?tab=restock'],
        ['Sunday Recon', '/operations/inventory?tab=recon'],
      ],
    )
  })

  it('folds Monthly salaries and Approvals under Financials accordion with strict RBAC filtering', () => {
    const bossFin = getOperationsNav({ role: ROLES.SUPER_ADMIN }).find((i) => i.to === '/operations/finance')
    assert.deepEqual(
      bossFin.children.map((c) => c.to),
      [
        '/operations/finance',
        '/operations/finance?tab=salaries',
        '/operations/finance?tab=approvals',
        '/operations/finance?tab=reports',
      ],
    )

    const baFin = getOperationsNav({ role: ROLES.ADMIN, branch_slug: 'bacoor' }).find(
      (i) => i.to === '/operations/finance',
    )
    assert.ok(!baFin.children, 'Branch Admin without salaries/approvals grants gets a flat Financials item')

    const investorFin = getOperationsNav({ role: ROLES.INVESTOR }).find((i) => i.to === '/operations/finance')
    assert.ok(!investorFin.children, 'Investor keeps flat read-only Financials item')
  })

  it('merges Audit + Data Center into System & Data while keeping Branch Admin denied data-center', () => {
    const boss = { role: ROLES.SUPER_ADMIN }
    const ba = { role: ROLES.ADMIN, branch_slug: 'bacoor' }

    assert.equal(allowRoute(boss, 'system'), true)
    assert.equal(allowRoute(boss, 'audit'), true)
    assert.equal(allowRoute(boss, 'data-center'), true)

    assert.equal(allowRoute(ba, 'system'), true)
    assert.equal(allowRoute(ba, 'audit'), true)
    assert.equal(allowRoute(ba, 'data-center'), false)
    assert.equal(allowRoute(ba, 'monthly-payroll'), false)
    assert.equal(allowRoute(ba, 'approvals'), false)
    assert.equal(opsRouteKeyFromPath('/operations/system'), 'system')
  })

  it('flattens sidebar accordion children and hub tabs in smart search destinations', () => {
    const bossResults = buildSmartSearchDestinations({ role: ROLES.SUPER_ADMIN })
    assert.ok(bossResults.some((d) => d.to === '/operations/inventory?tab=services&scope=bay'))
    assert.ok(bossResults.some((d) => d.to === '/operations/finance?tab=salaries'))
    assert.ok(bossResults.some((d) => d.to === '/operations/finance?tab=approvals'))
    assert.ok(bossResults.some((d) => d.to === '/operations/system?tab=audit'))
    assert.ok(bossResults.some((d) => d.to === '/operations/system?tab=data-center'))

    const baResults = buildSmartSearchDestinations({ role: ROLES.ADMIN, branch_slug: 'bacoor' })
    assert.ok(!baResults.some((d) => d.to.includes('data-center')))
    assert.ok(!baResults.some((d) => d.to.includes('salaries')))
  })

  it('combines Services & detailing inside InventoryPage without ReferralProgramCard duplicate', () => {
    const inv = read('src/pages/InventoryPage.jsx')
    const manage = read('src/pages/ServicesManagePage.jsx')
    assert.match(inv, /id: 'services'/)
    assert.match(inv, /Services & detailing/)
    assert.doesNotMatch(inv, /ReferralProgramCard/)
    assert.match(manage, /onScopeChange/)
    assert.match(manage, /scopeCounts/)
  })

  it('wires redirects, SystemHubPage, FinancePage tabs, accordion layout, and reduced motion CSS', () => {
    const app = read('src/App.jsx')
    const sys = read('src/pages/SystemHubPage.jsx')
    const fin = read('src/pages/FinancePage.jsx')
    const layout = read('src/layouts/OperationsLayout.jsx')
    const css = read('src/styles/ops-daylight.css')

    assert.match(app, /path="system" element=\{gate\('system', <SystemHubPage \/>\)\}/)
    assert.match(app, /FinanceHubRedirect tab="salaries"/)
    assert.match(app, /FinanceHubRedirect tab="approvals"/)
    assert.match(app, /SystemHubRedirect tab="audit"/)
    assert.match(app, /SystemHubRedirect tab="data-center"/)
    assert.match(app, /to="\/operations\/inventory\?tab=services&scope=bay"/)

    assert.match(sys, /AuditLogPage embedded/)
    assert.match(sys, /DataCenterPage embedded/)
    assert.match(fin, /MonthlyPayrollPage embedded/)
    assert.match(fin, /ApprovalsPage embedded/)

    assert.match(layout, /SidebarMenuSub/)
    assert.match(layout, /command-nav-accordion/)
    assert.match(layout, /aria-expanded=\{isOpen\}/)

    assert.match(css, /\.command-nav-accordion\[data-open="true"\]/)
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
    assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)/)
  })
})
