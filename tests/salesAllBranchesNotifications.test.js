import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import {
  ROLES,
  canSeeAllBranches,
  canManageNotifications,
  canSendBroadcast,
  getBranchScopeList,
} from '../src/auth/permissions.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const readProject = (rel) => readFile(resolve(root, rel), 'utf8')

describe('sales all-branches scope', () => {
  it('Sales sees all branches (null scope)', () => {
    const sales = { role: ROLES.SALES }
    assert.equal(canSeeAllBranches(sales), true)
    assert.equal(getBranchScopeList(sales), null)
  })

  it('Team Lead stays scoped to assigned branch', () => {
    const tl = { role: ROLES.TEAM_LEAD, branch_slug: 'bacoor' }
    assert.equal(canSeeAllBranches(tl), false)
    assert.deepEqual(getBranchScopeList(tl), ['bacoor'])
  })

  it('Sales RLS allows read across all branches', async () => {
    const sql = await readProject('supabase/migrations/20260810130000_sales_all_branches_notifications.sql')
    assert.match(sql, /Sales can read all bookings[\s\S]*?using \(public\.current_user_role\(\) = 'sales'\)/)
    assert.match(sql, /Sales can insert bookings for any branch[\s\S]*?with check \(\s*public\.current_user_role\(\) = 'sales'/)
    assert.match(sql, /Sales can update bookings across branches/)
  })

  it('bookingStatusAccess lets Sales update any branch on the detailing pipeline', async () => {
    const mjs = await readProject('server/bookingStatusAccess.mjs')
    // The branch_slug === branch check is gone for sales.
    assert.doesNotMatch(mjs, /staff\.branch_slug === branch/)
    assert.match(mjs, /Sales: assigned to all branches/)
  })
})

describe('notification RBAC', () => {
  it('Super Admin / ASA manage reminders; Marketing cannot', () => {
    assert.equal(canManageNotifications({ role: 'BossMich' }), true)
    assert.equal(canManageNotifications({ role: 'assistant_super_admin' }), true)
    assert.equal(canManageNotifications({ role: ROLES.MARKETING }), false)
    assert.equal(canManageNotifications({ role: ROLES.SALES }), false)
    assert.equal(canManageNotifications({ role: ROLES.TEAM_LEAD }), false)
  })

  it('Super Admin / ASA / Marketing can send broadcast', () => {
    assert.equal(canSendBroadcast({ role: 'BossMich' }), true)
    assert.equal(canSendBroadcast({ role: 'assistant_super_admin' }), true)
    assert.equal(canSendBroadcast({ role: ROLES.MARKETING }), true)
    assert.equal(canSendBroadcast({ role: ROLES.SALES }), false)
    assert.equal(canSendBroadcast({ role: ROLES.TEAM_LEAD }), false)
  })

  it('notification_settings RLS gates to BossMich / assistant_super_admin', async () => {
    const sql = await readProject('supabase/migrations/20260810130000_sales_all_branches_notifications.sql')
    assert.match(
      sql,
      /Only admins manage notification settings[\s\S]*?using \(\s*public\.current_user_role\(\) in \('BossMich', 'assistant_super_admin'\)/,
    )
  })

  it('broadcast RLS allows marketing too', async () => {
    const sql = await readProject('supabase/migrations/20260810130000_sales_all_branches_notifications.sql')
    assert.match(
      sql,
      /Only admins manage broadcasts[\s\S]*?using \(\s*public\.current_user_role\(\) in \('BossMich', 'assistant_super_admin', 'marketing'\)/,
    )
  })
})

describe('maintenance reminder seed on completion', () => {
  it('notifyBooking seeds vehicle_maintenance_schedules when status=completed', async () => {
    const mjs = await readProject('server/notifyBooking.mjs')
    assert.match(mjs, /seedMaintenanceReminder/)
    assert.match(mjs, /status === 'completed' && booking\?\.customer_id/)
    assert.match(mjs, /vehicle_maintenance_schedules/)
    assert.match(mjs, /next_due_at/)
  })

  it('reminder cron actually sends push/SMS based on settings', async () => {
    const mjs = await readProject('scripts/notify-maintenance-due.mjs')
    assert.match(mjs, /sendWebPushToUsers/)
    assert.match(mjs, /busybeeSendSms/)
    assert.match(mjs, /notification_settings/)
  })
})

describe('booking form customer lookup', () => {
  it('BookingBoardPage form has customer lookup + customer_id payload', async () => {
    const jsx = await readProject('src/pages/BookingBoardPage.jsx')
    assert.match(jsx, /lookupExistingCustomer/)
    assert.match(jsx, /customer-auth-lookup/)
    assert.match(jsx, /customer_id: form\.customer_id \|\| null/)
    assert.match(jsx, /Find existing customer/)
  })
})

describe('settings hub exposes reminders + broadcast', () => {
  it('SettingsHubPage tiles include notifications and broadcast', async () => {
    const jsx = await readProject('src/pages/SettingsHubPage.jsx')
    assert.match(jsx, /Reminder notifications/)
    assert.match(jsx, /Broadcast push/)
    assert.match(jsx, /\/operations\/notifications/)
    assert.match(jsx, /\/operations\/broadcast/)
  })

  it('App.jsx routes the new pages', async () => {
    const jsx = await readProject('src/App.jsx')
    assert.match(jsx, /NotificationSettingsPage/)
    assert.match(jsx, /BroadcastPage/)
    assert.match(jsx, /path="notifications"/)
    assert.match(jsx, /path="broadcast"/)
  })
})
