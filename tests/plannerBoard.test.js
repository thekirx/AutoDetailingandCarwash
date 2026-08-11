import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isPlannerBoardVisible,
  pickPlannerBoard,
  plannerTabFromSearch,
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
    assert.deepEqual(PLANNER_TABS.map((t) => t.label), ['Tasks', 'Calendar', 'Forms', 'Events', 'Setup'])
    assert.ok(PLANNER_TABS.every((t) => t.icon && t.hint))
  })
})
