import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_PLAN_LISTS,
  PLANNER_SWATCHES,
  PLAN_BOARDS_LIST_SELECT,
  PLAN_BOARD_DETAIL_SELECT,
  defaultPlanListId,
  isPlannerBoardVisible,
  listCardCount,
  nextPlanCardPosition,
  nextPlanListPosition,
  pickPlannerBoard,
  plannerBoardNameError,
  plannerSwatchValue,
  plannerTabFromSearch,
  plannerTabsForAccess,
  plannerListOptions,
  reorderPlanRows,
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
    assert.deepEqual(PLANNER_TABS.map((t) => t.label), ['Tasks', 'Calendar', 'Forms', 'Events', 'Review', 'Configure'])
    assert.ok(PLANNER_TABS.every((t) => t.icon && t.hint))
    assert.deepEqual(plannerTabsForAccess({ canEdit: false }).map((t) => t.id), ['board', 'calendar', 'forms', 'events'])
    assert.deepEqual(
      plannerTabsForAccess({ canEdit: true }).map((t) => t.id),
      ['board', 'calendar', 'forms', 'events', 'review', 'configure'],
    )
    assert.equal(plannerTabFromSearch('configure'), 'configure')
    assert.equal(plannerTabFromSearch(new URLSearchParams('tab=configure'), ['board', 'calendar']), 'board')
    assert.equal(plannerBoardNameError(''), 'Name is required')
    assert.match(plannerBoardNameError('Complaints'), /Forms/)
    assert.equal(plannerBoardNameError('Planner'), '')
    assert.equal(nextPlanListPosition([]), 0)
    assert.equal(nextPlanListPosition([{ position: 0 }, { position: 2 }]), 3)
    assert.equal(listCardCount({ plan_cards: [{}, {}] }), 2)
    assert.equal(listCardCount({}), 0)
    assert.deepEqual(DEFAULT_PLAN_LISTS.map((l) => l.title), ['Upcoming', 'In Progress', 'Done'])
    assert.ok(PLANNER_SWATCHES.includes('#052699'))
    assert.ok(PLANNER_SWATCHES.includes('#c4a35a'))
    assert.equal(plannerSwatchValue('navy'), '#052699')
    assert.equal(plannerSwatchValue('#C4A35A'), '#C4A35A')
  })

  it('selects live plan_boards columns (name, not title/kind/position)', () => {
    assert.equal(PLAN_BOARDS_LIST_SELECT, 'id, name')
    assert.match(PLAN_BOARD_DETAIL_SELECT, /id, name/)
    assert.match(PLAN_BOARD_DETAIL_SELECT, /proof_required/)
    assert.doesNotMatch(PLAN_BOARD_DETAIL_SELECT, /\bkind\b/)
    assert.doesNotMatch(PLAN_BOARDS_LIST_SELECT, /title/)
    assert.equal(defaultPlanListId([{ id: 'a' }, { id: 'b' }]), 'a')
    assert.equal(defaultPlanListId([{ id: 'a' }, { id: 'b' }], 'b'), 'b')
    assert.equal(defaultPlanListId([], 'x'), '')
    assert.equal(nextPlanCardPosition([{ id: 'a', plan_cards: [{ position: 2 }, { position: 5 }] }], 'a'), 6)
    assert.equal(nextPlanCardPosition([{ id: 'a', plan_cards: [] }], 'a'), 0)
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

  it('reorders lists with duplicate positions and keeps staff list options', () => {
    assert.deepEqual(
      reorderPlanRows(
        [
          { id: 'a', position: 0 },
          { id: 'b', position: 0 },
          { id: 'c', position: 0 },
        ],
        'a',
        1,
      ),
      [
        { id: 'b', position: 0 },
        { id: 'a', position: 1 },
        { id: 'c', position: 2 },
      ],
    )
    assert.deepEqual(reorderPlanRows([{ id: 'a', position: 0 }], 'a', -1), [])
    assert.deepEqual(plannerListOptions([], { list_id: 'l1', list_title: 'New' }), [{ id: 'l1', title: 'New' }])
    assert.deepEqual(plannerListOptions([{ id: 'x', title: 'Upcoming' }], { list_id: 'l1' }), [{ id: 'x', title: 'Upcoming' }])
  })
})
