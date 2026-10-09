import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  BRANCH_ADMIN_ROUTE_KEYS,
  ROLES,
  allowRoute,
  canAccessCrm,
  canAccessFloorBoard,
  canAccessPos,
  canEditCrm,
  canEditPlanning,
  canEditQueueOperations,
  canUseAttendanceClock,
  canViewPlanning,
  getBranchScopeList,
  getBranchAdminMore,
  getOperationsNav,
  redirectForRole,
} from '../src/auth/permissions.js'
import { opsRouteKeyFromPath, resolvePostLoginPath } from '../src/auth/authRedirect.js'
import { NOTIFY_EVENTS } from '../src/lib/notifyRouting.js'

const ol = { role: ROLES.OPERATIONS_LEAD }

describe('Operations Lead', () => {
  it('has TL∪BA ops, all branches, planner edit, no clock', () => {
    assert.equal(getBranchScopeList(ol), null)
    assert.equal(canViewPlanning(ol), true)
    assert.equal(canEditPlanning(ol), true)
    assert.equal(canEditQueueOperations(ol), true)
    assert.equal(canAccessPos(ol), true)
    assert.equal(canUseAttendanceClock(ol), false)
  })

  it('lands on Queue and has no Floor Board', () => {
    assert.equal(redirectForRole(ROLES.OPERATIONS_LEAD), '/operations/queue')
    assert.equal(getOperationsNav(ol)[0].to, '/operations/queue')
    assert.ok(!getOperationsNav(ol).some((i) => i.to === '/operations/dashboard'))
    assert.equal(canAccessFloorBoard(ol), false)
    assert.equal(allowRoute(ol, 'dashboard'), false)
  })

  it('reads CRM without edit rights', () => {
    assert.equal(canAccessCrm(ol), true)
    assert.equal(canEditCrm(ol), false)
    assert.equal(allowRoute(ol, 'crm'), true)
    assert.ok(getOperationsNav(ol).some((i) => i.to === '/operations/crm'))
  })
})

describe('Ops Lab is retired', () => {
  const profiles = [
    { role: ROLES.SUPER_ADMIN },
    { role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: {} },
    { role: ROLES.ADMIN, branch_slug: 'bacoor' },
    ol,
    { role: ROLES.TEAM_LEAD, branch_slug: 'bacoor' },
  ]

  it('no role has it in nav or More', () => {
    for (const p of profiles) {
      const links = [...getOperationsNav(p), ...getBranchAdminMore(p)]
      assert.ok(!links.some((i) => i.to === '/operations/roadmap' || i.label === 'Ops Lab'), p.role)
    }
    assert.ok(!BRANCH_ADMIN_ROUTE_KEYS.includes('roadmap'))
  })

  it('old links fall back to the role home', () => {
    assert.equal(opsRouteKeyFromPath('/operations/roadmap'), null)
    assert.equal(resolvePostLoginPath(ol, '/operations/roadmap?board=b1'), '/operations/queue')
    assert.match(readFileSync('src/App.jsx', 'utf8'), /path="roadmap" element=\{<Navigate to="\/operations" replace \/>\}/)
  })

  it('nothing still sends Ops Lab notifications', () => {
    assert.equal(NOTIFY_EVENTS.ops_lab, undefined)
    assert.doesNotMatch(readFileSync('vercel.json', 'utf8'), /notify-ops-lab/)
  })
})
