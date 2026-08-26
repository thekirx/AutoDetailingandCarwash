/**
 * Hospitality ops seams: shift close, payroll custom/adj, notes, roles, expense reports.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  addPayrollAdjustment,
  netPayrollLinesMinor,
  validatePayrollCustomRange,
  confirmedPayInCalendarWindow,
  manilaMonthBounds,
} from '../src/lib/payroll.js'
import { validateCustomerNote, isRegularGuest } from '../src/lib/customerNotes.js'
import { validateRoleDefinition } from '../src/lib/roleDefinitions.js'
import { normalizePlate } from '../src/lib/customerAuth.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('payroll custom + adjustments', () => {
  it('validates custom range and nets add/deduct', () => {
    assert.equal(validatePayrollCustomRange('2026-01-01', '2026-01-10').ok, true)
    assert.equal(validatePayrollCustomRange('2026-01-10', '2026-01-01').ok, false)
    let lines = [{ key: 'a', pay_minor: 1000, staff_id: 's1', kind: 'wash_pool' }]
    lines = addPayrollAdjustment(lines, {
      staff: { id: 's1', full_name: 'Ty' },
      branch: 'bacoor',
      direction: 'deduct',
      label: 'Uniform',
      amountMinor: 200,
    })
    lines = addPayrollAdjustment(lines, {
      staff: { id: 's1', full_name: 'Ty' },
      branch: 'bacoor',
      direction: 'add',
      label: 'Bonus',
      amountMinor: 100,
    })
    assert.equal(netPayrollLinesMinor(lines), 900)
  })

  it('month bounds and confirmed window helpers', () => {
    const m = manilaMonthBounds('2026-08-21')
    assert.equal(m.start, '2026-08-01')
    assert.equal(m.end, '2026-08-31')
    const total = confirmedPayInCalendarWindow(
      [
        {
          amount_minor: 500,
          payroll_runs: { status: 'confirmed', period_start: '2026-08-01', period_end: '2026-08-07' },
        },
        {
          amount_minor: 100,
          source_key: 'deduct:x',
          payroll_runs: { status: 'confirmed', period_start: '2026-08-01', period_end: '2026-08-07' },
        },
      ],
      { start: '2026-08-01', end: '2026-08-31' },
    )
    assert.equal(total, 400)
  })
})

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
    const c = readFileSync(join(root, 'src/pages/CrmPage.jsx'), 'utf8')
    const i = readFileSync(join(root, 'src/pages/InquiriesPage.jsx'), 'utf8')
    assert.match(q, /CustomerNotesPanel/)
    assert.match(c, /value="notes"/)
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
  it('payroll page has custom + packages; finance has expense reports; my pay labels estimates', () => {
    const payroll = readFileSync(join(root, 'src/pages/PayrollPage.jsx'), 'utf8')
    const finance = readFileSync(join(root, 'src/pages/FinancePage.jsx'), 'utf8')
    const myPay = readFileSync(join(root, 'src/pages/MyPayPage.jsx'), 'utf8')
    assert.match(payroll, /custom/)
    assert.match(payroll, /staff_pay_packages/)
    assert.match(payroll, /addPayrollAdjustment/)
    assert.match(finance, /expense-reports/)
    assert.match(myPay, /Estimate — unpaid/)
    assert.match(myPay, /Today \(confirmed\)/)
  })
})
