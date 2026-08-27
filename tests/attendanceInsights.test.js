import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildAttendancePayrollPreview,
  registerFloorStats,
  summarizePeriodAttendance,
  summarizeTodayAttendance,
} from '../src/lib/attendanceInsights.js'
import {
  DEFAULT_COMPENSATION_RULES,
  demoWashPoolSplit,
  latePaySharePercent,
  latePayWeightFromPercent,
} from '../src/lib/compensation.js'

describe('attendanceInsights', () => {
  const staff = [
    { id: 'a', full_name: 'Crew One', role: 'staff' },
    { id: 'b', full_name: 'Crew Two', role: 'staff' },
    { id: 'c', full_name: 'TL Test', role: 'team_lead' },
  ]

  const attendance = [
    { staff_id: 'a', attendance_date: '2026-08-27', status: 'present' },
    { staff_id: 'b', attendance_date: '2026-08-27', status: 'late' },
    { staff_id: 'c', attendance_date: '2026-08-27', status: 'absent' },
    { staff_id: 'a', attendance_date: '2026-08-26', status: 'present' },
  ]

  it('summarizeTodayAttendance counts on-site and gaps', () => {
    const s = summarizeTodayAttendance(staff, attendance, '2026-08-27')
    assert.equal(s.present, 1)
    assert.equal(s.late, 1)
    assert.equal(s.absent, 1)
    assert.equal(s.onSite, 2)
    assert.equal(s.total, 3)
  })

  it('summarizePeriodAttendance aggregates recorded cells', () => {
    const p = summarizePeriodAttendance(attendance, ['2026-08-26', '2026-08-27'])
    assert.equal(p.present, 2)
    assert.equal(p.late, 1)
    assert.equal(p.absent, 1)
    assert.equal(p.recorded, 4)
  })

  it('buildAttendancePayrollPreview maps weights and assignable flag', () => {
    const rows = buildAttendancePayrollPreview(staff, attendance, DEFAULT_COMPENSATION_RULES, '2026-08-27')
    const crewOne = rows.find((r) => r.staffId === 'a')
    const crewTwo = rows.find((r) => r.staffId === 'b')
    const tl = rows.find((r) => r.staffId === 'c')
    assert.equal(crewOne.weightLabel, '100%')
    assert.equal(crewOne.assignable, true)
    assert.equal(crewTwo.weightLabel, '70%')
    assert.equal(crewTwo.assignable, true)
    assert.equal(tl.weight, 0)
    assert.equal(tl.assignable, false)
  })

  it('registerFloorStats maps crew model counts', () => {
    const stats = registerFloorStats(
      { presentCount: 3, availableCount: 2, onBayCount: 1, absentCount: 4, staffPool: [{ id: 1 }] },
      5,
    )
    assert.equal(stats.onSite, 3)
    assert.equal(stats.assignable, 2)
    assert.equal(stats.onJobs, 1)
    assert.equal(stats.blocked, 4)
  })

  it('late pay helpers use percent in UI, decimal in DB', () => {
    assert.equal(latePaySharePercent({ attendance_late_weight: 0.7 }), 70)
    assert.equal(latePayWeightFromPercent(70), 0.7)
    assert.equal(latePayWeightFromPercent(100), 1)
    const demo = demoWashPoolSplit({ poolMinor: 10000, onTimeCount: 2, lateCount: 1, lateWeight: 0.7 })
    const sum = demo.perOnTimeMinor * 2 + demo.perLateMinor
    assert.ok(Math.abs(sum - 10000) <= 1)
    assert.ok(demo.perLateMinor < demo.perOnTimeMinor)
  })
})
