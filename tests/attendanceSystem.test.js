import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ROLES,
  allowRoute,
  canAccessAttendance,
  canEditAttendanceSettings,
  canOverrideAttendance,
  canUseAttendanceClock,
  getOperationsNav,
  getTeamLeadDock,
  redirectForRole,
} from '../src/auth/permissions.js'
import { isAssignableAttendanceStatus } from '../src/queue/queueLogic.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('Attendance system RBAC + page', () => {
  it('clock for Branch Admin / Crew / Team Lead only', () => {
    assert.equal(canUseAttendanceClock({ role: ROLES.STAFF }), true)
    assert.equal(canUseAttendanceClock({ role: ROLES.TEAM_LEAD }), true)
    assert.equal(canUseAttendanceClock({ role: ROLES.ADMIN }), true)
    assert.equal(canUseAttendanceClock({ role: ROLES.SUPER_ADMIN }), false)
    assert.equal(canUseAttendanceClock({ role: ROLES.ASSISTANT_SUPER_ADMIN }), false)
    assert.equal(canUseAttendanceClock({ role: ROLES.SALES }), false)
  })

  it('SA sets network settings; BA overrides; TL clocks but does not override', () => {
    assert.equal(canEditAttendanceSettings({ role: ROLES.SUPER_ADMIN }), true)
    assert.equal(canEditAttendanceSettings({ role: ROLES.ADMIN }), false)
    assert.equal(canOverrideAttendance({ role: ROLES.SUPER_ADMIN }), true)
    assert.equal(canOverrideAttendance({ role: ROLES.ADMIN }), true)
    assert.equal(canOverrideAttendance({ role: ROLES.TEAM_LEAD }), false)
  })

  it('routes attendance page for clock roles + SA', () => {
    assert.equal(allowRoute({ role: ROLES.STAFF }, 'attendance'), true)
    assert.equal(allowRoute({ role: ROLES.ADMIN }, 'attendance'), true)
    assert.equal(allowRoute({ role: ROLES.TEAM_LEAD }, 'attendance'), true)
    assert.equal(allowRoute({ role: ROLES.SUPER_ADMIN }, 'attendance'), true)
    assert.equal(allowRoute({ role: ROLES.SALES }, 'attendance'), false)
    assert.equal(redirectForRole(ROLES.STAFF), '/operations/attendance')
  })

  it('nav/dock expose Attendance; crew assign requires present/late', () => {
    assert.ok(getOperationsNav({ role: ROLES.STAFF }).some((i) => i.to === '/operations/attendance'))
    assert.ok(getTeamLeadDock({ role: ROLES.TEAM_LEAD }).some((i) => i.to === '/operations/attendance'))
    assert.equal(isAssignableAttendanceStatus('present'), true)
    assert.equal(isAssignableAttendanceStatus('late'), true)
    assert.equal(isAssignableAttendanceStatus('absent'), false)
  })

  it('AttendancePage + network apply API + crew gate migration wired', () => {
    const page = readFileSync(join(root, 'src/pages/AttendancePage.jsx'), 'utf8')
    const api = readFileSync(join(root, 'src/queue/attendanceApi.js'), 'utf8')
    const app = readFileSync(join(root, 'src/App.jsx'), 'utf8')
    const crew = readFileSync(join(root, 'src/pages/OperationsPages.jsx'), 'utf8')
    const gate = readFileSync(
      join(root, 'supabase/migrations/20260809200000_crew_attendance_gate_sellables_maint.sql'),
      'utf8',
    )
    const lateView = readFileSync(
      join(root, 'supabase/migrations/20260810180000_attendance_present_late_defaults.sql'),
      'utf8',
    )
    assert.match(page, /canUseAttendanceClock/)
    assert.match(page, /CrewAttendancePanel/)
    assert.match(page, /CrewSettingsPanel/)
    assert.match(api, /applyNetworkAttendanceSettings/)
    assert.match(api, /same geofence \+ shifts on every branch/)
    assert.match(app, /path="attendance"/)
    assert.match(crew, /Open Attendance/)
    assert.doesNotMatch(crew, /Crew & attendance/)
    assert.match(gate, /present or late/)
    assert.match(lateView, /present', 'late'/)
    assert.equal(canAccessAttendance({ role: ROLES.STAFF }), true)
  })
})
