/**
 * Hospitality ops seams: shift close, payroll custom/adj, notes, roles, expense reports.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateCustomerNote, isRegularGuest } from '../src/lib/customerNotes.js'
import { validateRoleDefinition } from '../src/lib/roleDefinitions.js'
import { normalizePlate } from '../src/lib/customerAuth.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')


describe('customer notes', () => {
  it('validates body and normalizes plate', () => {
    const bad = validateCustomerNote({ body: '', noteType: 'like' })
    assert.equal(bad.ok, false)
    const good = validateCustomerNote({ body: 'Loves soft towels', noteType: 'like', plate: 'abc-123' })
    assert.equal(good.ok, true)
    assert.equal(good.plate_normalized, normalizePlate('abc-123'))
    assert.equal(isRegularGuest([{ id: 1 }]), true)
  })

  it('queue/CRM/inquiries wire customer_notes', () => {
    const q = readFileSync(join(root, 'src/components/QueueTicketEditor.jsx'), 'utf8')
    const c = readFileSync(join(root, 'src/pages/crm/CustomerProfileDialog.jsx'), 'utf8')
    const i = readFileSync(join(root, 'src/pages/InquiriesPage.jsx'), 'utf8')
    assert.match(q, /CustomerNotesPanel/)
    assert.match(c, /value="notes"/)
    assert.match(c, /CustomerNotesPanel/)
    assert.match(i, /Promote to customer note/)
    assert.doesNotMatch(readFileSync(join(root, 'src/pages/PublicQueuePage.jsx'), 'utf8'), /customer_notes/)
  })
})

describe('role definitions', () => {
  it('rejects bad keys and unknown grants', () => {
    assert.equal(validateRoleDefinition({ roleKey: '1bad', label: 'x', baselineTemplate: 'staff' }).ok, false)
    assert.equal(validateRoleDefinition({ roleKey: 'OK Role', label: 'x', baselineTemplate: 'staff' }).ok, false)
    assert.equal(
      validateRoleDefinition({
        roleKey: 'floor_host',
        label: 'Floor host',
        baselineTemplate: 'staff',
        grants: { pos: true },
      }).ok,
      true,
    )
    assert.equal(
      validateRoleDefinition({
        roleKey: 'floor_host',
        label: 'Floor host',
        baselineTemplate: 'staff',
        grants: { not_a_grant: true },
      }).ok,
      false,
    )
  })
})

describe('hospitality wiring scans', () => {
  it('finance has expense reports; attendance labels the wash pool as an unpaid estimate', () => {
    const finance = readFileSync(join(root, 'src/pages/FinancePage.jsx'), 'utf8')
    const attendance = readFileSync(join(root, 'src/pages/crew/CrewAttendancePanels.jsx'), 'utf8')
    assert.match(finance, /expense-reports/)
    assert.match(attendance, /Wash pool estimate today — \{formatMoney\(myPayMinor\)\} unpaid/)
  })
})
