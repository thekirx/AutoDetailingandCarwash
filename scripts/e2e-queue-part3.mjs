/**
 * Part 3 queue/dashboard smoke: redo enum, visit_group, timing settings, helpers.
 * node scripts/e2e-queue-part3.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import {
  OPS_BOARD_STATUSES,
  getDashboardDateRange,
  groupVisitTickets,
  isSuspiciousTiming,
  resolveBranchFilter,
} from '../src/queue/queueLogic.js'
import { ROLES } from '../src/auth/permissions.js'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i)
    const v = line.slice(i + 1)
    if (!process.env[k]) process.env[k] = v
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
assert(url && service, 'missing supabase env')
const results = []

assert(OPS_BOARD_STATUSES.includes('redo'), 'ops board has redo')
assert(
  groupVisitTickets([
    { booking_id: '1', visit_group_id: 'g', service_name: 'A', final_price_minor: 1 },
    { booking_id: '2', visit_group_id: 'g', service_name: 'B', final_price_minor: 2 },
  ]).length === 1,
)
assert(
  isSuspiciousTiming(
    { in_progress_at: '2026-01-01T00:00:00Z', final_checking_at: '2026-01-01T00:00:10Z' },
    { enabled: true, min_seconds_in_progress: 60 },
  ),
)
assert(getDashboardDateRange('6mo').start < new Date())
assert(resolveBranchFilter({ role: ROLES.SUPER_ADMIN }, 'bacoor') === 'bacoor')
assert(resolveBranchFilter({ role: ROLES.TEAM_LEAD, branch_slug: 'bacoor' }, 'all') === 'bacoor')
results.push('helpers: ok')

const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: settings, error: settingsErr } = await admin
  .from('app_settings')
  .select('key, value')
  .eq('key', 'queue_timing_warnings')
  .maybeSingle()
assert(!settingsErr, settingsErr?.message)
assert(settings?.value?.min_seconds_in_progress >= 1, 'timing settings missing')
results.push('db.queue_timing_warnings: ok')

const { error: colErr } = await admin
  .from('bookings')
  .select('id, visit_group_id, redo_at, redo_reason, in_progress_at, final_checking_at')
  .limit(1)
assert(!colErr, `bookings part3 columns: ${colErr?.message}`)
results.push('db.bookings.part3_cols: ok')

const { error: boardErr } = await admin
  .from('operations_queue_board')
  .select('booking_id, visit_group_id, in_progress_at, final_checking_at, redo_reason')
  .limit(1)
assert(!boardErr, `board view: ${boardErr?.message}`)
results.push('db.operations_queue_board: ok')

const { error: redoErr } = await admin.from('bookings').select('id').eq('status', 'redo').limit(1)
assert(!redoErr, `redo enum query failed: ${redoErr?.message}`)
results.push('db.redo_status_queryable: ok')

console.log(results.join('\n'))
console.log('e2e-queue-part3: PASS')
