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
  catalogStatusesToOptions,
  catalogTypesToOptions,
  clampItemSize,
  filterBoards,
  filterSuggestions,
  flattenLabRows,
  itemDocumentHref,
  newBoardDraft,
  newRoadmapItemDraft,
  newSuggestionDraft,
  normalizeOpsLabSlug,
  normalizeViewport,
  screenToBoardDelta,
  suggestionKindLabel,
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
    const flat = flattenLabRows(
      [
        { id: 'i1', board_id: 'b1', kind: 'action', title: 'Fix queue', item_status: 'open', updated_at: '2026-01-02' },
        { id: 'i2', board_id: 'b1', kind: 'frame', title: 'Skip me', item_status: 'open' },
      ],
      [{ id: 'b1', board_kind: 'plan', title: 'Q3' }],
    )
    assert.equal(flat.length, 1)
    assert.equal(flat[0].board_kind, 'plan')
    assert.equal(filterSuggestions(flat, { kind: 'plan', status: 'open', q: 'queue' }).length, 1)
    assert.equal(suggestionKindLabel({ kind: 'form_link' }), 'Document')
    assert.equal(itemDocumentHref({ kind: 'form_link', meta: { url: '/operations/inquiries' } }), '/operations/inquiries')
    const sug = newSuggestionDraft({ boardId: 'b1', title: 'New idea', linkUrl: 'https://docs.example.com', createdBy: 'u1' })
    assert.equal(sug.kind, 'form_link')
    assert.equal(sug.meta.url, 'https://docs.example.com')
  })

  it('custom catalog + status notify + slug', () => {
    assert.equal(normalizeOpsLabSlug('In Review'), 'in_review')
    assert.equal(normalizeOpsLabSlug('  Blocked!! '), 'blocked')
    const types = catalogTypesToOptions([
      { id: '1', slug: 'pilot', label: 'Pilot', hint: 'Trial', sort_order: 5, is_archived: false },
      { id: '2', slug: 'old', label: 'Old', sort_order: 1, is_archived: true },
    ])
    assert.equal(types.length, 1)
    assert.equal(types[0].value, 'pilot')
    const statuses = catalogStatusesToOptions([
      { id: 's1', slug: 'blocked', label: 'Blocked', badge: 'destructive', sort_order: 15, is_archived: false },
    ])
    assert.equal(statuses[0].badge, 'destructive')
    assert.equal(catalogTypesToOptions([]).length, 4)
    const statusCopy = buildOpsLabNotifyCopy({
      event: 'status_changed',
      boardId: 'b1',
      actorName: 'Mal',
      itemTitle: 'Fix queue',
      fromStatus: 'Open',
      toStatus: 'Doing',
    })
    assert.equal(statusCopy.kind, 'ops_lab.status_changed')
    assert.match(statusCopy.body, /Open → Doing/)
    const delCopy = buildOpsLabNotifyCopy({
      event: 'item_deleted',
      boardId: 'b1',
      boardKind: 'plan',
      actorName: 'Mal',
      itemTitle: 'Gone',
    })
    assert.equal(delCopy.kind, 'ops_lab.item_deleted')
  })
})
