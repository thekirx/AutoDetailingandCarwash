import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  ROLES,
  allowRoute,
  getOperationsNav,
  getTeamLeadDock,
  groupOperationsNav,
} from '../src/auth/permissions.js'
import { opsRouteKeyFromPath } from '../src/auth/authRedirect.js'
import { buildSmartSearchDestinations } from '../src/lib/smartSearchCatalog.js'

const root = join(import.meta.dirname, '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

describe('Unified Employees & Attendance Hub consolidation', () => {
  it('replaces redundant Attendance + RBAC Delegation sidebar links with Employees under Human Resource', () => {
    const saNav = getOperationsNav({ role: ROLES.SUPER_ADMIN })
    const saGroups = groupOperationsNav(saNav)
    const hrGroup = saGroups.find((g) => g.id === 'hr')
    const cfgGroup = saGroups.find((g) => g.id === 'config')

    assert.deepEqual(
      hrGroup.items.map((i) => ({ label: i.label, to: i.to })),
      [
        { label: 'Payslips', to: '/operations/payslips' },
        { label: 'Employees', to: '/operations/employees' },
      ],
    )
    assert.equal(saNav.some((i) => i.to === '/operations/people'), false)
    assert.equal(saNav.some((i) => i.to === '/operations/attendance'), false)
    assert.equal(cfgGroup.items.some((i) => i.label === 'RBAC Delegation'), false)

    const baNav = getOperationsNav({ role: ROLES.ADMIN, branch_slug: 'bacoor', branch_slugs: ['bacoor'] })
    assert.equal(baNav.some((i) => i.to === '/operations/employees' && i.label === 'Employees'), true)
    assert.equal(allowRoute({ role: ROLES.ADMIN, branch_slug: 'bacoor' }, 'employees'), true)
    assert.equal(allowRoute({ role: ROLES.ADMIN, branch_slug: 'bacoor' }, 'people'), false)
  })

  it('keeps Floor Shell dock & nav routes intact while redirecting Command routes cleanly', () => {
    const tlDock = getTeamLeadDock({ role: ROLES.TEAM_LEAD, branch_slug: 'bacoor' })
    const staffNav = getOperationsNav({ role: ROLES.STAFF, branch_slug: 'bacoor' })
    assert.equal(tlDock.some((i) => i.to === '/operations/attendance'), true)
    assert.equal(staffNav.some((i) => i.to === '/operations/attendance'), true)
    assert.equal(opsRouteKeyFromPath('/operations/employees'), 'employees')

    const app = read('src/App.jsx')
    assert.match(app, /path="employees"[\s\S]{0,120}<EmployeesHubPage \/>/)
    assert.match(app, /path="people"[\s\S]{0,160}EmployeesHubRedirect defaultTab="employees"/)
    assert.match(app, /path="attendance"[\s\S]{0,160}EmployeesHubRedirect defaultTab="attendance"/)
  })

  it('organizes Attendance, Register, Employee list, RBAC & roles, and Settings cleanly inside EmployeesHubPage', () => {
    const hub = read('src/pages/EmployeesHubPage.jsx')
    for (const id of ['clock', 'attendance', 'register', 'employees', 'access', 'settings']) {
      assert.match(hub, new RegExp(`id: '${id}'`))
    }
    assert.match(hub, /allowRoute\(profile, 'people'\) && canManagePeople\(profile\)/)
    assert.match(hub, /onOpenRegister=\{\(\) => setShellTab\('register'\)\}/)

    const people = read('src/pages/PeopleManagePage.jsx')
    assert.match(people, /RBAC Delegation · General Admins/)
    assert.match(people, /Configure RBAC grants/)
    assert.match(people, /Temp Team Lead delegation/)
    assert.match(people, /Custom role templates/)
    // Eliminates duplicate today attendance scan that used to run inside People Directory
    assert.doesNotMatch(people, /\.from\('staff_attendance'\)/)
    assert.doesNotMatch(people, /\.select\('\*'\)/)
  })

  it('optimizes attendance & admin queries (no select(*), parallel Hop 1 in fetchAttendanceMatrix)', () => {
    const attApi = read('src/queue/attendanceApi.js')
    assert.match(attApi, /Hop 1: roles config, branch assignments, and scoped attendance rows are independent/)
    assert.match(attApi, /fetchAttendanceRoleSettings\(\),\s*supabase/)

    const adminApi = read('src/lib/adminApi.js')
    assert.match(adminApi, /\.update\(patch\)\.eq\('id', id\)\.select\(STAFF_LIST_COLS\)\.maybeSingle\(\)/)

    const panels = read('src/pages/crew/CrewAttendancePanels.jsx')
    assert.match(panels, /const COMP_SETTINGS_SELECT =/)
    assert.doesNotMatch(panels, /\.from\('compensation_settings'\)\.select\('\*'\)/)
  })

  it('routes Smart Search HR & RBAC queries to /operations/employees?tab=... strictly by RBAC', () => {
    const saDest = buildSmartSearchDestinations({ role: ROLES.SUPER_ADMIN }).map((d) => d.to)
    assert.ok(saDest.includes('/operations/employees?tab=attendance'))
    assert.ok(saDest.includes('/operations/employees?tab=register'))
    assert.ok(saDest.includes('/operations/employees?tab=employees'))
    assert.ok(saDest.includes('/operations/employees?tab=access'))
    assert.ok(saDest.includes('/operations/employees?tab=settings'))

    const baDest = buildSmartSearchDestinations({ role: ROLES.ADMIN, branch_slug: 'bacoor' }).map((d) => d.to)
    assert.ok(baDest.includes('/operations/employees?tab=attendance'))
    assert.ok(baDest.includes('/operations/employees?tab=register'))
    assert.equal(baDest.includes('/operations/employees?tab=employees'), false)
    assert.equal(baDest.includes('/operations/employees?tab=access'), false)
  })
})
