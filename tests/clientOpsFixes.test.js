import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { attendanceRowsToCsv } from '../src/lib/attendanceExport.js'
import { DETAILING_BOARD_STATUSES, nextDetailingBoardStatus } from '../src/lib/detailingBoardStatuses.js'
import { accumulatePosCategoryTotals, productIsPosSellable } from '../src/lib/posSellables.js'
import { canAccessBookingBoard, canCreateBookings, canEditBookings, ROLES } from '../src/auth/permissions.js'
import { STATUS_LABELS } from '../src/queue/queueLogic.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('client ops fixes batch', () => {
  it('exports attendance CSV', () => {
    const csv = attendanceRowsToCsv([
      {
        name: 'Crew One',
        username: 'c1',
        role: 'staff',
        date: '2026-08-09',
        status: 'present',
        checked_in_at: '08:00',
        checked_out_at: '17:00',
        source: 'geo',
      },
    ])
    assert.match(csv, /Crew One/)
    assert.match(csv, /present/)
  })

  it('detailing board labels and progression', () => {
    assert.equal(STATUS_LABELS.pending, 'Pending')
    assert.equal(STATUS_LABELS.waiting, 'Waiting')
    assert.equal(STATUS_LABELS.in_progress, 'In Progress')
    assert.equal(STATUS_LABELS.final_checking, 'Final Checking')
    assert.equal(STATUS_LABELS.completed, 'Completed')
    assert.equal(DETAILING_BOARD_STATUSES[0].label, 'Booking Placeholder')
    assert.equal(DETAILING_BOARD_STATUSES[1].label, 'Assign to branch')
    assert.equal(DETAILING_BOARD_STATUSES[2].label, 'Vehicle intake')
    assert.equal(nextDetailingBoardStatus('pending'), 'confirmed')
    assert.equal(nextDetailingBoardStatus('final_checking'), 'for_releasing')
    assert.ok(DETAILING_BOARD_STATUSES.length >= 7)
  })

  it('Bookings view is Sales / SA / Marketing — not TL', () => {
    assert.equal(canAccessBookingBoard({ role: ROLES.SALES }), true)
    assert.equal(canAccessBookingBoard({ role: ROLES.SUPER_ADMIN }), true)
    assert.equal(canAccessBookingBoard({ role: ROLES.MARKETING }), true)
    assert.equal(canAccessBookingBoard({ role: ROLES.TEAM_LEAD, branch_slug: 'bacoor' }), false)
    assert.equal(canCreateBookings({ role: ROLES.SALES }), true)
    assert.equal(canEditBookings({ role: ROLES.TEAM_LEAD }), false)
    assert.equal(canEditBookings({ role: ROLES.ADMIN }), false)
  })

  it('POS sellables + category buckets', () => {
    assert.equal(productIsPosSellable({ tags: ['coffee'] }), true)
    assert.equal(productIsPosSellable({ tags: ['not-a-tag'] }), false)
    const totals = accumulatePosCategoryTotals([
      { total_minor: 100, serviceSlug: 'ceramic-coating' },
      { total_minor: 200, serviceSlug: 'paint-protection-film' },
      { total_minor: 50, itemType: 'product' },
      { total_minor: 75, payCategory: 'wash' },
    ])
    assert.equal(totals.ceramic_coating, 100)
    assert.equal(totals.ppf, 200)
    assert.equal(totals.sellables, 50)
    assert.equal(totals.car_wash, 75)
  })

  it('wires attendance gate migration, inventory page, logout, import script', () => {
    const mig = readFileSync(
      join(root, 'supabase/migrations/20260809200000_crew_attendance_gate_sellables_maint.sql'),
      'utf8',
    )
    const settings = readFileSync(join(root, 'src/components/UserSettingsModal.jsx'), 'utf8')
    const crew = readFileSync(join(root, 'src/pages/crew/CrewAttendancePanels.jsx'), 'utf8')
    const app = readFileSync(join(root, 'src/App.jsx'), 'utf8')
    assert.match(mig, /time in \(present or late\)/)
    assert.match(mig, /vehicle_maintenance_schedules/)
    assert.match(settings, /Log out/)
    assert.match(crew, /Export CSV/)
    assert.match(app, /inventory/)
    assert.ok(exists(join(root, 'scripts/import-ceramic-coatings.mjs')))
  })
})

function exists(p) {
  try {
    readFileSync(p)
    return true
  } catch {
    return false
  }
}
