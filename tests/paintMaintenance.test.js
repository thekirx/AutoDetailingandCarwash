import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  PAINT_MAINTENANCE_PROGRAM,
  PAINT_MAINTENANCE_SLUG,
  addMonthsDateOnly,
  isPaintMaintenanceEnrollSlug,
  isPaintMaintenanceSlug,
  normalizeMaintPlate,
  paintMaintenanceActionForSlug,
} from '../src/lib/paintMaintenance.js'

describe('paint maintenance program', () => {
  it('normalizes plates for dedupe', () => {
    assert.equal(normalizeMaintPlate('abc-123'), 'ABC123')
    assert.equal(normalizeMaintPlate(' AB 12 '), 'AB12')
  })

  it('enrolls Ceramic + PPF only; paint-maintenance resets', () => {
    assert.equal(isPaintMaintenanceEnrollSlug('ceramic-coating'), true)
    assert.equal(isPaintMaintenanceEnrollSlug('paint-protection-film'), true)
    assert.equal(isPaintMaintenanceEnrollSlug('nano-ceramic-tint'), false)
    assert.equal(isPaintMaintenanceSlug(PAINT_MAINTENANCE_SLUG), true)
    assert.equal(paintMaintenanceActionForSlug('ceramic-coating'), 'enroll')
    assert.equal(paintMaintenanceActionForSlug('paint-protection-film'), 'enroll')
    assert.equal(paintMaintenanceActionForSlug('paint-maintenance'), 'reset')
    assert.equal(paintMaintenanceActionForSlug('nano-ceramic-tint'), null)
  })

  it('adds months for next due date', () => {
    const next = addMonthsDateOnly('2026-02-10', 6)
    assert.match(next, /^\d{4}-\d{2}-\d{2}$/)
    assert.equal(PAINT_MAINTENANCE_PROGRAM, 'paint_maintenance')
  })
})
