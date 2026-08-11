import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ROLES,
  allowRoute,
  canAccessConsole,
  canAccessFinance,
  canAccessPos,
  canEditQueueOperations,
  canManageCrew,
  canViewAssignedTasks,
  canViewQueueOperations,
  getOperationsNav,
  redirectForRole,
} from '../src/auth/permissions.js'
import {
  allowedStaffAssignmentPatch,
  allowedStaffPlanAssigneePatch,
} from '../src/queue/staffTaskLogic.js'

describe('Staff capability matrix', () => {
  const p = { role: ROLES.STAFF, branch_slug: 'bacoor', branch_slugs: ['bacoor'] }

  it('allows attendance + my-tasks; denies floor queue POS finance console crew bookings', () => {
    assert.equal(canViewAssignedTasks(p), true)
    assert.equal(allowRoute(p, 'my-tasks'), true)
    assert.equal(allowRoute(p, 'attendance'), true)
    assert.equal(redirectForRole(ROLES.STAFF), '/operations/attendance')
    assert.equal(canViewQueueOperations(p), false)
    assert.equal(canEditQueueOperations(p), false)
    assert.equal(allowRoute(p, 'dashboard'), false)
    assert.equal(allowRoute(p, 'queue'), false)
    assert.equal(allowRoute(p, 'queue-new'), false)
    assert.equal(allowRoute(p, 'crew'), false)
    assert.equal(allowRoute(p, 'kpi'), false)
    assert.equal(allowRoute(p, 'pos'), false)
    assert.equal(allowRoute(p, 'finance'), false)
    assert.equal(allowRoute(p, 'console'), false)
    assert.equal(allowRoute(p, 'bookings'), false)
    assert.equal(allowRoute(p, 'people'), false)
    assert.equal(canAccessPos(p), false)
    assert.equal(canAccessFinance(p), false)
    assert.equal(canAccessConsole(p), false)
    assert.equal(canManageCrew(p), false)
    assert.equal(allowRoute(p, 'planning'), true)
    assert.deepEqual(
      getOperationsNav(p).map((i) => i.to),
      ['/operations/attendance', '/operations/my-tasks', '/operations/planning?tab=forms'],
    )
  })
})

describe('Staff assignment patch whitelist (STF-C3)', () => {
  it('allows acknowledge pending → active with started_at only', () => {
    const patch = allowedStaffAssignmentPatch({ status: 'pending' }, { status: 'active' })
    assert.equal(patch.status, 'active')
    assert.ok(patch.started_at)
    assert.equal(Object.keys(patch).sort().join(','), 'started_at,status')
  })

  it('allows complete active → released with released_at', () => {
    const patch = allowedStaffAssignmentPatch({ status: 'active' }, { status: 'released' })
    assert.equal(patch.status, 'released')
    assert.ok(patch.released_at)
  })

  it('rejects booking_id or staff_id mutation attempts', () => {
    assert.equal(
      allowedStaffAssignmentPatch(
        { status: 'pending', booking_id: 'a' },
        { status: 'active', booking_id: 'b' },
      ),
      null,
    )
    assert.equal(
      allowedStaffAssignmentPatch({ status: 'active' }, { status: 'released', staff_id: 'x' }),
      null,
    )
  })

  it('rejects illegal status jumps', () => {
    assert.equal(allowedStaffAssignmentPatch({ status: 'pending' }, { status: 'released' }), null)
    assert.equal(allowedStaffAssignmentPatch({ status: 'released' }, { status: 'active' }), null)
  })
})

describe('Staff plan assignee patch whitelist (STF-H4)', () => {
  it('allows todo → in_progress and in_progress → done', () => {
    assert.equal(allowedStaffPlanAssigneePatch({ status: 'todo' }, { status: 'in_progress' })?.status, 'in_progress')
    assert.equal(allowedStaffPlanAssigneePatch({ status: 'in_progress' }, { status: 'done' })?.status, 'done')
  })

  it('rejects card_id mutation', () => {
    assert.equal(
      allowedStaffPlanAssigneePatch({ status: 'todo', card_id: '1' }, { status: 'in_progress', card_id: '2' }),
      null,
    )
  })
})
