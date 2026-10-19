/**
 * Michi C1 — crew my advances; B9 — equipment repair staff-only.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  cashAdvanceAmountMinor,
  cashAdvanceStatusMeta,
  formatCashAdvancePesos,
} from '../src/lib/myCashAdvances.js'
import {
  ROLES,
  allowRoute,
  canAccessMyAdvances,
  canSubmitOpsFormKind,
  getStaffDock,
} from '../src/auth/permissions.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

describe('my cash advances helpers', () => {
  it('maps pesos payload and status labels', () => {
    assert.equal(cashAdvanceAmountMinor({ amount: 500 }), 50000)
    assert.equal(formatCashAdvancePesos({ amount: 500 }).includes('500'), true)
    assert.equal(cashAdvanceStatusMeta({ status: 'new' }).id, 'pending')
    assert.equal(cashAdvanceStatusMeta({ status: 'archived' }).id, 'declined')
    assert.equal(
      cashAdvanceStatusMeta({ status: 'resolved', payload: { approval_code: 'CA12AB' } }).id,
      'approved',
    )
  })
})

describe('my advances access + route', () => {
  it('crew and BA can open my-advances; Super Admin cannot', () => {
    const staff = { role: ROLES.STAFF }
    const ba = { role: ROLES.ADMIN, branch_slug: 'bacoor' }
    const sa = { role: ROLES.SUPER_ADMIN }
    assert.equal(canAccessMyAdvances(staff), true)
    assert.equal(canAccessMyAdvances(ba), true)
    assert.equal(canAccessMyAdvances(sa), false)
    assert.equal(allowRoute(staff, 'my-advances'), true)
    assert.equal(allowRoute(ba, 'my-advances'), true)
    assert.equal(allowRoute(sa, 'my-advances'), false)
    assert.ok(getStaffDock(staff).some((i) => i.to === '/operations/my-advances'))
  })

  it('page queries own cash_advance submissions', () => {
    const page = read('src/pages/MyCashAdvancesPage.jsx')
    assert.match(page, /ops_form_submissions/)
    assert.match(page, /cash_advance/)
    assert.match(page, /created_by/)
    assert.match(page, /My advances/)
    const app = read('src/App.jsx')
    assert.match(app, /my-advances/)
    assert.match(app, /MyCashAdvancesPage/)
  })
})

describe('equipment repair staff-only (B9)', () => {
  it('only role staff may submit equipment_repair', () => {
    assert.equal(canSubmitOpsFormKind({ role: ROLES.STAFF }, 'equipment_repair'), true)
    assert.equal(canSubmitOpsFormKind({ role: ROLES.DETAILER }, 'equipment_repair'), false)
    assert.equal(canSubmitOpsFormKind({ role: ROLES.TEAM_LEAD }, 'equipment_repair'), false)
    assert.equal(canSubmitOpsFormKind({ role: ROLES.ADMIN }, 'equipment_repair'), false)
    assert.equal(canSubmitOpsFormKind({ role: ROLES.SUPER_ADMIN }, 'equipment_repair'), false)
    const sql = read('supabase/migrations/20261009150000_planner_rls_match_app.sql')
    assert.match(sql, /when 'equipment_repair' then public\.current_user_role\(\) = 'staff'/)
  })
})
