import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ROLES,
  canManageServices,
  canAccessPos,
  getBranchAdminDock,
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

  it('Command nav: Floor, wash/detail queues, POS, attendance, inventory, history, reviews, audit', () => {
    assert.deepEqual(
      getOperationsNav(p).map((i) => i.to),
      [
        '/operations/dashboard',
        '/operations/queue',
        '/operations/queue?family=detailing',
        '/operations/pos',
        '/operations/attendance',
        '/operations/inventory',
        '/operations/history',
        '/operations/planning',
        '/operations/reviews',
        '/operations/audit',
      ],
    )
    assert.ok(getOperationsNav(p).some((i) => i.label === 'Floor'))
    assert.ok(getOperationsNav(p).some((i) => i.label === 'Detailing Queue'))
  })

  it('dock is Floor, Wash, Attendance, POS (POS primary)', () => {
    const dock = getBranchAdminDock(p)
    assert.deepEqual(
      dock.map((i) => i.to),
      ['/operations/dashboard', '/operations/queue', '/operations/attendance', '/operations/pos'],
    )
    assert.equal(dock[0].label, 'Floor')
    assert.equal(dock.find((i) => i.to === '/operations/pos')?.primary, true)
    assert.equal(getBranchAdminDock({ role: ROLES.TEAM_LEAD }).length, 0)
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
    assert.match(src, /Queue payment \+ merch/)
    assert.match(src, /branchAdmin \? \(/)
    assert.doesNotMatch(src, /canManageServices\(profile\) && <TabsTrigger value="services">Manage services/)
  })
})
