import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ROLES,
  allowRoute,
  canManageServices,
  canAccessPos,
  getOperationsNav,
  redirectForRole,
  isBranchAdmin,
} from '../src/auth/permissions.js'

describe('Branch Admin simplified shell', () => {
  const p = { role: ROLES.ADMIN, branch_slug: 'bacoor', branch_slugs: ['bacoor'] }

  it('isBranchAdmin matches role admin only', () => {
    assert.equal(isBranchAdmin(p), true)
    assert.equal(isBranchAdmin({ role: ROLES.SUPER_ADMIN }), false)
    assert.equal(isBranchAdmin({ role: ROLES.TEAM_LEAD }), false)
  })

  it('homes to POS', () => {
    assert.equal(redirectForRole(ROLES.ADMIN), '/operations/pos')
    assert.equal(redirectForRole(ROLES.SUPER_ADMIN), '/operations/console')
  })

  it('Command nav: Floor, Queue, attendance, POS, Inventory restock, reviews, planner, Ops Lab, history, audit', () => {
    assert.equal(allowRoute(p, 'inventory'), true)
    assert.deepEqual(
      getOperationsNav(p).map((i) => i.to),
      [
        '/operations/dashboard',
        '/operations/queue',
        '/operations/attendance',
        '/operations/pos',
        '/operations/inventory',
        '/operations/reviews',
        '/operations/planning',
        '/operations/roadmap',
        '/operations/history',
        '/operations/my-pay',
        '/operations/audit',
      ],
    )
    assert.ok(getOperationsNav(p).some((i) => i.label === 'Floor'))
    assert.ok(getOperationsNav(p).some((i) => i.label === 'Queue'))
    assert.ok(getOperationsNav(p).some((i) => i.label === 'Ops Lab'))
    assert.equal(getOperationsNav(p).some((i) => i.label === 'Detailing Queue'), false)
    assert.equal(getOperationsNav(p).some((i) => i.label === 'Car Wash Queue'), false)
  })

  it('dock contract matches Command nav (BA uses Command shell, not thumb dock)', () => {
    const nav = getOperationsNav(p)
    const navPaths = nav.map((i) => i.to)
    assert.ok(navPaths.includes('/operations/dashboard'))
    assert.ok(navPaths.includes('/operations/queue'))
    assert.ok(navPaths.includes('/operations/attendance'))
    assert.ok(navPaths.includes('/operations/pos'))
  })

  it('POS checkout allowed but cannot manage services/merch catalog', () => {
    assert.equal(canAccessPos(p), true)
    assert.equal(canManageServices(p), false)
    assert.equal(canManageServices({ role: ROLES.SUPER_ADMIN }), true)
  })
})

describe('Branch Admin POS UI is checkout-only', () => {
  it('hides manage tabs and service catalog browse for branch admin', async () => {
    const { readFile } = await import('node:fs/promises')
    const { fileURLToPath } = await import('node:url')
    const { dirname, join } = await import('node:path')
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    const src = await readFile(join(root, 'src/pages/PosPage.jsx'), 'utf8')
    assert.match(src, /canManageCatalog/)
    assert.match(src, /Merch, queue payment, expenses, end of shift/)
    assert.match(src, /branchAdmin \? \(/)
    assert.match(src, /ShiftCloseWizard/)
    assert.doesNotMatch(src, /canManageServices\(profile\) && <TabsTrigger value="services">Manage services/)
  })
})
