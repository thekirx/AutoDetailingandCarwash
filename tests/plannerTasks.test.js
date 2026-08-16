import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { hrefForCalendarItem } from '../src/lib/plannerCalendar.js'
import {
  allowedReviewAssigneePatch,
  cardsFromAssigneeRows,
  filterPlannerCards,
  flattenPlannerCards,
  isHttpProofUrl,
  planProofObjectPath,
  reviewItemsFromAssigneeRows,
  reviewItemsFromBoard,
} from '../src/lib/plannerTasks.js'

const board = {
  plan_lists: [
    {
      id: 'l1',
      title: 'Upcoming',
      position: 0,
      plan_cards: [
        {
          id: 'c1',
          title: 'Wax bay 2',
          description: '',
          due_at: '2026-01-01T00:00:00.000Z',
          category_id: 'cat-ops',
          plan_card_assignees: [{ staff_id: 'u1', status: 'todo' }],
        },
      ],
    },
    {
      id: 'l2',
      title: 'In Progress',
      position: 1,
      plan_cards: [
        {
          id: 'c2',
          title: 'Photo set',
          due_at: null,
          category_id: 'cat-mkt',
          plan_card_assignees: [{ staff_id: 'u2', status: 'for_review', proof_note: 'done' }],
        },
      ],
    },
  ],
}

describe('planner tasks', () => {
  it('flattens cards and filters by assignee, category, review, and assigned-only', () => {
    const rows = flattenPlannerCards(board)
    assert.equal(rows.length, 2)
    assert.equal(rows[0].list_title, 'Upcoming')
    assert.equal(filterPlannerCards(rows, { categoryId: 'cat-mkt' }).length, 1)
    assert.equal(filterPlannerCards(rows, { status: 'for_review' })[0].id, 'c2')
    assert.equal(filterPlannerCards(rows, { assignedOnly: true, viewerId: 'u1' }).length, 1)
    assert.equal(filterPlannerCards(rows, { due: 'none' })[0].id, 'c2')
    assert.equal(filterPlannerCards(rows, { q: 'wax' })[0].id, 'c1')
    assert.equal(filterPlannerCards(rows, { status: 'todo' })[0].id, 'c1')
    assert.equal(filterPlannerCards(rows, { assigneeId: 'unassigned' }).length, 0)
    assert.equal(filterPlannerCards(rows, { due: 'today', now: '2026-01-01T12:00:00.000Z' })[0].id, 'c1')
    assert.equal(filterPlannerCards([{ ...rows[0], category_id: null }], { categoryId: 'none' }).length, 1)
  })

  it('builds a review inbox and accept/return patches', () => {
    const inbox = reviewItemsFromBoard(board)
    assert.equal(inbox.length, 1)
    assert.equal(inbox[0].assignee.staff_id, 'u2')
    assert.equal(allowedReviewAssigneePatch({ status: 'for_review' }, 'accept').status, 'done')
    assert.equal(allowedReviewAssigneePatch({ status: 'for_review' }, 'return').status, 'in_progress')
    assert.equal(allowedReviewAssigneePatch({ status: 'todo' }, 'accept'), null)
  })

  it('flattens assignee rows across boards for staff and review', () => {
    const rows = [
      {
        id: 'a1',
        staff_id: 'u1',
        status: 'todo',
        plan_cards: { id: 'c9', title: 'Pad wash', list_id: 'l9', plan_lists: { id: 'l9', title: 'Equipment' } },
      },
      {
        id: 'a2',
        staff_id: 'u2',
        status: 'for_review',
        plan_cards: { id: 'c8', title: 'Proof bay', list_id: 'l8', plan_lists: { id: 'l8', title: 'Planner' } },
      },
    ]
    const cards = cardsFromAssigneeRows(rows)
    assert.equal(cards.length, 2)
    assert.equal(cards.find((c) => c.id === 'c9').list_title, 'Equipment')
    assert.equal(cards.find((c) => c.id === 'c9').plan_card_assignees[0].staff_id, 'u1')
    const inbox = reviewItemsFromAssigneeRows(rows)
    assert.equal(inbox.length, 1)
    assert.equal(inbox[0].card.title, 'Proof bay')
  })

  it('maps calendar clicks to owning routes', () => {
    assert.equal(hrefForCalendarItem({ type: 'planning', card: { id: 'c1' } }), '/operations/planning?tab=board&card=c1')
    assert.equal(hrefForCalendarItem({ type: 'event', event: { id: 'e1' } }), '/operations/planning?tab=events&event=e1')
    assert.equal(hrefForCalendarItem({ type: 'booking', booking: { id: 'b1' } }), '/operations/bookings?id=b1')
    assert.equal(hrefForCalendarItem({ type: 'form', submission: { form_id: 'f1' } }), '/operations/planning?tab=forms&results=f1')
  })

  it('builds plan-proofs object paths and tells HTTP links from storage paths', () => {
    assert.equal(
      planProofObjectPath('uid-1', 'card-9', 'My Photo!.jpg', 1700000000000),
      'uid-1/card-9/1700000000000-My_Photo_.jpg',
    )
    assert.equal(isHttpProofUrl('https://drive.google.com/file'), true)
    assert.equal(isHttpProofUrl('uid-1/card-9/1700000000000-shot.jpg'), false)
  })
})
