import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  extractDailySheetId,
  extractPayslipId,
  getExpenseSourceMeta,
  FAMILY_TO_LINE_KIND,
} from '../src/lib/financeDrilldown.js'

describe('financeDrilldown helpers', () => {
  it('extracts daily sheet UUID from formatted description', () => {
    const desc = 'daily_sheet:7a3f821d-91b6-4b2a-89f4-123456789abc:line-123'
    assert.equal(extractDailySheetId(desc), '7a3f821d-91b6-4b2a-89f4-123456789abc')
    assert.equal(extractDailySheetId('random text'), null)
    assert.equal(extractDailySheetId(''), null)
    assert.equal(extractDailySheetId(null), null)
  })

  it('extracts payslip UUID from formatted description', () => {
    const desc = 'payslip:9c2e11aa-4567-4d89-9876-fedcba987654:salary'
    assert.equal(extractPayslipId(desc), '9c2e11aa-4567-4d89-9876-fedcba987654')
    assert.equal(extractPayslipId('other text'), null)
  })

  it('identifies source meta and deep link for daily sheet expenses', () => {
    const meta = getExpenseSourceMeta({
      description: 'daily_sheet:7a3f821d-91b6-4b2a-89f4-123456789abc:line-1',
    })
    assert.equal(meta.type, 'daily_sheet')
    assert.equal(meta.actionLabel, 'Open Sheet')
    assert.equal(meta.targetUrl, '/operations/finance?tab=sheets&sheet=7a3f821d-91b6-4b2a-89f4-123456789abc')
  })

  it('identifies source meta and deep link for payroll/salaries', () => {
    const meta = getExpenseSourceMeta({
      description: 'payslip:9c2e11aa-4567-4d89-9876-fedcba987654',
    })
    assert.equal(meta.type, 'payslip')
    assert.equal(meta.targetUrl, '/operations/monthly-salaries')
  })

  it('identifies source meta and deep link for bills and vendors', () => {
    const meta = getExpenseSourceMeta({
      bill_reference: 'INV-2026-001',
      category_id: 'cat-123',
    })
    assert.equal(meta.type, 'bill')
    assert.equal(meta.label, 'Bill · INV-2026-001')
    assert.equal(meta.targetUrl, '/operations/finance?tab=purchases&acct=cat-123')
  })

  it('maps trading income families to line kinds accurately', () => {
    assert.equal(FAMILY_TO_LINE_KIND['Services'], 'service')
    assert.equal(FAMILY_TO_LINE_KIND['Packages'], 'package')
    assert.equal(FAMILY_TO_LINE_KIND['Detailing'], 'detailing')
    assert.equal(FAMILY_TO_LINE_KIND['Merch'], 'merch')
  })
})

