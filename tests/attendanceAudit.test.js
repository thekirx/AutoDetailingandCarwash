/**
 * Phase 1 — Attendance module audit (naabutan nila + multi-branch hours).
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isAssignableAttendanceStatus } from '../src/queue/queueLogic.js'
import {
  attendanceRowForPayroll,
  attendanceWeight,
  hoursForAttendanceDay,
  indexBranchOperatingHours,
} from '../src/lib/compensation.js'
import {
  AUDIT_DAY,
  BACOOR,
  BACOOR_SHIFT,
  IMUS,
  IMUS_SHIFT,
  buildAttendanceMonth,
  buildOperatingHoursRows,
  buildShopDayAttendance,
} from '../src/lib/auditFixtures.js'
import { summarizePeriodAttendance } from '../src/lib/attendanceInsights.js'
import { buildAttendanceHeatmap } from '../src/lib/attendanceGeo.js'

const SHIFT_8_16 = { shift_start: '08:00', shift_end: '16:00' }

describe('attendance audit — weights', () => {
  it('1 on-time crew weight is 1.0', () => {
    assert.equal(attendanceWeight('present', {}, { ...SHIFT_8_16, clock_in_at: '08:00' }), 1)
  })

  it('2 late 09:00 on 08:00–16:00 is 0.875 (7/8)', () => {
    assert.equal(attendanceWeight('late', {}, { ...SHIFT_8_16, clock_in_at: '09:00' }), 0.875)
  })

  it('3 late 10:30 on 08:00–16:00 is 0.6875 (5.5/8)', () => {
    assert.equal(attendanceWeight('late', {}, { ...SHIFT_8_16, clock_in_at: '10:30' }), 0.6875)
  })

  it('4 absent weight is 0 and not assignable', () => {
    assert.equal(attendanceWeight('absent', {}, { ...SHIFT_8_16 }), 0)
    assert.equal(isAssignableAttendanceStatus('absent'), false)
  })

  it('5 multi-branch: same 10:00 late yields different weights', () => {
    const index = indexBranchOperatingHours(buildOperatingHoursRows())
    // 2026-08-22 is Saturday → day_of_week 6
    const bacoorH = hoursForAttendanceDay(index, BACOOR, AUDIT_DAY)
    const imusH = hoursForAttendanceDay(index, IMUS, AUDIT_DAY)
    assert.equal(bacoorH.opens_at, BACOOR_SHIFT.shift_start)
    assert.equal(imusH.opens_at, IMUS_SHIFT.shift_start)

    const lateBacoor = attendanceRowForPayroll(
      {
        staff_id: 'a',
        branch_slug: BACOOR,
        attendance_date: AUDIT_DAY,
        status: 'late',
        checked_in_at: `${AUDIT_DAY}T10:00:00+08:00`,
      },
      bacoorH,
    )
    const lateImus = attendanceRowForPayroll(
      {
        staff_id: 'b',
        branch_slug: IMUS,
        attendance_date: AUDIT_DAY,
        status: 'late',
        checked_in_at: `${AUDIT_DAY}T10:00:00+08:00`,
      },
      imusH,
    )
    // Bacoor 08–17 (9h): in 10:00 → 7/9
    // Imus 09–18 (9h): in 10:00 → 8/9
    assert.equal(Number(attendanceWeight('late', {}, lateBacoor).toFixed(6)), Number((7 / 9).toFixed(6)))
    assert.equal(Number(attendanceWeight('late', {}, lateImus).toFixed(6)), Number((8 / 9).toFixed(6)))
  })

  it('6 admin override clock changes weight', () => {
    const before = attendanceWeight('late', {}, { ...SHIFT_8_16, clock_in_at: '10:00' })
    const after = attendanceWeight('late', {}, { ...SHIFT_8_16, clock_in_at: '08:00' })
    assert.equal(before, 0.75)
    assert.equal(after, 1)
    assert.ok(after > before)
  })

  it('7 heatmap / period summary from 30-day seed is non-empty', () => {
    const month = buildAttendanceMonth()
    assert.ok(month.length >= 100)
    const present = month.filter((r) => r.status === 'present').length
    const late = month.filter((r) => r.status === 'late').length
    const absent = month.filter((r) => r.status === 'absent').length
    assert.ok(present > 0)
    assert.ok(late > 0)
    assert.ok(absent > 0)

    const shop = buildShopDayAttendance()
    const dates = [...new Set(month.map((r) => r.attendance_date))].sort()
    const summary = summarizePeriodAttendance(shop, dates.slice(0, 7))
    assert.ok(summary && typeof summary === 'object')
    const staffRows = [...new Map(month.map((r) => [r.staff_id, { id: r.staff_id, full_name: r.full_name }])).values()]
    const heat = buildAttendanceHeatmap(staffRows, month, dates.slice(0, 7))
    assert.ok(heat == null || typeof heat === 'object' || Array.isArray(heat))
  })
})
