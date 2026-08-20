import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

describe('Concurrent ops: coalesce + stable realtime + hot indexes', () => {
  it('POS coalesces reloads, names the channel by branch, and filters sales by branch', () => {
    const src = read('src/pages/PosPage.jsx')
    assert.match(src, /createCoalescedReload/)
    assert.ok(src.includes('channel(`pos-${branch}`)'))
    assert.ok(!src.includes('pos-sales:${branch}:${crypto.randomUUID'))
    assert.ok(src.includes("table: 'sales', filter: `branch=eq.${branch}`"))
  })

  it('attendance register coalesces and uses a stable channel name', () => {
    const src = read('src/pages/crew/CrewAttendancePanels.jsx')
    assert.match(src, /createCoalescedReload/)
    assert.match(src, /from 'react'/)
    assert.ok(src.includes('channel(`attendance-table:${branchSlug}`)'))
    assert.ok(!src.includes('attendance-table:${branchSlug}:${crypto.randomUUID'))
  })

  it('notification bell and vehicle catalog share one channel per client, not a UUID each mount', () => {
    const bell = read('src/components/NotificationBell.jsx')
    assert.match(bell, /createCoalescedReload/)
    assert.match(bell, /user-notifications-bell:/)
    assert.doesNotMatch(bell, /randomUUID/)
    const catalog = read('src/components/VehicleMakeModelFields.jsx')
    assert.ok(catalog.includes("channel('vehicle-catalog')"))
    assert.ok(!catalog.includes('vehicle-catalog-picker:${crypto.randomUUID'))
  })

  it('planner and my-tasks coalesce realtime; TL queue filters bookings by branch', () => {
    const planner = read('src/pages/PlanningBoardPage.jsx')
    assert.match(planner, /createCoalescedReload/)
    assert.match(planner, /table: 'plan_cards'/)
    const ops = read('src/pages/OperationsPages.jsx')
    assert.match(ops, /scheduleMyTasks/)
    assert.ok(ops.includes('my-tasks-${staffId}'))
    const tl = read('src/pages/TeamLeadQueuePage.jsx')
    assert.ok(tl.includes("table: 'bookings', filter: `branch=eq.${branch}`"))
  })

  it('concurrency migration indexes POS settle path, live for_payment, and wraps payroll RLS', () => {
    const sql = read('supabase/migrations/20260819140000_concurrency_hot_path.sql')
    assert.match(sql, /transactions_pos_handoff_idx/)
    assert.match(sql, /bookings_for_payment_floor_idx/)
    assert.match(sql, /sale_line_items_product_id_idx/)
    assert.match(sql, /staff_id = \(select auth\.uid\(\)\)/)
    assert.match(sql, /revoke execute on function public\.sync_queue_assignments/)
    assert.match(sql, /from anon/)
    assert.match(sql, /TES8080/)
    assert.match(sql, /SLSE2E/)
  })
})
