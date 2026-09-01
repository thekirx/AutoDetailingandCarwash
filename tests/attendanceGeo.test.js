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
      radiusM: 20,
    })
    assert.equal(near.ok, true)
    const edge = isInsideGeofence({
      userLat: 14.459,
      userLng: 120.929,
      branchLat: 14.459,
      branchLng: 120.929,
      radiusM: 20,
    })
    assert.equal(edge.ok, true)
    const far = isInsideGeofence({
      userLat: 14.5,
      userLng: 121.0,
      branchLat: 14.459,
      branchLng: 120.929,
      radiusM: 20,
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

  it('late vs shift uses Asia/Manila wall clock', () => {
    // 10:00 Manila = 02:00Z; 07:50 Manila = previous day 23:50Z
    assert.equal(isLateVsShift('08:00', new Date('2026-08-22T02:00:00.000Z')), true)
    assert.equal(isLateVsShift('08:00', new Date('2026-08-21T23:50:00.000Z')), false)
    // Grace through shift_start + 5 minutes
    assert.equal(isLateVsShift('08:00', new Date('2026-08-22T00:05:00.000Z')), false)
    assert.equal(isLateVsShift('08:00', new Date('2026-08-22T00:06:00.000Z')), true)
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
  it('formats ISO as Asia/Manila HH:MM (not browser local / UTC digits)', () => {
    assert.equal(isoToLocalHhmm('2026-07-21T01:15:00.000Z'), '09:15')
    assert.equal(isoToLocalHhmm('2026-07-21T09:15:00+08:00'), '09:15')
  })

  it('combineLocalDateAndTime uses Asia/Manila (+08), round-trips with isoToLocalHhmm', () => {
    const iso = combineLocalDateAndTime('2026-07-21', '09:15')
    assert.equal(iso, '2026-07-21T01:15:00.000Z')
    assert.equal(isoToLocalHhmm(iso), '09:15')
    assert.equal(combineLocalDateAndTime('2026-07-21', ''), null)
  })
})
