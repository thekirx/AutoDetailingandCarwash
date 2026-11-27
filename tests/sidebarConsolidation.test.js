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
import {
  opsNavIsActive,
  opsServiceSearchUrl,
  opsProductSearchUrl,
  opsStaffSearchUrl,
  opsVoucherSearchUrl,
  opsCustomerSearchUrl,
  opsVehicleSearchUrl,
  resolveOpsBreadcrumb,
} from '../src/lib/opsNavigationRegistry.js'
import { buildQuickJumpDestinations, buildSmartSearchDestinations } from '../src/lib/smartSearchCatalog.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

describe('sidebar consolidation, dropdown accordions, and hub RBAC', () => {
  it('retains only the 6 primary navigation modules in sidebar while preserving Catalog & Inventory via Smart Search', () => {
    const bossNav = getOperationsNav({ role: ROLES.SUPER_ADMIN })
    assert.deepEqual(
      bossNav.map((i) => i.label),
      ['Floor Insight', 'Carwash Queue', 'Detailing', 'Team P', 'POS', 'Financials'],
    )
    const bossResults = buildSmartSearchDestinations({ role: ROLES.SUPER_ADMIN })
    assert.ok(bossResults.some((d) => d.to === '/operations/inventory'))
    assert.ok(bossResults.some((d) => d.to === '/operations/inventory?tab=services&scope=bay'))
    assert.ok(bossResults.some((d) => d.to === '/operations/inventory?tab=services&scope=detailing'))
    assert.ok(bossResults.some((d) => d.to === '/operations/inventory?tab=merch'))
    assert.ok(bossResults.some((d) => d.to === '/operations/inventory?tab=cars'))
    assert.ok(bossResults.some((d) => d.to === '/operations/inventory?tab=recon'))
  })

  it('preserves RBAC-filtered Smart Search destinations for Employees, Customers, and Rewards', () => {
    const bossResults = buildSmartSearchDestinations({ role: ROLES.SUPER_ADMIN })
    assert.ok(bossResults.some((d) => d.to === '/operations/employees'))
    assert.ok(bossResults.some((d) => d.to === '/operations/employees?tab=register'))
    assert.ok(bossResults.some((d) => d.to === '/operations/employees?tab=employees'))
    assert.ok(bossResults.some((d) => d.to === '/operations/employees?tab=access'))
    assert.ok(bossResults.some((d) => d.to === '/operations/crm'))
    assert.ok(bossResults.some((d) => d.to === '/operations/crm?tab=transfer'))
    assert.ok(bossResults.some((d) => d.to === '/operations/crm?tab=inquiries'))
    assert.ok(bossResults.some((d) => d.to === '/operations/crm?tab=sms'))
    assert.ok(bossResults.some((d) => d.to === '/operations/rewards'))
    assert.ok(bossResults.some((d) => d.to === '/operations/rewards?tab=vouchers'))
    assert.ok(bossResults.some((d) => d.to === '/operations/rewards?tab=points-shop'))
    assert.ok(bossResults.some((d) => d.to === '/operations/rewards?tab=referrals'))

    const baResults = buildSmartSearchDestinations({ role: ROLES.ADMIN, branch_slug: 'bacoor' })
    assert.ok(baResults.some((d) => d.to === '/operations/employees'))
    assert.ok(baResults.some((d) => d.to === '/operations/crm'))
    assert.ok(!baResults.some((d) => d.to === '/operations/employees?tab=access'))
    assert.ok(!baResults.some((d) => d.to === '/operations/crm?tab=inquiries'))
  })

  it('aligns Operations Lead to System & Data (Audit log only)', () => {
    const opsLead = { role: ROLES.OPERATIONS_LEAD }
    const opsNav = getOperationsNav(opsLead)
    assert.deepEqual(
      opsNav.map((i) => i.label),
      ['Carwash Queue', 'Detailing', 'Team P', 'POS', 'Financials'],
    )
    assert.equal(allowRoute(opsLead, 'system'), true)
    assert.equal(allowRoute(opsLead, 'data-center'), false)
  })

  it('gives Branch Admin scoped Catalog & Inventory destinations (Restock Merch + Sunday Recon)', () => {
    const ba = { role: ROLES.ADMIN, branch_slug: 'bacoor' }
    const baResults = buildSmartSearchDestinations(ba)
    assert.ok(baResults.some((d) => d.to === '/operations/inventory?tab=restock'))
    assert.ok(baResults.some((d) => d.to === '/operations/inventory?tab=recon'))
    assert.ok(!baResults.some((d) => d.to === '/operations/inventory?tab=services&scope=bay'))
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

  it('canonical navigation registry resolves active state, breadcrumbs, and Smart Search URLs cleanly', () => {
    const bossNav = getOperationsNav({ role: ROLES.SUPER_ADMIN })
    assert.equal(
      resolveOpsBreadcrumb(bossNav, '/operations/inventory', '?tab=cars', 'Command'),
      'Catalog & Inventory / Vehicle List',
    )
    assert.equal(
      resolveOpsBreadcrumb(bossNav, '/operations/finance', '?tab=salaries', 'Command'),
      'Financials / Monthly salaries',
    )
    assert.equal(opsNavIsActive('/operations/inventory', '?tab=cars', '/operations/inventory'), false)
    assert.equal(opsNavIsActive('/operations/inventory', '?tab=cars', '/operations/inventory?tab=cars'), true)

    assert.equal(
      opsServiceSearchUrl({ name: 'Ceramic Coating', pay_category: 'detailing' }, { canInventory: true, canManageCatalog: true }),
      '/operations/inventory?tab=services&scope=detailing&q=Ceramic+Coating',
    )
    assert.equal(
      opsProductSearchUrl({ name: 'Car Scent' }, { canInventory: true, canManageCatalog: false }),
      '/operations/inventory?tab=restock&q=Car+Scent',
    )
    assert.equal(
      opsStaffSearchUrl('Lucy', { canPeople: true, isCommandShell: true }),
      '/operations/employees?tab=employees&q=Lucy',
    )
    assert.equal(opsVoucherSearchUrl('TINT10'), '/operations/rewards?tab=vouchers&q=TINT10')
    assert.equal(opsCustomerSearchUrl('Juan', true), '/operations/crm?q=Juan')
    assert.equal(opsVehicleSearchUrl('ABC1234', true), '/operations/history?q=ABC1234')
  })

  it('flattens sidebar accordion children, Quick Jumps, and hub tabs in smart search destinations', () => {
    const boss = { role: ROLES.SUPER_ADMIN }
    const bossResults = buildSmartSearchDestinations(boss)
    assert.ok(bossResults.some((d) => d.to === '/operations/inventory?tab=services&scope=bay'))
    assert.ok(bossResults.some((d) => d.to === '/operations/inventory?tab=cars'))
    assert.ok(bossResults.some((d) => d.to === '/operations/finance?tab=salaries'))
    assert.ok(bossResults.some((d) => d.to === '/operations/finance?tab=approvals'))
    assert.ok(bossResults.some((d) => d.to === '/operations/system?tab=audit'))
    assert.ok(bossResults.some((d) => d.to === '/operations/system?tab=data-center'))

    const quick = buildQuickJumpDestinations(boss, 8)
    assert.equal(quick.length, 8)

    const baResults = buildSmartSearchDestinations({ role: ROLES.ADMIN, branch_slug: 'bacoor' })
    assert.ok(!baResults.some((d) => d.to.includes('data-center')))
    assert.ok(!baResults.some((d) => d.to.includes('salaries')))
  })

  it('keeps SettingsHubPage free of duplicate ReferralProgramCard and embeds CarsCatalogPage inside InventoryPage', () => {
    const inv = read('src/pages/InventoryPage.jsx')
    const manage = read('src/pages/ServicesManagePage.jsx')
    const settings = read('src/pages/SettingsHubPage.jsx')
    const cars = read('src/pages/CarsCatalogPage.jsx')
    assert.match(inv, /id: 'services'/)
    assert.match(inv, /id: 'cars'/)
    assert.match(inv, /CarsCatalogPage embedded/)
    assert.match(inv, /Services & detailing/)
    assert.doesNotMatch(inv, /ReferralProgramCard/)
    assert.doesNotMatch(settings, /ReferralProgramCard/)
    assert.match(cars, /export default function CarsCatalogPage\(\{ embedded = false \} = \{\}\)/)
    assert.match(manage, /onScopeChange/)
    assert.match(manage, /scopeCounts/)
  })

  it('wires redirects, Smart Search deep-linking, auto-single accordion, CommandMenu cache/highlight, and reduced motion CSS', () => {
    const app = read('src/App.jsx')
    const sys = read('src/pages/SystemHubPage.jsx')
    const fin = read('src/pages/FinancePage.jsx')
    const layout = read('src/layouts/OperationsLayout.jsx')
    const css = read('src/styles/ops-daylight.css')
    const cmd = read('src/components/ops/CommandMenu.jsx')
    const api = read('server/smartSearchApi.mjs')

    assert.match(app, /path="system" element=\{gate\('system', <SystemHubPage \/>\)\}/)
    assert.match(app, /CatalogCarsRedirect/)
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
    assert.match(layout, /opsNavIsActive/)
    assert.match(layout, /resolveOpsBreadcrumb/)

    assert.match(cmd, /buildQuickJumpDestinations/)
    assert.match(cmd, /queryCacheRef/)
    assert.match(cmd, /HighlightMatch/)
    assert.match(api, /opsServiceSearchUrl/)
    assert.match(api, /opsStaffSearchUrl/)
    assert.match(api, /opsVoucherSearchUrl/)
    assert.doesNotMatch(api, /\/operations\/people/)
    assert.doesNotMatch(api, /\/operations\/vouchers/)
    assert.doesNotMatch(api, /\/operations\/inventory\?tab=bay/)

    assert.match(css, /\.command-nav-accordion\[data-open="true"\]/)
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
    assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)/)
  })

  it('syncs BranchInventoryPage URL tabs, useUrlQueryState clearing, SA attendance highlight, and direct internal links', () => {
    const branchInv = read('src/pages/BranchInventoryPage.jsx')
    const app = read('src/App.jsx')
    const branches = read('src/pages/BranchesManagePage.jsx')
    const products = read('src/pages/ProductsManagePage.jsx')
    const floor = read('src/pages/SuperAdminFloorBoard.jsx')
    const hook = read('src/hooks/useUrlQueryState.js')

    assert.match(branchInv, /useSearchParams/)
    assert.match(branchInv, /const tab = embedded \? localTab : urlTab/)
    assert.match(app, /canUseAttendanceClock\(profile\)/)
    assert.match(hook, /state\.urlQ === urlQ \? state\.value : urlQ/)
    assert.match(branches, /to="\/operations\/employees\?tab=employees"/)
    assert.match(products, /to="\/operations\/finance\?tab=approvals"/)
    assert.match(floor, /to="\/operations\/finance\?tab=approvals"/)
    assert.match(floor, /usesFloorAppShell\(profile\) \? '\/operations\/attendance' : '\/operations\/employees'/)
  })
})
