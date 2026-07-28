import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_ATTENDANCE_ROLES,
  normalizeAttendanceRoles,
  peopleInAttendanceRoles,
  ATTENDANCE_ROLE_OPTIONS,
} from '../src/lib/attendanceRoles.js'
import { canEditAttendanceRoles } from '../src/auth/permissions.js'
import { mergeAttendancePeople } from '../src/lib/attendanceGeo.js'

describe('attendance role config (SA-owned)', () => {
  it('exposes labeled options covering every ops role', () => {
    const keys = ATTENDANCE_ROLE_OPTIONS.map((o) => o.value)
    assert.ok(keys.includes('staff'))
    assert.ok(keys.includes('team_lead'))
    assert.ok(keys.includes('admin'))
    assert.ok(keys.includes('BossMich'))
    assert.equal(keys.length, DEFAULT_ATTENDANCE_ROLES.length)
  })

  it('normalizeAttendanceRoles drops unknown + empties, dedupes, keeps order', () => {
    assert.deepEqual(
      normalizeAttendanceRoles(['staff', 'staff', 'nope', 'team_lead', '']),
      ['staff', 'team_lead'],
    )
  })

  it('normalizeAttendanceRoles falls back to defaults when empty/invalid', () => {
    assert.deepEqual(normalizeAttendanceRoles(null), [...DEFAULT_ATTENDANCE_ROLES])
    assert.deepEqual(normalizeAttendanceRoles([]), [...DEFAULT_ATTENDANCE_ROLES])
    assert.deepEqual(normalizeAttendanceRoles({ roles: ['staff'] }), ['staff'])
  })

  it('peopleInAttendanceRoles filters strictly by configured roles', () => {
    const people = [
      { id: '1', role: 'staff', full_name: 'A' },
      { id: '2', role: 'team_lead', full_name: 'B' },
      { id: '3', role: 'admin', full_name: 'C' },
      { id: '4', role: 'marketing', full_name: 'D' },
    ]
    const filtered = peopleInAttendanceRoles(people, ['staff', 'team_lead'])
    assert.deepEqual(filtered.map((p) => p.id), ['1', '2'])
  })

  it('mergeAttendancePeople then role filter keeps TL before staff', () => {
    const merged = mergeAttendancePeople(
      [{ id: 'a', full_name: 'Staff A', role: 'staff' }],
      [{ id: 'b', full_name: 'TL B', role: 'team_lead' }],
    )
    const onlyTl = peopleInAttendanceRoles(merged, ['team_lead'])
    assert.equal(onlyTl.length, 1)
    assert.equal(onlyTl[0].role, 'team_lead')
  })
})

describe('canEditAttendanceRoles — Super Admin only', () => {
  it('allows BossMich', () => {
    assert.equal(canEditAttendanceRoles({ role: 'BossMich' }), true)
  })

  it('denies ASA, admin, team_lead, staff', () => {
    for (const role of ['assistant_super_admin', 'admin', 'team_lead', 'staff', 'marketing']) {
      assert.equal(canEditAttendanceRoles({ role }), false, role)
    }
  })
})
