import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { canEditDailySheet, canReviewDailySheet } from '../src/lib/dailySheet.js'
import { ROLES } from '../src/auth/permissions.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

describe('Daily Sheet RBAC — Owner, Lucy, Robert, and Branch Admin', () => {
  it('Owner (BossMich) can edit and review daily sheets', () => {
    const owner = { id: 'owner-1', role: 'BossMich', full_name: 'BossMich' }
    assert.equal(canEditDailySheet(owner), true)
    assert.equal(canReviewDailySheet(owner), true)
  })

  it('Super Admin can edit and review daily sheets', () => {
    const sa = { id: 'sa-1', role: ROLES.SUPER_ADMIN, full_name: 'Super Admin' }
    assert.equal(canEditDailySheet(sa), true)
    assert.equal(canReviewDailySheet(sa), true)
  })

  it('Lucy (Assistant Super Admin) can edit and review daily sheets', () => {
    const lucy1 = { id: 'lucy-1', role: ROLES.ASSISTANT_SUPER_ADMIN, full_name: 'Luci', permission_grants: {} }
    const lucy2 = { id: 'lucy-2', role: ROLES.ASSISTANT_SUPER_ADMIN, full_name: 'Lucy Cuady', permission_grants: {} }
    assert.equal(canEditDailySheet(lucy1), true)
    assert.equal(canReviewDailySheet(lucy1), true)
    assert.equal(canEditDailySheet(lucy2), true)
    assert.equal(canReviewDailySheet(lucy2), true)
  })

  it('Robert (Assistant Super Admin) can edit and review daily sheets', () => {
    const robert = { id: 'robert-1', role: ROLES.ASSISTANT_SUPER_ADMIN, full_name: 'Robert', permission_grants: {} }
    assert.equal(canEditDailySheet(robert), true)
    assert.equal(canReviewDailySheet(robert), true)
  })

  it('Branch Admin can edit daily sheets, but cannot review/approve them', () => {
    const admin = { id: 'admin-1', role: ROLES.ADMIN, full_name: 'Branch Admin' }
    assert.equal(canEditDailySheet(admin), true)
    assert.equal(canReviewDailySheet(admin), false)
  })

  it('Assistant Super Admin with grants can edit (pos/finance_write) and review (finance_view)', () => {
    const asaEdit = { id: 'asa-edit', role: ROLES.ASSISTANT_SUPER_ADMIN, full_name: 'Generic ASA', permission_grants: { pos: true } }
    const asaReview = { id: 'asa-review', role: ROLES.ASSISTANT_SUPER_ADMIN, full_name: 'Generic ASA', permission_grants: { finance_view: true } }
    const asaNone = { id: 'asa-none', role: ROLES.ASSISTANT_SUPER_ADMIN, full_name: 'Generic ASA', permission_grants: { pos: false, finance_write: false, finance_view: false } }

    assert.equal(canEditDailySheet(asaEdit), true)
    assert.equal(canReviewDailySheet(asaReview), true)
    assert.equal(canEditDailySheet(asaNone), false)
    assert.equal(canReviewDailySheet(asaNone), false)
  })

  it('Staff, Detailer, and Investor cannot edit daily sheets', () => {
    for (const role of [ROLES.STAFF, ROLES.DETAILER, ROLES.INVESTOR, ROLES.SALES, ROLES.MARKETING]) {
      const p = { id: 'user-x', role, full_name: 'Floor Staff' }
      assert.equal(canEditDailySheet(p), false)
      assert.equal(canReviewDailySheet(p), false)
    }
  })
})

describe('Daily Sheet Returned correction & re-approval contracts', () => {
  it('DailySheetPanel allows editing when status is returned or draft', () => {
    const panelCode = read('src/pages/pos/DailySheetPanel.jsx')
    assert.match(panelCode, /const editable = canEdit && \(isDraft \|\| isReturned\)/)
    assert.match(panelCode, /Submit for re-approval/)
    assert.match(panelCode, /Returned for correction/)
  })

  it('FinanceDailySheetsTab provides an explicit edit & correct path for returned sheets', () => {
    const tabCode = read('src/pages/finance/FinanceDailySheetsTab.jsx')
    assert.match(tabCode, /Edit &amp; correct/)
    assert.match(tabCode, /Edit & correct returned daily sheet/)
  })

  it('BookingBoardPage supports specific date filter and robust card headers', () => {
    const boardCode = read('src/pages/BookingBoardPage.jsx')
    assert.match(boardCode, /value="specific">Specific date/)
    assert.match(boardCode, /aria-label="Specific date"/)
    assert.match(boardCode, /bk-ticket-header/)
  })
})
