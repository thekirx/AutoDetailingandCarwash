/**
 * The database audit must never be able to damage the database.
 *
 * `scripts/audit-db-deep.mjs` runs against PRODUCTION with the service-role
 * key. A single stray write in it would be unrecoverable, so its safety is
 * asserted here rather than trusted.
 *
 * The paging tests exist because the first version of that script was quietly
 * wrong in a way that looked correct: PostgREST caps a response at max-rows
 * (1000) and returns a SHORT page instead of erroring, so a `.limit(5000)`
 * read reported "1000 bookings" against a table that actually held 1312, and
 * every status distribution built from it was wrong.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const AUDIT = read('scripts/audit-db-deep.mjs')

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const CODE = stripComments(AUDIT)

test('the audit issues no mutating SQL or mutating supabase call', () => {
  // The single most important property of this file.
  const forbidden = [
    /\.insert\s*\(/,
    /\.update\s*\(/,
    /\.upsert\s*\(/,
    /\.delete\s*\(\s*\)\s*(?!\.)/,
    /rpc\(\s*['"](run_payroll|complete_pos_sale|submit_daily_sheet|review_daily_sheet|reopen_daily_sheet)['"]/,
  ]
  for (const re of forbidden) {
    assert.ok(!re.test(CODE), `audit must stay read-only — found ${re}`)
  }
})

test('no read asks for more rows than PostgREST will actually return', () => {
  // The paging test above only covers fetchAll. An inline `.limit(5000)` on a
  // read that bypasses fetchAll is the SAME silent-truncation bug wearing a
  // different hat: PostgREST returns exactly max-rows and no error, so the
  // audit reports a complete-looking tally built from a partial page.
  const limits = [...CODE.matchAll(/\.limit\(\s*(\d+)\s*\)/g)].map((m) => Number(m[1]))
  for (const n of limits) {
    assert.ok(n < 1000, `.limit(${n}) sits at or above the PostgREST cap and will silently truncate`)
  }
})

test('reads that can exceed the row cap go through fetchAll', () => {
  // Tables the audit reads directly. A chain on one of these that is NOT
  // routed through the paging helper must carry an explicit `.limit()` under
  // the server cap, so it is a deliberate sample rather than a silent
  // truncation. fetchAll pages on its own and needs no limit.
  const tallied = ['daily_sheets', 'expenses', 'daily_sheet_lines', 'sales']
  // Match a whole db.from(T)...select(...) chain, then look for a limit after it.
  for (const t of tallied) {
    const chain = new RegExp(`db\\s*\\.\\s*from\\(\\s*'${t}'\\s*\\)\\s*\\.\\s*select\\([^)]*\\)([\\s\\S]{0,200}?)(?=\\n\\s*(?:const|if|for|//|\\}))`, 'g')
    for (const m of CODE.matchAll(chain)) {
      const tail = m[1] || ''
      const limit = /\.limit\(\s*(\d+)\s*\)/.exec(tail)
      if (limit) {
        assert.ok(
          Number(limit[1]) < 1000,
          `${t} uses .limit(${limit[1]}) which is at or above the PostgREST cap and will silently truncate`,
        )
      } else {
        assert.fail(`${t} is read inline with no .limit() — route it through fetchAll() so it pages`)
      }
    }
  }
})

test('every read helper gates through assertReadOnly', () => {
  assert.match(CODE, /FORBIDDEN/)
  // Counting occurrences is too weak: the declaration plus ONE surviving call
  // still satisfies a `>= 2` check, so deleting a call site passes. What
  // actually matters is that each helper that talks to the database routes
  // through the guard.
  const bodyOf = (name) => {
    const start = CODE.search(new RegExp(`(async )?function ${name}\\s*\\(`))
    assert.notEqual(start, -1, `${name} must exist`)
    const after = CODE.indexOf('{', start)
    const end = CODE.indexOf('\n}', after)
    return CODE.slice(start, end === -1 ? undefined : end)
  }
  for (const helper of ['fetchAll', 'count']) {
    assert.match(
      bodyOf(helper),
      /assertReadOnly\(/,
      `${helper} reads from the database and must gate through assertReadOnly`,
    )
  }
})

test('the audit never prints a secret', () => {
  const env = read('.env.example') || ''
  assert.ok(env.length > 0, '.env.example should exist as a safe reference')
  assert.doesNotMatch(AUDIT, /process\.env\.[A-Z_]*KEY\s*\}/)
  // It reads keys, but must not echo them into the report.
  assert.doesNotMatch(CODE, /console\.log\([^)]*KEY/)
})

test('paging keeps asking until a genuinely short page comes back', () => {
  // Guards the regression that produced a wrong booking distribution: a page
  // size at or above the server cap returns exactly max-rows and stops early.
  const pageSize = /page\s*=\s*(\d+)/.exec(CODE)
  assert.ok(pageSize, 'fetchAll must declare an explicit page size')
  assert.ok(Number(pageSize[1]) <= 500, `page size must sit under the 1000-row PostgREST cap, got ${pageSize[1]}`)
  assert.match(CODE, /\.range\(\s*from/, 'fetchAll must page with .range()')
  assert.match(CODE, /data\.length\s*<\s*page/, 'the loop must stop only on a genuinely short page')
})

test('every table the audit names actually exists in the schema', () => {
  // The first version asked for queue_tickets / attendance / inventory_stock,
  // which do not exist; those reads returned null and were easy to misread as
  // "table is empty". The live names are staff_attendance, queue_assignments
  // and product_branch_stock.
  const known = new Set([
    'staff_profiles', 'branches', 'customers', 'bookings', 'vehicles', 'services', 'sales',
    'sale_line_items', 'expenses', 'transactions', 'daily_sheets', 'daily_sheet_lines',
    'staff_attendance', 'queue_assignments', 'active_customer_queue', 'pos_handoffs',
    'pos_ready_tickets', 'loyalty_ledger', 'ops_forms', 'ops_form_submissions', 'events', 'blogs',
    'audit_logs', 'product_branch_stock', 'service_reviews', 'push_subscriptions', 'vendors',
    'expense_reports', 'membership_tiers', 'notification_broadcasts', 'sms_events', 'plan_cards',
    'vehicle_catalog',
  ])
  const used = [...CODE.matchAll(/from\('([a-z_]+)'\)/g)].map((m) => m[1])
  for (const t of used) {
    assert.ok(known.has(t), `${t} is not in the known table list — verify it exists before auditing it`)
  }
  assert.ok(!used.includes('queue_tickets'), 'queue_tickets does not exist; the live table is active_customer_queue')
  assert.ok(!used.includes('attendance'), 'attendance does not exist; the live table is staff_attendance')
  assert.ok(!used.includes('inventory_stock'), 'inventory_stock does not exist; it is product_branch_stock')
})

test('push_subscriptions is keyed on user_id, not staff_id', () => {
  // The table's PK-ish column is user_id (the auth uid). Asking for staff_id
  // returns zero rows with no error, which reads as "nobody is enrolled".
  const sel = /fetchAll\(\s*'push_subscriptions',\s*'([^']+)'/s.exec(CODE)
  assert.ok(sel, 'the audit must read push_subscriptions')
  assert.match(sel[1], /user_id/, 'push_subscriptions is keyed on user_id')
  assert.ok(!/staff_id/.test(sel[1]), 'staff_id does not exist on push_subscriptions')
  assert.ok(
    !/push_subscriptions'\)[\s\S]{0,80}staff_id/.test(CODE),
    'never query push_subscriptions for staff_id',
  )
})

test('the stranded-handoff check reads booking_id and created_at', () => {
  // Omitting these made the audit report two bookings as deleted that both
  // exist — a false Critical.
  const handoffSelect = /fetchAll\(\s*'pos_handoffs',\s*'([^']+)'/s.exec(CODE)
  assert.ok(handoffSelect, 'the audit must read pos_handoffs through fetchAll')
  assert.match(handoffSelect[1], /booking_id/, 'without booking_id the handoff cannot be traced')
  assert.match(handoffSelect[1], /created_at/, 'without created_at the age of a stranded handoff is unknown')
})

test('the audit writes a machine-readable report and exits non-zero on trouble', () => {
  assert.match(CODE, /writeFileSync/)
  assert.match(CODE, /db-audit\.json/)
  assert.match(CODE, /process\.exit\(report\.ok \? 0 : 1\)/)
  assert.ok(!CODE.includes('process.exit(0)'), 'the audit must never report success unconditionally')
})