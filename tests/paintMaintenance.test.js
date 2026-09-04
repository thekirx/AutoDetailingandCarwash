import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  PAINT_MAINTENANCE_PROGRAM,
  PAINT_MAINTENANCE_SLUG,
  DETAILING_SCHEDULE_TYPES,
  addMonthsDateOnly,
  daysUntilDue,
  isPaintMaintenanceEnrollSlug,
  isPaintMaintenanceSlug,
  maintenanceUrgency,
  normalizeMaintPlate,
  paintMaintenanceActionForSlug,
  resolveFrequencyMonthsFromSettings,
  sortMaintenanceSchedules,
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

  it('exposes detailing schedule types for the Maintenance tab', () => {
    assert.deepEqual(
      DETAILING_SCHEDULE_TYPES.map((t) => t.slug),
      ['ceramic-coating', 'paint-protection-film', 'paint-maintenance'],
    )
  })

  it('ranks urgency and sorts overdue first', () => {
    assert.equal(daysUntilDue('2026-03-01', '2026-03-10'), -9)
    assert.equal(maintenanceUrgency('2026-03-01', '2026-03-10'), 'overdue')
    assert.equal(maintenanceUrgency('2026-03-15', '2026-03-10'), 'due_soon')
    assert.equal(maintenanceUrgency('2026-06-01', '2026-03-10'), 'upcoming')
    const sorted = sortMaintenanceSchedules(
      [
        { id: 'a', next_due_at: '2026-06-01' },
        { id: 'b', next_due_at: '2026-03-01' },
        { id: 'c', next_due_at: '2026-03-12' },
      ],
      '2026-03-10',
    )
    assert.deepEqual(
      sorted.map((r) => r.id),
      ['b', 'c', 'a'],
    )
  })

  it('resolves frequency months from most specific setting', () => {
    const settings = [
      { scope: 'whole', frequency_months: 12, enabled: true },
      { scope: 'per_service', service_id: 'svc1', frequency_months: 4, enabled: true },
    ]
    assert.equal(resolveFrequencyMonthsFromSettings(settings, 'svc1', 'bacoor'), 4)
    assert.equal(resolveFrequencyMonthsFromSettings(settings, 'other', 'bacoor'), 12)
  })
})
