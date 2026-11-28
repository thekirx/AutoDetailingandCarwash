import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  ROLES,
  allowRoute,
  getDetailerDock,
  getDetailerMore,
  getMarketingDock,
  getMarketingMore,
  getOperationsNav,
  getSalesDock,
  getSalesMore,
  getStaffDock,
  getStaffMore,
  getTeamLeadDock,
  getTeamLeadMore,
  getVideoEditorDock,
  getVideoEditorMore,
  usesCommandShell,
  usesFloorAppShell,
} from '../src/auth/permissions.js'
import { opsRouteKeyFromPath } from '../src/auth/authRedirect.js'

const ALL_PROFILES = [
  { role: ROLES.SUPER_ADMIN },
  {
    role: ROLES.ASSISTANT_SUPER_ADMIN,
    permission_grants: {
      queue_all: true,
      bookings: true,
      pos: true,
      finance_view: true,
      finance_write: true,
      planning: true,
      reports: true,
      approvals: true,
    },
  },
  { role: ROLES.ADMIN, branch_slug: 'bacoor', branch_slugs: ['bacoor'] },
  { role: ROLES.OPERATIONS_LEAD },
  { role: ROLES.INVESTOR },
  { role: ROLES.TEAM_LEAD, branch_slug: 'bacoor' },
  { role: ROLES.SALES },
  { role: ROLES.STAFF, branch_slug: 'bacoor' },
  { role: ROLES.DETAILER, branch_slug: 'bacoor' },
  { role: ROLES.MARKETING },
  { role: ROLES.VIDEO_EDITOR },
]

const ALLOWED_COMMAND_LABELS = new Set([
  'Floor Insight',
  'Carwash Queue',
  'Detailing',
  'Team P',
  'POS',
  'Catalog & Inventory',
  'Financials',
  'Payslips',
  'Employees',
  'My advances',
  'My Tasks',
  'Customers',
  'Inquiries',
  'Rewards',
  'Branches',
  'Transfer car',
  'Content',
  'Settings',
  'Month KPI',
  'History',
  'Notifications',
  'System & Data',
])

function floorItemsFor(profile) {
  switch (profile.role) {
    case ROLES.TEAM_LEAD:
      return [...getTeamLeadDock(profile), ...getTeamLeadMore(profile)]
    case ROLES.SALES:
      return [...getSalesDock(profile), ...getSalesMore(profile)]
    case ROLES.STAFF:
      return [...getStaffDock(profile), ...getStaffMore(profile)]
    case ROLES.DETAILER:
      return [...getDetailerDock(profile), ...getDetailerMore(profile)]
    case ROLES.MARKETING:
      return [...getMarketingDock(profile), ...getMarketingMore(profile)]
    case ROLES.VIDEO_EDITOR:
      return [...getVideoEditorDock(profile), ...getVideoEditorMore(profile)]
    default:
      return []
  }
}

describe('All-roles sidebar, dock, and route completeness', () => {
  for (const profile of ALL_PROFILES) {
    it(`${profile.role} has non-empty navigation and every link passes allowRoute`, () => {
      const isCommand = usesCommandShell(profile)
      const isFloor = usesFloorAppShell(profile)
      assert.ok(isCommand || isFloor, `${profile.role} must belong to CommandShell or FloorAppShell`)

      const nav = getOperationsNav(profile)
      assert.ok(nav.length > 0, `${profile.role} must have sidebar/nav items`)

      if (isCommand) {
        for (const item of nav) {
          assert.ok(ALLOWED_COMMAND_LABELS.has(item.label), `Unexpected CommandShell label "${item.label}" for ${profile.role}`)
          const key = opsRouteKeyFromPath(item.to.split('?')[0])
          assert.equal(allowRoute(profile, key), true, `${profile.role} nav "${item.label}" (${item.to}) must pass allowRoute`)
          for (const child of item.children || []) {
            const cKey = opsRouteKeyFromPath(child.to.split('?')[0])
            assert.equal(allowRoute(profile, cKey), true, `${profile.role} child "${child.label}" (${child.to}) must pass allowRoute`)
          }
        }
      }

      if (isFloor) {
        const dockItems = floorItemsFor(profile)
        assert.ok(dockItems.length > 0, `${profile.role} must have FloorAppShell dock items`)
        for (const item of dockItems) {
          const key = opsRouteKeyFromPath(item.to.split('?')[0])
          assert.equal(allowRoute(profile, key), true, `${profile.role} dock/more "${item.label}" (${item.to}) must pass allowRoute`)
        }
      }
    })
  }
})
