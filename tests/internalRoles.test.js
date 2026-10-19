import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { generalAdminSheetGrants, internalRoleLabel, roleAccessSummary } from '../src/auth/internalRoles.js'
import { showBranchPicker } from '../src/lib/peopleDirectory.js'

describe('People shows the 19 Oct RBAC sheet', () => {
  it('labels match the sheet groups', () => {
    assert.equal(internalRoleLabel('BossMich'), 'Owner / Super Admin')
    assert.equal(internalRoleLabel('assistant_super_admin'), 'General Admin')
    assert.equal(internalRoleLabel('admin'), 'Branch Admin')
    assert.equal(internalRoleLabel('sales'), 'Customer Rep')
    assert.match(roleAccessSummary('team_lead'), /Cash advance/)
    assert.match(roleAccessSummary('investor'), /Read-only/)
  })

  it('Marketing and Customer Rep are all branches; Investor picks a branch', () => {
    assert.equal(showBranchPicker('marketing'), false)
    assert.equal(showBranchPicker('sales'), false)
    assert.equal(showBranchPicker('investor'), true)
    assert.equal(showBranchPicker('admin'), true)
  })

  it('a new General Admin starts with finance write and planning edit on', () => {
    const grants = generalAdminSheetGrants()
    assert.equal(grants.finance_write, true)
    assert.equal(grants.planning_edit, true)
    const page = readFileSync('src/pages/PeopleManagePage.jsx', 'utf8')
    assert.match(page, /generalAdminSheetGrants/)
    assert.match(page, /roleAccessSummary/)
  })
})
