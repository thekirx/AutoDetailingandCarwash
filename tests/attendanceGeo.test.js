import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  attendanceDateRange,
  attendanceStatusCount,
  buildAttendanceHeatmap,
  buildAttendanceTableRows,
  combineLocalDateAndTime,
  haversineMeters,
  isInsideGeofence,
  isLateVsShift,
  isoToLocalHhmm,
} from '../src/lib/attendanceGeo.js'

describe('attendance geo helpers', () => {
  it('haversine: same point is 0m', () => {
    assert.equal(haversineMeters(14.459, 120.929, 14.459, 120.929), 0)
  })

  it('geofence accepts near pin and rejects far', () => {
    const near = isInsideGeofence({
      userLat: 14.4591,
      userLng: 120.9291,
      branchLat: 14.459,
      branchLng: 120.929,
      radiusM: 150,
    })
    assert.equal(near.ok, true)
    const far = isInsideGeofence({
      userLat: 14.5,
      userLng: 121.0,
      branchLat: 14.459,
      branchLng: 120.929,
      radiusM: 150,
    })
    assert.equal(far.ok, false)
  })

  it('builds weekly range and heatmap matrix', () => {
    const range = attendanceDateRange('weekly', new Date('2026-07-22T12:00:00Z'))
    assert.equal(range.dates.length, 7)
    const matrix = buildAttendanceHeatmap(
      [{ id: 's1', full_name: 'Staff One' }],
      [{ staff_id: 's1', attendance_date: range.dates[0], status: 'present' }],
      range.dates,
    )
    assert.equal(matrix[0].name, 'Staff One')
    assert.equal(matrix[0].cells[0].count, attendanceStatusCount('present'))
    assert.equal(matrix[0].cells[1].count, 0)
  })

  it('late vs shift', () => {
    const lateMorning = new Date()
    lateMorning.setHours(10, 0, 0, 0)
    assert.equal(isLateVsShift('08:00', lateMorning), true)
    const early = new Date()
    early.setHours(7, 50, 0, 0)
    assert.equal(isLateVsShift('08:00', early), false)
  })
})

describe('attendance table flatten', () => {
  it('builds searchable staff×date rows', () => {
    const rows = buildAttendanceTableRows(
      [{ id: 's1', full_name: 'Ana', username: 'ana' }],
      [{ staff_id: 's1', attendance_date: '2026-07-20', status: 'present', source: 'geo' }],
      ['2026-07-20', '2026-07-21'],
    )
    assert.equal(rows.length, 2)
    assert.equal(rows[0].status, 'present')
    assert.equal(rows[1].status, null)
  })
})

describe('override clock helpers', () => {
  it('round-trips local date + HH:MM to ISO', () => {
    const iso = combineLocalDateAndTime('2026-07-21', '09:15')
    assert.ok(iso)
    assert.equal(isoToLocalHhmm(iso), '09:15')
    assert.equal(combineLocalDateAndTime('2026-07-21', ''), null)
  })
})
