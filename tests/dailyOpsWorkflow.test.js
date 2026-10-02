/**
 * Principal QA — one branch/day from crew clock-in through Finance P&L.
 * Tracer bullets at public seams (no browser): attendance → queue/POS → EoS → payroll → books.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ROLES,
  allowRoute,
  canUseAttendanceClock,
  canViewQueueOperations,
  canEditQueueOperations,
} from '../src/auth/permissions.js'
import { canClockAttendance, isInsideGeofence } from '../src/lib/attendanceGeo.js'
import { isAssignableAttendanceStatus } from '../src/queue/queueLogic.js'
import { classifySaleBucket } from '../src/lib/bacoorDailyReport.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

const DAY = '2026-08-22'
const BRANCH = 'bacoor'


const washSale = {
  id: 'sale-wash-1',
  branch: BRANCH,
  status: 'paid',
  total_minor: 200_000,
  payment_method: 'cash',
  occurred_at: `${DAY}T09:30:00+08:00`,
  pos_handoff_id: 'handoff-q1',
  sale_line_items: [
    { name: 'Premium Car Wash', line_total_minor: 200_000, pay_category: 'wash', catalog_kind: 'service' },
  ],
}

const ceramicSale = {
  id: 'sale-ceramic-1',
  branch: BRANCH,
  status: 'paid',
  total_minor: 1_000_000,
  payment_method: 'gcash',
  occurred_at: `${DAY}T14:00:00+08:00`,
  booking_id: 'booking-d1',
  sale_line_items: [
    {
      name: 'Ceramic Coating',
      line_total_minor: 1_000_000,
      pay_category: 'detailing',
      service_slug: 'ceramic-coating',
      catalog_kind: 'service',
    },
  ],
}


describe('Principal QA — daily ops RBAC gates', () => {
  it('crew/TL clock; TL manages queue; BA POS + Daily Sheet; SA finance', () => {
    assert.equal(canUseAttendanceClock({ role: ROLES.STAFF }), true)
    assert.equal(canUseAttendanceClock({ role: ROLES.TEAM_LEAD }), true)
    assert.equal(canUseAttendanceClock({ role: ROLES.ADMIN }), true)
    assert.equal(canUseAttendanceClock({ role: ROLES.SUPER_ADMIN }), false)

    assert.equal(canViewQueueOperations({ role: ROLES.TEAM_LEAD }), true)
    assert.equal(canEditQueueOperations({ role: ROLES.TEAM_LEAD }), true)
    assert.equal(allowRoute({ role: ROLES.TEAM_LEAD }, 'queue'), true)
    assert.equal(allowRoute({ role: ROLES.SALES }, 'bookings'), true)
    assert.equal(allowRoute({ role: ROLES.ADMIN }, 'pos'), true)
    assert.equal(allowRoute({ role: ROLES.SUPER_ADMIN }, 'payroll'), false)
    assert.equal(allowRoute({ role: ROLES.SUPER_ADMIN }, 'finance'), true)
  })

  it('only present/late crew are assignable on the floor', () => {
    assert.equal(isAssignableAttendanceStatus('present'), true)
    assert.equal(isAssignableAttendanceStatus('late'), true)
    assert.equal(isAssignableAttendanceStatus('absent'), false)
  })

  it('attendance clock respects People toggles and geofence math', () => {
    assert.equal(canClockAttendance({ attendance_enabled: true }), true)
    assert.equal(canClockAttendance({ attendance_enabled: false }), false)
    const hit = isInsideGeofence({
      userLat: 14.45,
      userLng: 120.95,
      branchLat: 14.45,
      branchLng: 120.95,
      radiusM: 100,
    })
    assert.equal(hit.ok, true)
    assert.ok(typeof hit.distanceM === 'number')
  })
})

describe('Principal QA — Bacoor day: wash queue + detailing booking → paid POS', () => {
  it('classifies wash handoff vs ceramic booking into separate close buckets', () => {
    assert.equal(classifySaleBucket(washSale), 'carwash')
    assert.equal(classifySaleBucket(ceramicSale), 'coating')
  })


})


describe('Principal QA — wiring scan (pages + RPCs exist)', () => {
  it('daily ops surfaces chain attendance → queue → POS Daily sheet → Finance Daily sheets', () => {
    assert.match(read('src/pages/crew/CrewAttendancePanels.jsx'), /geoTimeIn|geofence/)
    assert.match(read('src/pages/OperationsPages.jsx'), /queue/)
    assert.match(read('src/pages/BookingBoardPage.jsx'), /assignStaff/)
    assert.match(read('src/pages/PosPage.jsx'), /DailySheetPanel/)
    assert.match(read('src/pages/FinancePage.jsx'), /FinanceDailySheetsTab/)
    assert.match(read('src/pages/FinancePage.jsx'), /finance_daily_pl/)
    assert.match(read('src/pages/BookingBoardPage.jsx'), /booking_status|detailing/)
  })
})
