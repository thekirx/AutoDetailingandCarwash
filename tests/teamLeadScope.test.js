import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ROLES,
  allowRoute,
  canAccessConsole,
  canAccessFinance,
  canAccessPos,
  canAccessReports,
  canCreateBranches,
  canEditAttendanceSettings,
  canEditPlanning,
  canEditQueueOperations,
  canManagePeople,
  canManageVehicleCatalog,
  canOverrideAttendance,
  canViewRedoLane,
  getBranchScopeList,
  getOperationsNav,
  getTeamLeadDock,
  redirectForRole,
} from '../src/auth/permissions.js'
import {
  NO_BRANCH_SCOPE,
  filterBranchesForProfile,
  hasValidTeamLeadBranch,
  pickDefaultBranchSlug,
  requiresTeamLeadBranchSetup,
  resolveBranchFilter,
} from '../src/queue/queueLogic.js'
import { canStaffUpdateBookingStatus } from '../server/bookingStatusAccess.mjs'
import { QUEUE_PROVISION_ROLES } from '../server/provisionCustomer.mjs'

describe('Team Lead capability matrix', () => {
  const p = { role: ROLES.TEAM_LEAD, branch_slug: 'bacoor', branch_slugs: ['bacoor'] }

  it('allows floor queue crew kpi attendance my-tasks queue-new; denies bookings console POS finance CRM people cars reports', () => {
    assert.equal(allowRoute(p, 'dashboard'), true)
    assert.equal(allowRoute(p, 'queue'), true)
    assert.equal(allowRoute(p, 'queue-new'), true)
    assert.equal(allowRoute(p, 'crew'), true)
    assert.equal(allowRoute(p, 'attendance'), true)
    assert.equal(allowRoute(p, 'kpi'), true)
    assert.equal(allowRoute(p, 'bookings'), false)
    assert.equal(allowRoute(p, 'my-tasks'), true)
    assert.equal(canEditQueueOperations(p), true)
    assert.equal(allowRoute(p, 'console'), false)
    assert.equal(allowRoute(p, 'pos'), false)
    assert.equal(allowRoute(p, 'finance'), false)
    assert.equal(allowRoute(p, 'crm'), false)
    assert.equal(allowRoute(p, 'people'), false)
    assert.equal(allowRoute(p, 'branches'), false)
    assert.equal(allowRoute(p, 'cars'), false)
    assert.equal(allowRoute(p, 'reports'), false)
    assert.equal(allowRoute(p, 'planning'), false)
    assert.equal(canAccessConsole(p), false)
    assert.equal(canAccessPos(p), false)
    assert.equal(canAccessFinance(p), false)
    assert.equal(canManagePeople(p), false)
    assert.equal(canManageVehicleCatalog(p), false)
    assert.equal(canAccessReports(p), false)
    assert.equal(canEditPlanning(p), false)
    assert.equal(canViewRedoLane(p), false)
    assert.equal(canOverrideAttendance(p), false)
    assert.equal(canEditAttendanceSettings(p), false)
    assert.equal(canCreateBranches(p), false)
    assert.equal(redirectForRole(ROLES.TEAM_LEAD), '/operations/queue')
    assert.ok(getTeamLeadDock(p).some((i) => i.to === '/operations/queue/new'))
    assert.equal(getTeamLeadDock(p)[0].to, '/operations/queue')
    assert.ok(!getOperationsNav(p).some((i) => i.to === '/operations/pos'))
  })

  it('is single-branch scoped never all-branches', () => {
    assert.deepEqual(getBranchScopeList(p), ['bacoor'])
    assert.equal(resolveBranchFilter(p, 'all'), 'bacoor')
    assert.equal(resolveBranchFilter(p, 'imus'), 'bacoor')
  })
})

describe('Team Lead branch setup fail-closed', () => {
  it('blocks TL without branch_slug', () => {
    const p = { role: ROLES.TEAM_LEAD, branch_slug: null, branch_slugs: [] }
    assert.equal(hasValidTeamLeadBranch(p), false)
    assert.equal(requiresTeamLeadBranchSetup(p), true)
    assert.equal(pickDefaultBranchSlug(p, [{ slug: 'bacoor' }]), '')
    assert.deepEqual(filterBranchesForProfile([{ slug: 'bacoor' }, { slug: 'imus' }], p), [])
  })

  it('accepts TL with branch_slugs when branch_slug missing', () => {
    const p = { role: ROLES.TEAM_LEAD, branch_slug: null, branch_slugs: ['imus'] }
    assert.equal(hasValidTeamLeadBranch(p), true)
    assert.equal(requiresTeamLeadBranchSetup(p), false)
    assert.equal(pickDefaultBranchSlug(p, [{ slug: 'imus' }, { slug: 'bacoor' }]), 'imus')
  })
})

describe('booking-status branch gate (TL-C1)', () => {
  it('denies Team Lead updating a booking outside their branch', () => {
    assert.equal(
      canStaffUpdateBookingStatus(
        { role: 'team_lead', branch_slug: 'bacoor' },
        { branch: 'imus' },
      ),
      false,
    )
  })

  it('allows Team Lead updating a booking on their branch', () => {
    assert.equal(
      canStaffUpdateBookingStatus(
        { role: 'team_lead', branch_slug: 'bacoor' },
        { branch: 'bacoor' },
      ),
      true,
    )
  })

  it('denies Team Lead with no branch_slug', () => {
    assert.equal(
      canStaffUpdateBookingStatus({ role: 'team_lead', branch_slug: null }, { branch: 'bacoor' }),
      false,
    )
  })

  it('allows Super Admin any branch; scopes Admin to assignments', () => {
    assert.equal(
      canStaffUpdateBookingStatus({ role: 'BossMich' }, { branch: 'batangas' }),
      true,
    )
    assert.equal(
      canStaffUpdateBookingStatus(
        { role: 'admin', branch_slugs: ['bacoor', 'imus'] },
        { branch: 'imus' },
      ),
      true,
    )
    assert.equal(
      canStaffUpdateBookingStatus(
        { role: 'admin', branch_slugs: ['bacoor'] },
        { branch: 'batangas' },
      ),
      false,
    )
  })
})

describe('provision-customer includes Team Lead (TL-C2)', () => {
  it('allows team_lead in QUEUE_PROVISION_ROLES', () => {
    assert.equal(QUEUE_PROVISION_ROLES.has('team_lead'), true)
    assert.equal(QUEUE_PROVISION_ROLES.has('BossMich'), true)
  })
})

describe('NO_BRANCH_SCOPE sentinel', () => {
  it('is the fail-closed token used by resolveBranchFilter', () => {
    assert.equal(NO_BRANCH_SCOPE, '__none__')
    const p = { role: ROLES.TEAM_LEAD, branch_slug: null, branch_slugs: [] }
    assert.equal(resolveBranchFilter(p, 'all'), NO_BRANCH_SCOPE)
  })
})
