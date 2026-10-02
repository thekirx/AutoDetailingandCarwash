import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildBacoorDailyReport, formatBacoorReportText } from '../src/lib/bacoorDailyReport.js'

const plainMoney = (minor) => String(Math.round((Number(minor) || 0) / 100))

/** Owner sample — Bacoor Aug 22, 2026 (pesos). */



describe('Bacoor multi-branch headers', () => {
  it('uses branch slug in report header for each site', () => {
    const imus = buildBacoorDailyReport({
      branch: 'imus',
      branchSlug: 'imus',
      branchDisplay: 'Hakum Imus',
      date: '2026-08-22',
      sales: [{ status: 'paid', payment_method: 'cash', total_minor: 10000, bucket: 'carwash' }],
      classifyBucket: (r) => r.bucket,
    })
    const text = formatBacoorReportText(imus, plainMoney)
    assert.match(text, /^IMUS SALES REPORT/)
  })
})
