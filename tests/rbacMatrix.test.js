import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  ROLES,
  allowRoute,
  canAccessBookingBoard,
  canAccessCrm,
  canAccessFloorBoard,
  canAccessPos,
  canEditBookings,
  canEditCrm,
  canEditPlanning,
  canEditQueueOperations,
  canManageVouchers,
  canSeeAllBranches,
  canViewQueueBoard,
  canViewVouchers,
  canAccessAttendance,
  canSendCustomerSms,
} from '../src/auth/permissions.js'
import { QUEUE_PROVISION_ROLES } from '../server/provisionCustomer.mjs'
import { hidesCashAdvancePlannerBoard, visiblePlannerBoards } from '../src/lib/plannerBoard.js'

const sa = { role: ROLES.SUPER_ADMIN }
const ga = { role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: {} }
const tl = { role: ROLES.TEAM_LEAD, branch_slug: 'bacoor' }
const ba = { role: ROLES.ADMIN, branch_slug: 'bacoor' }
const mk = { role: ROLES.MARKETING }
const rep = { role: ROLES.SALES }
const inv = { role: ROLES.INVESTOR, branch_slug: 'bacoor' }

describe('19 Oct RBAC matrix', () => {
  it('is written down in docs/OPS/RBAC-MATRIX.md', () => {
    const doc = readFileSync('docs/OPS/RBAC-MATRIX.md', 'utf8')
    assert.match(doc, /Michihiko/)
    assert.match(doc, /Cash advance/)
    assert.match(doc, /Customer Rep/)
  })

  it('Floor Board is Owner/Super Admin and crew only', () => {
    assert.equal(canAccessFloorBoard(sa), true)
    assert.equal(canAccessFloorBoard({ role: ROLES.STAFF }), true)
    for (const p of [ga, tl, ba, mk, rep, inv]) assert.equal(canAccessFloorBoard(p), false, p.role)
  })

  it('queue and detailing match the sheet', () => {
    assert.equal(canEditQueueOperations(sa), true)
    assert.equal(canEditQueueOperations(ga), true)
    assert.equal(canEditQueueOperations(tl), true)
    assert.equal(canEditQueueOperations(ba), false)
    assert.equal(canViewQueueBoard(ba), true)
    assert.equal(canViewQueueBoard(mk), true)
    assert.equal(canViewQueueBoard(rep), true)
    assert.equal(canViewQueueBoard(inv), true)
    assert.equal(canAccessBookingBoard(ba), true)
    assert.equal(canEditBookings(rep), false)
    assert.equal(canAccessBookingBoard(inv), true)
    assert.equal(allowRoute(ba, 'queue'), true)
    assert.equal(allowRoute(ba, 'dashboard'), false)
  })

  it('hides the cash advance planner board from partial roles', () => {
    const boards = [{ name: 'Hakum Planner' }, { name: 'Cash advance' }]
    assert.equal(hidesCashAdvancePlannerBoard(tl), true)
    assert.equal(hidesCashAdvancePlannerBoard(ba), true)
    assert.equal(hidesCashAdvancePlannerBoard(mk), true)
    assert.equal(hidesCashAdvancePlannerBoard(rep), true)
    assert.equal(hidesCashAdvancePlannerBoard(sa), false)
    assert.deepEqual(visiblePlannerBoards(boards, tl).map((b) => b.name), ['Hakum Planner'])
    assert.deepEqual(visiblePlannerBoards(boards, sa).map((b) => b.name), ['Hakum Planner', 'Cash advance'])
    assert.equal(canEditPlanning(rep), false)
    assert.equal(allowRoute(inv, 'planning'), false)
  })

  it('money, vouchers, HR, and customers match the sheet', () => {
    assert.equal(canAccessPos(ba), true)
    assert.equal(canAccessPos(tl), false)
    assert.equal(allowRoute(inv, 'pos'), true)
    assert.equal(canManageVouchers(inv), false)
    assert.equal(canViewVouchers(inv), true)
    assert.equal(canManageVouchers(tl), false)
    assert.equal(allowRoute(ba, 'finance'), true)
    assert.equal(allowRoute(tl, 'finance'), false)
    assert.equal(canAccessAttendance(tl), true)
    assert.equal(canAccessAttendance(mk), false)
    assert.equal(canAccessAttendance(rep), false)
    assert.equal(canAccessCrm(tl), true)
    assert.equal(canEditCrm(tl), false)
    assert.equal(canEditCrm(ba), true)
    assert.equal(canEditCrm(mk), false)
    assert.equal(canEditCrm(rep), true)
    assert.equal(canAccessCrm(inv), false)
    assert.equal(canSeeAllBranches(mk), true)
    assert.equal(canSeeAllBranches(tl), false)
    assert.equal(canSendCustomerSms(ba), true)
    assert.equal(canSendCustomerSms(rep), false)
    assert.equal(canSendCustomerSms(mk), false)
    assert.equal(QUEUE_PROVISION_ROLES.has('sales'), true)
    assert.equal(QUEUE_PROVISION_ROLES.has('marketing'), false)
  })

  it('database write locks match the sheet', () => {
    const sql = readFileSync('supabase/migrations/20261019180000_rbac_sheet_write_locks.sql', 'utf8')
    assert.match(sql, /current_user_role\(\) is distinct from 'admin'/)
    assert.doesNotMatch(sql, /current_user_role\(\) = 'sales'[\s\S]{0,80}bookings/)
    assert.match(sql, /'admin', 'team_lead', 'BossMich', 'sales'/)
    assert.doesNotMatch(sql, /customers_update[\s\S]*marketing/)
  })
})
