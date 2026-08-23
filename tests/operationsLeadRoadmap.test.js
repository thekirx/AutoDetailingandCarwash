import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ROLES,
  allowRoute,
  canAccessOpsRoadmap,
  canAccessPos,
  canEditPlanning,
  canEditQueueOperations,
  canUseAttendanceClock,
  canViewOwnPay,
  canViewPlanning,
  getBranchScopeList,
  getOperationsNav,
  redirectForRole,
} from '../src/auth/permissions.js'
import {
  clampItemSize,
  newRoadmapItemDraft,
  normalizeViewport,
  screenToBoardDelta,
} from '../src/lib/opsRoadmap.js'

describe('Operations Lead + roadmap', () => {
  const ol = { role: ROLES.OPERATIONS_LEAD }

  it('has TL∪BA ops surface, all branches, My Pay, no clock', () => {
    assert.equal(getBranchScopeList(ol), null)
    assert.equal(canViewPlanning(ol), true)
    assert.equal(canEditPlanning(ol), true)
    assert.equal(canEditQueueOperations(ol), true)
    assert.equal(canAccessPos(ol), true)
    assert.equal(canViewOwnPay(ol), true)
    assert.equal(canUseAttendanceClock(ol), false)
    assert.equal(canAccessOpsRoadmap(ol), true)
    assert.equal(allowRoute(ol, 'roadmap'), true)
    assert.equal(allowRoute(ol, 'pos'), true)
    assert.equal(allowRoute(ol, 'planning'), true)
    assert.equal(allowRoute(ol, 'my-pay'), true)
    assert.equal(redirectForRole(ROLES.OPERATIONS_LEAD), '/operations/roadmap')
    const nav = getOperationsNav(ol).map((i) => i.to)
    assert.ok(nav.includes('/operations/roadmap'))
    assert.ok(nav.includes('/operations/planning'))
    assert.ok(nav.includes('/operations/pos'))
    assert.ok(nav.includes('/operations/my-pay'))
    assert.ok(!nav.includes('/operations/attendance'))
  })

  it('roadmap is shared with SA, ASA, BA — not crew/TL', () => {
    assert.equal(canAccessOpsRoadmap({ role: ROLES.SUPER_ADMIN }), true)
    assert.equal(canAccessOpsRoadmap({ role: ROLES.ASSISTANT_SUPER_ADMIN }), true)
    assert.equal(canAccessOpsRoadmap({ role: ROLES.ADMIN }), true)
    assert.equal(canAccessOpsRoadmap({ role: ROLES.TEAM_LEAD }), false)
    assert.equal(canAccessOpsRoadmap({ role: ROLES.STAFF }), false)
    assert.equal(allowRoute({ role: ROLES.ADMIN, branch_slug: 'bacoor' }, 'roadmap'), true)
  })

  it('opsRoadmap helpers normalize viewport and drafts', () => {
    assert.deepEqual(normalizeViewport({ x: 10, y: -4, zoom: 3 }), { x: 10, y: -4, zoom: 2.5 })
    const draft = newRoadmapItemDraft({ boardId: 'b1', kind: 'note', x: 50, y: 60 })
    assert.equal(draft.board_id, 'b1')
    assert.equal(draft.kind, 'note')
    assert.equal(clampItemSize('note', 50, 40).w, 120)
    assert.deepEqual(screenToBoardDelta(100, 50, 2), { dx: 50, dy: 25 })
  })
})
