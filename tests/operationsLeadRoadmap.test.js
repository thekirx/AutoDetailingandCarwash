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
import { opsRouteKeyFromPath, resolvePostLoginPath } from '../src/auth/authRedirect.js'
import {
  buildOpsLabNotifyCopy,
  clampItemSize,
  filterBoards,
  newBoardDraft,
  newRoadmapItemDraft,
  normalizeViewport,
  screenToBoardDelta,
} from '../src/lib/opsRoadmap.js'

describe('Operations Lead + Ops Lab', () => {
  const ol = { role: ROLES.OPERATIONS_LEAD }

  it('sidebar Ops Lab for SA, ASA, BA, OL — not crew/TL', () => {
    for (const p of [
      { role: ROLES.SUPER_ADMIN },
      { role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: {} },
      { role: ROLES.ADMIN, branch_slug: 'bacoor' },
      ol,
    ]) {
      assert.equal(canAccessOpsRoadmap(p), true, p.role)
      assert.equal(allowRoute(p, 'roadmap'), true, p.role)
      assert.ok(
        getOperationsNav(p).some((i) => i.to === '/operations/roadmap' && i.label === 'Ops Lab'),
        `${p.role} nav`,
      )
    }
    assert.equal(canAccessOpsRoadmap({ role: ROLES.TEAM_LEAD }), false)
    assert.equal(canAccessOpsRoadmap({ role: ROLES.STAFF }), false)
    assert.ok(!getOperationsNav({ role: ROLES.TEAM_LEAD, branch_slug: 'bacoor' }).some((i) => i.to === '/operations/roadmap'))
  })

  it('OL has TL∪BA ops, all branches, My Pay, no clock; deep-link key works', () => {
    assert.equal(getBranchScopeList(ol), null)
    assert.equal(canViewPlanning(ol), true)
    assert.equal(canEditPlanning(ol), true)
    assert.equal(canEditQueueOperations(ol), true)
    assert.equal(canAccessPos(ol), true)
    assert.equal(canViewOwnPay(ol), true)
    assert.equal(canUseAttendanceClock(ol), false)
    assert.equal(redirectForRole(ROLES.OPERATIONS_LEAD), '/operations/roadmap')
    assert.equal(opsRouteKeyFromPath('/operations/roadmap'), 'roadmap')
    assert.equal(resolvePostLoginPath(ol, '/operations/roadmap'), '/operations/roadmap')
  })

  it('board kinds + notify copy + filters', () => {
    const draft = newBoardDraft({ title: 'Q3 wash speed', boardKind: 'plan', createdBy: 'u1' })
    assert.equal(draft.board_kind, 'plan')
    assert.equal(draft.status, 'open')
    const item = newRoadmapItemDraft({ boardId: 'b1', kind: 'complaint_link' })
    assert.equal(item.kind, 'complaint_link')
    assert.equal(item.color, 'rose')
    assert.deepEqual(normalizeViewport({ x: 10, y: -4, zoom: 3 }), { x: 10, y: -4, zoom: 2.5 })
    assert.equal(clampItemSize('note', 50, 40).w, 120)
    assert.deepEqual(screenToBoardDelta(100, 50, 2), { dx: 50, dy: 25 })
    const copy = buildOpsLabNotifyCopy({
      event: 'board_created',
      boardTitle: 'Q3 wash speed',
      boardKind: 'plan',
      boardId: 'abc',
      actorName: 'Mal',
    })
    assert.equal(copy.kind, 'ops_lab.board_created')
    assert.match(copy.url, /board=abc/)
    const filtered = filterBoards(
      [
        { title: 'Wash', board_kind: 'plan', status: 'open' },
        { title: 'Tint', board_kind: 'solution', status: 'done' },
      ],
      { kind: 'plan', status: 'all', q: 'wash' },
    )
    assert.equal(filtered.length, 1)
  })
})
