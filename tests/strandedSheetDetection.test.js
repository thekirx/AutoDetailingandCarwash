import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { findStrandedSheets } from '../scripts/lib/stranded-sheets.mjs'

/**
 * BUG-085's guard can strand a Daily Sheet: if the only eligible reviewer is
 * the person who filed it, the sheet can never be approved, and
 * reopen_daily_sheet accepts only 'approved' sheets, so there is no recovery.
 *
 * The production probe currently reports "no stranded sheets", which is an
 * empty result. An empty result from a detector that cannot detect is
 * indistinguishable from a clean system, and that ambiguity is exactly how a
 * green all-clear gets believed without anyone checking. So the decision is a
 * pure function here, exercised against a synthetic case that MUST strand.
 */

const SA = { id: 'sa', role: 'BossMich', is_active: true, is_archived: false }
const ASA = { id: 'asa', role: 'assistant_super_admin', is_active: true, is_archived: false, permission_grants: { finance_view: true } }
const ASA_NO_FINANCE = { id: 'asa2', role: 'assistant_super_admin', is_active: true, is_archived: false, permission_grants: { finance_view: false } }
const BA = { id: 'ba', role: 'admin', is_active: true, is_archived: false }
const sheet = (over = {}) => ({ id: 's1', status: 'submitted', submitted_by: 'ba', ...over })

describe('a sheet can only strand when no eligible reviewer is left but its submitter', () => {
  it('detects the stranded case — the control that makes "no strands" mean anything', () => {
    // A lone ASA filed it, and the Super Admin is deactivated. Nothing else.
    const { stranded } = findStrandedSheets([sheet({ submitted_by: 'asa' })], [ASA, { ...SA, is_active: false }])
    assert.equal(stranded.length, 1, 'the detector cannot detect a stranded sheet')
    assert.equal(stranded[0].submitted_by, 'asa')
  })

  it('a live Super Admin rescues any sheet, so it is not stranded', () => {
    const { stranded } = findStrandedSheets([sheet({ submitted_by: 'asa' })], [ASA, SA])
    assert.deepEqual(stranded, [])
  })

  it('a Branch Admin is not an approver and cannot rescue anything', () => {
    // The BA filed it and only a BA could review -- a second BA does not help,
    // because daily_sheet_can_review() excludes the role outright. Counting BAs
    // as approvers here would under-report the risk.
    const { stranded } = findStrandedSheets([sheet({ submitted_by: 'ba1' })], [BA, { ...BA, id: 'ba2' }])
    assert.equal(stranded.length, 1, 'a second Branch Admin was wrongly counted as an approver')
  })

  it('a second ASA holding finance_view does rescue it', () => {
    const { stranded } = findStrandedSheets([sheet({ submitted_by: 'asa' })], [ASA, { ...ASA, id: 'asa2' }])
    assert.deepEqual(stranded, [])
  })

  it('an ASA without finance_view is not an approver', () => {
    const { stranded } = findStrandedSheets([sheet({ submitted_by: 'asa' })], [ASA_NO_FINANCE, { ...ASA_NO_FINANCE, id: 'asa2' }])
    assert.equal(stranded.length, 1, 'finance_view:false was treated as an approver')
  })

  it('a deactivated or archived approver does not count', () => {
    const inactive = [ASA, { ...SA, is_active: false }, { ...ASA, id: 'asa2', is_archived: true }]
    assert.equal(findStrandedSheets([sheet({ submitted_by: 'asa' })], inactive).stranded.length, 1)
  })

  it('only waiting statuses can strand — approved and draft are terminal', () => {
    for (const status of ['approved', 'draft']) {
      assert.equal(
        findStrandedSheets([sheet({ status, submitted_by: 'asa' })], [ASA, { ...SA, is_active: false }]).stranded.length,
        0,
        `a ${status} sheet cannot be stranded`,
      )
    }
  })

  it('returned counts as waiting, because it still needs a reviewer', () => {
    assert.equal(findStrandedSheets([sheet({ status: 'returned', submitted_by: 'asa' })], [ASA, { ...SA, is_active: false }]).stranded.length, 1)
  })

  it('a sheet nobody has submitted is not a self-approval case', () => {
    assert.equal(findStrandedSheets([sheet({ submitted_by: null })], [{ ...SA, is_active: false }]).stranded.length, 0)
  })

  it('reports the waiting set and the approver pool, so an all-clear is informative', () => {
    const { waiting, superAdmins, financeAsas } = findStrandedSheets(
      [sheet(), sheet({ id: 's2', status: 'returned' }), sheet({ id: 's3', status: 'approved' })],
      [SA, ASA],
    )
    assert.equal(waiting.length, 2, 'approved sheets must not be counted as waiting')
    assert.equal(superAdmins.length, 1)
    assert.equal(financeAsas.length, 1)
  })

  it('with no approvers at all every waiting sheet is stranded', () => {
    assert.equal(findStrandedSheets([sheet({ submitted_by: 'ba' })], []).stranded.length, 1)
  })
})