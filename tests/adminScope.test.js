import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ROLES,
  allowRoute,
  canAccessReports,
  canEditPlanning,
  canEditQueueOperations,
  canManageVehicleCatalog,
  canEditAttendanceRoles,
  canWriteFinance,
  canViewRedoLane,
  canManageBranches,
  canCreateBranches,
  getBranchScopeList,
  getOperationsNav,
} from '../src/auth/permissions.js'
import {
  NO_BRANCH_SCOPE,
  filterBranchesForProfile,
  filterPeopleForProfile,
  pickDefaultBranchSlug,
  resolveBranchFilter,
  getBranchScope,
} from '../src/queue/queueLogic.js'

describe('Admin capability matrix', () => {
  const p = { role: ROLES.ADMIN, branch_slug: 'bacoor', branch_slugs: ['bacoor', 'imus'] }

  it('allows console floor POS finance CRM memberships; denies cars reports edit-queue planning-edit redo roles', () => {
    assert.equal(allowRoute(p, 'console'), true)
    assert.equal(allowRoute(p, 'pos'), true)
    assert.equal(allowRoute(p, 'finance'), true)
    assert.equal(allowRoute(p, 'crm'), true)
    assert.equal(allowRoute(p, 'memberships'), true)
    assert.equal(allowRoute(p, 'queue'), true)
    assert.equal(allowRoute(p, 'cars'), false)
    assert.equal(allowRoute(p, 'reports'), false)
    assert.equal(canAccessReports(p), false)
    assert.equal(canManageVehicleCatalog(p), false)
    assert.equal(canEditQueueOperations(p), false)
    assert.equal(canEditPlanning(p), false)
    assert.equal(canViewRedoLane(p), false)
    assert.equal(canEditAttendanceRoles(p), false)
    assert.equal(canWriteFinance(p), true)
    assert.equal(allowRoute(p, 'queue-new'), false)
    assert.deepEqual(
      getOperationsNav(p).map((i) => i.to),
      ['/operations/pos', '/operations/dashboard', '/operations/queue'],
    )
    assert.ok(!getOperationsNav(p).some((i) => i.to === '/operations/cars'))
  })

  it('is multi-branch scoped never all-branches', () => {
    assert.deepEqual(getBranchScopeList(p), ['bacoor', 'imus'])
    assert.deepEqual(resolveBranchFilter(p, 'all'), ['bacoor', 'imus'])
    assert.equal(resolveBranchFilter(p, 'imus'), 'imus')
  })
})

describe('Admin branch pickers fail-closed', () => {
  const all = [
    { slug: 'bacoor', name: 'Bacoor' },
    { slug: 'imus', name: 'Imus' },
    { slug: 'batangas', name: 'Batangas' },
  ]

  it('filters catalog to assigned branches only', () => {
    const p = { role: ROLES.ADMIN, branch_slugs: ['bacoor', 'imus'] }
    assert.deepEqual(
      filterBranchesForProfile(all, p).map((b) => b.slug),
      ['bacoor', 'imus'],
    )
  })

  it('empty Admin scope yields no picker options and no default slug', () => {
    const p = { role: ROLES.ADMIN, branch_slug: null, branch_slugs: [] }
    assert.deepEqual(filterBranchesForProfile(all, p), [])
    assert.equal(pickDefaultBranchSlug(p, all), '')
    assert.equal(getBranchScope(p), NO_BRANCH_SCOPE)
  })

  it('does not fall through to first company branch when scoped empty', () => {
    const p = { role: ROLES.ADMIN, branch_slugs: [] }
    assert.notEqual(pickDefaultBranchSlug(p, all), 'bacoor')
    assert.equal(pickDefaultBranchSlug(p, all), '')
  })
})

describe('Admin people directory scope', () => {
  it('keeps only people who touch assigned branches', () => {
    const p = { role: ROLES.ADMIN, branch_slugs: ['bacoor', 'imus'] }
    const people = [
      { id: '1', branch_slug: 'bacoor', branch_slugs: ['bacoor'] },
      { id: '2', branch_slug: 'batangas', branch_slugs: ['batangas'] },
      { id: '3', branch_slug: 'imus', branch_slugs: ['imus', 'batangas'] },
    ]
    assert.deepEqual(
      filterPeopleForProfile(people, p).map((x) => x.id),
      ['1', '3'],
    )
  })

  it('empty Admin scope yields empty people list', () => {
    const p = { role: ROLES.ADMIN, branch_slugs: [] }
    assert.deepEqual(
      filterPeopleForProfile([{ id: '1', branch_slug: 'bacoor', branch_slugs: ['bacoor'] }], p),
      [],
    )
  })
})

describe('Admin cannot open new company sites', () => {
  it('canManageBranches true but canCreateBranches false', () => {
    const p = { role: ROLES.ADMIN, branch_slugs: ['bacoor'] }
    assert.equal(canManageBranches(p), true)
    assert.equal(canCreateBranches(p), false)
  })
})
