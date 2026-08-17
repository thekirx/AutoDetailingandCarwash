import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isPlannerBoardVisible,
  pickPlannerBoard,
  plannerTabFromSearch,
  plannerTabsForAccess,
  PLANNER_TABS,
  visiblePlannerBoards,
} from '../src/lib/plannerBoard.js'

describe('plannerBoard', () => {
  it('hides complaint and archived boards', () => {
    assert.equal(isPlannerBoardVisible({ name: 'Planner' }), true)
    assert.equal(isPlannerBoardVisible({ name: 'Equipment Repairs' }), true)
    assert.equal(isPlannerBoardVisible({ name: 'Complaints' }), false)
    assert.equal(isPlannerBoardVisible({ name: 'Complaints (archived)' }), false)
    assert.equal(isPlannerBoardVisible({ name: 'Old (archived)' }), false)
  })

  it('picks a visible board and keeps tab ids stable', () => {
    const boards = [
      { id: '1', name: 'Complaints' },
      { id: '2', name: 'Planner' },
      { id: '3', name: 'Equipment Repairs' },
    ]
    assert.deepEqual(visiblePlannerBoards(boards).map((b) => b.name), ['Planner', 'Equipment Repairs'])
    assert.equal(pickPlannerBoard(boards, '3').name, 'Equipment Repairs')
    assert.equal(pickPlannerBoard(boards, 'missing').name, 'Planner')
    assert.equal(plannerTabFromSearch('forms'), 'forms')
    assert.equal(plannerTabFromSearch('nope'), 'board')
    assert.equal(plannerTabFromSearch(new URLSearchParams('tab=review')), 'review')
    assert.equal(plannerTabFromSearch(new URLSearchParams('tab=review'), ['board', 'calendar', 'events']), 'board')
    assert.deepEqual(PLANNER_TABS.map((t) => t.label), ['Tasks', 'Calendar', 'Forms', 'Events', 'Review'])
    assert.ok(PLANNER_TABS.every((t) => t.icon && t.hint))
    assert.deepEqual(plannerTabsForAccess({ canEdit: false }).map((t) => t.id), ['board', 'calendar', 'forms', 'events'])
    assert.ok(plannerTabsForAccess({ canEdit: true }).some((t) => t.id === 'review'))
  })

  it('hides Forms, Events, and Review for video editors', () => {
    assert.deepEqual(
      plannerTabsForAccess({ canEdit: false, role: 'video_editor' }).map((t) => t.id),
      ['board', 'calendar'],
    )
    assert.deepEqual(
      plannerTabsForAccess({ canEdit: true, role: 'video_editor' }).map((t) => t.id),
      ['board', 'calendar'],
    )
    assert.deepEqual(
      plannerTabsForAccess({ canEdit: false, role: 'staff' }).map((t) => t.id),
      ['board', 'calendar', 'forms', 'events'],
    )
  })
})
