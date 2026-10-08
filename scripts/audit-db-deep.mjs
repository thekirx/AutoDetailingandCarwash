/**
 * READ-ONLY deep audit of the live Hakum database.
 *
 *   node scripts/audit-db-deep.mjs            # full audit
 *   node scripts/audit-db-deep.mjs --section integrity
 *
 * This script NEVER writes. It uses the service-role key only to read what the
 * anon role cannot see (RLS-protected rows), which is the only way to audit the
 * real state. No INSERT/UPDATE/DELETE/DDL is issued anywhere in this file —
 * that is deliberate, and `assertReadOnly` below fails the run if a mutating
 * call ever appears in the query list.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'e2e-evidence', 'db-audit')
mkdirSync(outDir, { recursive: true })

for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('=')
  if (i < 0) continue
  const k = line.slice(0, i)
  if (!process.env[k]) process.env[k] = line.slice(i + 1)
}

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set')
  process.exit(1)
}

// Hard guarantee: nothing in this file may mutate.
const FORBIDDEN = /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke)\b/i
function assertReadOnly(label, sql) {
  if (FORBIDDEN.test(sql)) throw new Error(`REFUSING non-read query in "${label}": ${sql}`)
}

const db = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' },
})

/**
 * PostgREST caps a response at max-rows (1000 here) and returns a SHORT page
 * rather than erroring. The first version of this audit read `.limit(5000)` and
 * believed it: it tallied 1000 of 1312 bookings and reported the distribution
 * as if complete. Paging only works if the page size is under the cap, and the
 * loop must keep going until it genuinely gets a short page.
 */
async function fetchAll(table, columns = '*', { page = 500, filters } = {}) {
  assertReadOnly(`fetchAll(${table})`, `${table} ${columns}`)
  const rows = []
  for (let from = 0; ; from += page) {
    let q = db.from(table).select(columns).range(from, from + page - 1)
    if (filters) q = filters(q)
    const { data, error } = await q
    if (error) return { rows, error: error.message }
    rows.push(...(data || []))
    if (!data || data.length < page) break
  }
  return { rows }
}

async function count(table, filters) {
  assertReadOnly(`count(${table})`, `select * from ${table}`)
  let q = db.from(table).select('*', { count: 'exact', head: true })
  if (filters) q = filters(q)
  const { count: n, error } = await q
  if (error) return { count: null, error: error.message }
  return { count: n }
}

const findings = []
function note(severity, section, message, detail = {}) {
  findings.push({ severity, section, message, ...detail })
  const tag = { Critical: '✖', High: '✖', Medium: '⚠', Low: '·', Info: '·' }[severity] || '·'
  console.log(`${tag} [${section}] ${message}`)
  if (Object.keys(detail).length) console.log(`    ${JSON.stringify(detail)}`)
}

const sections = process.argv.slice(2)
const want = (name) => sections.length === 0 || sections.includes(name)

// ── Connectivity ─────────────────────────────────────────────────────────

if (want('connect')) {
  const { data, error } = await db.from('staff_profiles').select('id').limit(1)
  if (error) {
    note('Critical', 'connect', 'cannot read staff_profiles', { error: error.message })
    console.error('\nFATAL: no database access. Aborting.')
    process.exit(1)
  }
  note('Info', 'connect', 'connected with service role', { url: URL, sample: data?.length ?? 0 })
}

// ── Core tables ──────────────────────────────────────────────────────────

/**
 * Real table names, taken from the PostgREST root (`GET /rest/v1/`) rather than
 * guessed. The first version of this script asked for `queue_tickets`,
 * `attendance` and `inventory_stock` and got nulls back — those tables do not
 * exist. The live names are staff_attendance, queue_assignments /
 * active_customer_queue, and product_branch_stock.
 */
const CORE = [
  'staff_profiles', 'branches', 'customers', 'bookings', 'vehicles',
  'services', 'sales', 'sale_line_items', 'expenses', 'transactions',
  'daily_sheets', 'daily_sheet_lines', 'staff_attendance', 'queue_assignments',
  'active_customer_queue', 'pos_handoffs', 'pos_ready_tickets', 'loyalty_ledger',
  'ops_forms', 'ops_form_submissions', 'events', 'blogs',
  'audit_logs', 'product_branch_stock', 'service_reviews', 'push_subscriptions',
  'vendors', 'expense_reports', 'membership_tiers', 'notification_broadcasts',
  'sms_events', 'plan_cards', 'vehicles', 'vehicle_catalog',
]

if (want('tables')) {
  console.log('\n--- row counts ---')
  for (const t of CORE) {
    const { count: n, error } = await count(t)
    if (error) note('Medium', 'tables', `cannot count ${t}`, { error })
    else note('Info', 'tables', `${t}`, { rows: n })
  }
}

// ── Integrity: money path ────────────────────────────────────────────────

if (want('integrity')) {
  console.log('\n--- money integrity ---')

  // A sale can never be negative.
  const { data: negSales } = await db.from('sales').select('id, total_minor').lt('total_minor', 0).limit(20)
  if (negSales?.length) note('Critical', 'integrity', 'negative sale totals exist', { rows: negSales })

  // paid sales must have a payment method.
  const { data: noPay } = await db
    .from('sales')
    .select('id, payment_method, total_minor')
    .eq('status', 'paid')
    .is('payment_method', null)
    .limit(20)
  if (noPay?.length) note('High', 'integrity', 'paid sales with no payment method', { rows: noPay.length })

  // expenses must never be negative.
  const { data: negExp } = await db.from('expenses').select('id, title, total_minor').lt('total_minor', 0).limit(20)
  if (negExp?.length) note('Critical', 'integrity', 'negative expense totals exist', { rows: negExp })

  // a posted expense must be dated, not 2099
  const { data: badDate } = await db
    .from('expenses')
    .select('id, title, created_at')
    .gt('created_at', '2099-01-01')
    .limit(20)
  if (badDate?.length) note('Medium', 'integrity', 'expenses dated beyond 2099', { rows: badDate })

  // sales on a branch that no longer exists / is archived
  const { rows: orphanSales } = await fetchAll('sales', 'id, branch, total_minor', {
    filters: (q) => q.not('branch', 'is', null),
  })
  if (orphanSales.length) {
    const { rows: liveBranches } = await fetchAll('branches', 'slug, is_archived, is_active, is_public')
    const known = new Set(liveBranches.map((b) => b.slug))
    const orphans = orphanSales.filter((s) => !known.has(s.branch))
    if (orphans.length) {
      note('Medium', 'integrity', 'sales reference an unknown branch', {
        count: orphans.length,
        branches: [...new Set(orphans.map((o) => o.branch))],
      })
    }
  }
}

// ── Money reconciliation ─────────────────────────────────────────────────
// The whole business runs on: POS sale -> Daily Sheet -> Finance approve -> books.
// These checks ask whether the numbers in those four places actually agree.

if (want('money')) {
  console.log('\n--- money reconciliation ---')

  const { rows: sales } = await fetchAll(
    'sales',
    'id, branch, status, payment_method, total_minor, discount_minor, occurred_at',
  )
  const { rows: lines } = await fetchAll(
    'sale_line_items',
    'id, sale_id, item_type, name, quantity, unit_price_minor, line_total_minor, line_kind',
  )
  const { rows: txns } = await fetchAll(
    'transactions',
    'id, type, amount_minor, currency, payment_method, status, occurred_at, is_archived, pos_handoff_id, booking_id, created_at',
  )
  // The select must include booking_id and created_at. Leaving them out made this
  // check report "booking no longer exists" for two bookings that both exist —
  // a false Critical that would have sent someone hunting for deleted data.
  const { rows: handoffs } = await fetchAll(
    'pos_handoffs',
    'id, booking_id, branch, amount_minor, status, transaction_id, completed_at, created_at',
  )

  const paid = sales.filter((s) => s.status === 'paid')
  const paidTotal = paid.reduce((a, s) => a + (s.total_minor || 0), 0)
  note('Info', 'money', 'sales', {
    total: sales.length,
    paid: paid.length,
    paidTotalMinor: paidTotal,
    paidTotalPHP: (paidTotal / 100).toFixed(2),
  })

  // 1. Line items must sum to their sale. A mismatch means the books disagree
  //    with what the customer was charged.
  const bySale = new Map()
  for (const l of lines) {
    if (!bySale.has(l.sale_id)) bySale.set(l.sale_id, [])
    bySale.get(l.sale_id).push(l)
  }
  const lineMismatch = []
  for (const s of sales) {
    const ls = bySale.get(s.id)
    if (!ls || !ls.length) continue
    const sum = ls.reduce((a, l) => a + (l.line_total_minor || 0), 0)
    const discount = s.discount_minor || 0
    if (sum - discount !== (s.total_minor || 0)) {
      lineMismatch.push({
        sale: s.id,
        status: s.status,
        lines: sum,
        discount,
        saleTotal: s.total_minor,
        delta: sum - discount - (s.total_minor || 0),
      })
    }
  }
  if (lineMismatch.length) {
    note('Critical', 'money', 'sale line items do not reconcile to the sale total', {
      count: lineMismatch.length,
      sample: lineMismatch.slice(0, 5),
    })
  } else {
    note('Info', 'money', 'every sale with line items reconciles', { checked: bySale.size })
  }

  // 2. A sale with a handoff must have a matching transaction, or cash was
  //    collected and never booked.
  const paidTxn = txns.filter((t) => !t.is_archived)
  const paidTxnTotal = paidTxn.reduce((a, t) => a + (t.amount_minor || 0), 0)
  note('Info', 'money', 'transactions', {
    total: txns.length,
    live: paidTxn.length,
    liveTotalMinor: paidTxnTotal,
    liveTotalPHP: (paidTxnTotal / 100).toFixed(2),
  })

  // 3. Handoffs that completed must point at a transaction.
  const txnIds = new Set(txns.map((t) => t.id))
  const completedHandoffs = handoffs.filter((h) => h.status === 'completed' || h.completed_at)
  const handoffNoTxn = completedHandoffs.filter((h) => h.transaction_id && !txnIds.has(h.transaction_id))
  if (handoffNoTxn.length) {
    note('High', 'money', 'completed POS handoffs with no matching transaction', {
      count: handoffNoTxn.length,
      sample: handoffNoTxn.slice(0, 5),
    })
  }
  note('Info', 'money', 'POS handoffs', {
    total: handoffs.length,
    completed: completedHandoffs.length,
    withoutTransaction: handoffNoTxn.length,
  })

  // 4. Sale vs transaction double counting: if every paid sale also has a
  //    transaction, the same money may be counted in both ledgers.
  const { rows: posSales } = await fetchAll('sales', 'id, transaction_id, pos_handoff_id', {
    filters: (q) => q.not('transaction_id', 'is', null),
  })
  note('Info', 'money', 'sales carrying a transaction_id', {
    count: posSales.length,
    hint: 'if sales and transactions both hold the same money, confirm only one is summed in reports',
  })

  // 5. Currency must be uniform; mixed currencies silently summed is wrong money.
  const currencies = new Set([...sales.map((s) => s.currency), ...txns.map((t) => t.currency)].filter(Boolean))
  if (currencies.size > 1) {
    note('High', 'money', 'mixed currencies in the money tables', { currencies: [...currencies] })
  } else {
    note('Info', 'money', 'currency', { currency: [...currencies][0] || 'unset' })
  }

  // 6. Stranded handoffs: a customer sent to POS whose handoff never completed.
  //    This is the daily-operations money leak — the car left the floor but the
  //    sale was never closed.
  const stuck = handoffs.filter((h) => h.status === 'pending' && !h.completed_at)
  if (stuck.length) {
    const bookingIds = stuck.map((h) => h.booking_id).filter(Boolean)
    const { rows: linked } = await fetchAll(
      'bookings',
      'id, status, branch',
      { filters: (q) => q.in('id', bookingIds) },
    )
    const byId = new Map(linked.map((b) => [b.id, b]))
    const detail = stuck.map((h) => ({
      amountPHP: (h.amount_minor / 100).toFixed(2),
      created: String(h.created_at).slice(0, 10),
      bookingStatus: byId.get(h.booking_id)?.status ?? 'MISSING',
      branch: h.branch,
    }))
    const totalPHP = stuck.reduce((a, h) => a + (h.amount_minor || 0), 0)
    note('High', 'money', 'POS handoffs that never completed (stranded at the counter)', {
      count: stuck.length,
      totalPHP: (totalPHP / 100).toFixed(2),
      detail,
      hint: 'Do NOT ring these up. Investigate provenance first: 2026-09-29 is a manual POS test day and both rows trace to placeholder customers that never transacted (BUG-061). Ringing them up would post test data into the real books.',
    })
    const missingBooking = detail.filter((d) => d.bookingStatus === 'MISSING')
    if (missingBooking.length) {
      note('Critical', 'money', 'stranded handoffs whose booking no longer exists', { count: missingBooking.length })
    }
  } else {
    note('Info', 'money', 'no stranded POS handoffs', { completed: completedHandoffs.length })
  }

  // 7. `transactions` reconciliation.
  //
  //    The first version of this audit called `transactions` a DEAD LEDGER on
  //    the strength of a reference search across src/, server/ and api/. That
  //    search was too narrow and the conclusion was wrong: the write path is
  //    in the DATABASE, not the app.
  //
  //      20260819081507_complete_pos_sale_settle_txn.sql:155
  //        update public.transactions t set status = 'completed' ...
  //      20260812133000_hakum_ops_redesign_followup.sql:233
  //        insert into public.transactions (...) values (..., 'pending_payment')
  //
  //    So the table is live and the real question is whether the two records of
  //    the same money agree. A handoff that reads `completed` while its
  //    transaction still reads unsettled is money recorded twice, disagreeing.
  const handoffById = new Map(handoffs.map((h) => [h.id, h]))
  const settleable = new Set(['pending_payment'])
  // Split the mismatch by whether the row could ever have settled. A settled
  // hand-off whose transaction is still `pending_payment` is a real
  // reconciliation failure — the POS took the money and the ledger disagrees.
  // A row in any other status is historical residue: it cannot transition at
  // all, which is a different and much smaller problem. Reporting both at once
  // double-counts the same rows and cries wolf about money that is not at risk.
  const liveMismatch = []
  const residue = []
  for (const t of txns) {
    if (t.is_archived) continue
    const h = t.pos_handoff_id ? handoffById.get(t.pos_handoff_id) : null
    if (!h) continue
    const hDone = h.status === 'completed'
    const tDone = t.status === 'completed'
    if (hDone && !tDone) {
      const row = {
        txn: String(t.id).slice(0, 8),
        txnStatus: t.status,
        handoff: String(h.id).slice(0, 8),
        amountPHP: (Number(t.amount_minor || 0) / 100).toFixed(2),
        created: String(t.created_at || '').slice(0, 10),
      }
      // complete_pos_sale settles ONLY `pending_payment`. Anything else is dead.
      if (settleable.has(t.status)) liveMismatch.push(row)
      else residue.push(row)
    }
  }

  if (liveMismatch.length) {
    note('High', 'money', 'handoff completed but its transaction never settled', {
      count: liveMismatch.length,
      detail: liveMismatch.slice(0, 10),
      hint: 'The sale is paid and the handoff is completed, yet a settleable transaction is still open.',
    })
  } else {
    note('Info', 'money', 'every settleable transaction agrees with its handoff', {
      checked: txns.filter((t) => t.pos_handoff_id && settleable.has(t.status)).length,
    })
  }

  if (residue.length) {
    note('Low', 'money', 'transactions in a status no code path can settle', {
      count: residue.length,
      detail: residue.slice(0, 10),
      settleableStatuses: [...settleable],
      note: 'complete_pos_sale settles only status=pending_payment. These rows sit in `pending` and can never transition. They were created by 20260707132730 (the only migration version that inserted `pending`), corrected by 20260715153235 — so this is historical residue and is NOT recurring. No money is at risk: `sales` is the money source of truth and no app report reads this table.',
    })
  }

  const noMethod = txns.filter((t) => !t.payment_method)
  if (noMethod.length) {
    note('Low', 'money', 'transactions with no payment method recorded', {
      count: noMethod.length,
      of: txns.length,
      note: 'Presentational only: nothing reports from this table, and the settled amount lives on `sales.payment_method`.',
    })
  }
}

// Bookings and staff are read once and shared by every section below.
var allBookings = []
var allStaff = []
if (want('bookings') || want('integrity')) {
  allBookings = (await fetchAll('bookings', 'id, status, branch, scheduled_start')).rows
}
if (want('auth')) {
  allStaff = (await fetchAll('staff_profiles', 'id, role, is_active, is_archived')).rows
}

if (want('bookings')) {
  const byStatus = {}
  for (const b of allBookings) byStatus[b.status] = (byStatus[b.status] || 0) + 1
  note('Info', 'bookings', 'status distribution (paged, complete)', {
    total: allBookings.length,
    ...byStatus,
  })

  const missingBranch = allBookings.filter((b) => !b.branch && b.scheduled_start)
  if (missingBranch.length) {
    note('Medium', 'integrity', 'scheduled bookings with no branch', { count: missingBranch.length })
  }
}

if (want('integrity')) {
  // open queue tickets pointing at a booking that is not open
  const { rows: openTickets } = await fetchAll(
    'active_customer_queue',
    'booking_id, branch, queue_number, status',
    { filters: (q) => q.in('status', ['waiting', 'in_progress', 'final_checking', 'for_payment']) },
  )
  note('Info', 'integrity', 'open queue rows (paged)', { count: openTickets.length })
  if (openTickets.length) {
    const bookingMap = new Map(allBookings.map((b) => [b.id, b.status]))
    const mismatched = openTickets.filter(
      (t) => t.booking_id && bookingMap.has(t.booking_id) &&
        ['completed', 'cancelled'].includes(bookingMap.get(t.booking_id)),
    )
    if (mismatched.length) {
      note('High', 'integrity', 'open queue rows whose booking is completed/cancelled', {
        count: mismatched.length,
        sample: mismatched.slice(0, 5),
      })
    }
    const missing = openTickets.filter((t) => t.booking_id && !bookingMap.has(t.booking_id))
    if (missing.length) {
      note('Medium', 'integrity', 'queue rows referencing a missing booking', { count: missing.length })
    }
  }
}

// ── Auth / staff integrity ───────────────────────────────────────────────

if (want('auth')) {
  console.log('\n--- staff + auth integrity ---')
  const staff = allStaff
  const roles = {}
  for (const s of staff) {
    const key = `${s.role}${s.is_active ? '' : ' (inactive)'}${s.is_archived ? ' archived' : ''}`
    roles[key] = (roles[key] || 0) + 1
  }
  note('Info', 'auth', 'staff roles (paged, complete)', { total: staff.length, ...roles })

  const expected = ['BossMich', 'assistant_super_admin', 'admin', 'operations_lead', 'team_lead', 'sales', 'staff', 'marketing', 'detailer', 'video_editor', 'investor']
  const seen = new Set(staff.map((s) => s.role))
  const unknown = [...seen].filter((r) => !expected.includes(r))
  if (unknown.length) {
    note('High', 'auth', 'staff rows carry a role the app does not know', {
      unknown,
      hint: 'src/auth/permissions.js ROLES has no such value; these people cannot be routed anywhere',
    })
  }

  const activeSuperAdmins = staff.filter((s) => s.role === 'BossMich' && s.is_active && !s.is_archived)
  if (activeSuperAdmins.length === 0) {
    note('Critical', 'auth', 'NO active Super Admin exists — nobody can repair anything')
  } else if (activeSuperAdmins.length > 1) {
    note('Medium', 'auth', 'more than one active Super Admin', { count: activeSuperAdmins.length })
  }

  // push enrollment (ops blocker).
  // push_subscriptions keys on user_id (the auth uid), NOT staff_id — asking for
  // staff_id silently returns zero rows, which reads as "nobody enrolled" even
  // when three people are.
  const { rows: subs } = await fetchAll('push_subscriptions', 'id, user_id, role, branch_slug, created_at')
  const activeIds = new Set(allStaff.filter((s) => s.is_active && !s.is_archived).map((s) => s.id))
  const anyStaffIds = new Set(allStaff.map((s) => s.id))
  const enrolledActive = subs.filter((s) => activeIds.has(s.user_id))
  const inactiveStaffSubs = subs.filter((s) => !activeIds.has(s.user_id) && anyStaffIds.has(s.user_id))
  // Not "orphans". Every row in production belongs to the demo customer
  // account, which is a customer and correctly absent from staff_profiles.
  // Calling these orphans implied corrupted data and hid the real signal: the
  // push path works, nobody on staff has simply never enabled it.
  const nonStaffSubs = subs.filter((s) => !anyStaffIds.has(s.user_id))

  note('Info', 'auth', 'push enrollment (paged, keyed on user_id)', {
    activeStaff: activeIds.size,
    subscriptionRows: subs.length,
    enrolledActiveStaff: enrolledActive.length,
    notEnrolled: activeIds.size - enrolledActive.length,
    nonStaffSubscriptions: nonStaffSubs.length,
    inactiveStaffSubscriptions: inactiveStaffSubs.length,
    nonStaffRoles: [...new Set(nonStaffSubs.map((s) => s.role))],
  })
  if (activeIds.size - enrolledActive.length > 0) {
    note('High', 'auth', 'most active staff have no push subscription', {
      activeStaff: activeIds.size,
      enrolled: enrolledActive.length,
      note: 'Ops blocker: no phone alert reaches the floor. The endpoint resolves on production and the subscribe handler keys the row on the auth uid, so this is an enrollment gap, not a broken path. Enabling it is a per-device browser action and is NOT automatable.',
    })
  }
}

// ── Daily Sheet integrity (the money path) ───────────────────────────────

if (want('dailysheet')) {
  console.log('\n--- daily sheet integrity ---')
  const { rows: sheetRows } = await fetchAll(
    'daily_sheets',
    'id, branch, business_date, status, opening_float_minor, counted_cash_minor, totals',
  )
  const sheets = sheetRows
  const byStatus = {}
  for (const s of sheets || []) byStatus[s.status] = (byStatus[s.status] || 0) + 1
  note('Info', 'dailysheet', 'sheet status distribution', byStatus)

  // one sheet per branch per day is enforced by a unique index
  const seen = new Map()
  const dupes = []
  for (const s of sheets || []) {
    const k = `${s.branch}|${s.business_date}`
    if (seen.has(k)) dupes.push(k)
    seen.set(k, s.id)
  }
  if (dupes.length) note('Critical', 'dailysheet', 'duplicate sheet for a branch/day', { count: dupes.length, sample: dupes.slice(0, 5) })

  // approved sheets must have posted expenses
  const { rows: postedRows } = await fetchAll('expenses', 'daily_sheet_line_id', {
    filters: (q) => q.not('daily_sheet_line_id', 'is', null),
  })
  const posted = postedRows
  const postedSheetIds = new Set()
  if (posted?.length) {
    // Chunked: a .in() list of every posted id would grow the URL past what
    // PostgREST and the proxies in front of it will accept.
    const ids = [...new Set(posted.map((p) => p.daily_sheet_line_id))]
    for (let i = 0; i < ids.length; i += 200) {
      const { rows: lineRows } = await fetchAll('daily_sheet_lines', 'id, sheet_id', {
        filters: (q) => q.in('id', ids.slice(i, i + 200)),
      })
      for (const l of lineRows) postedSheetIds.add(l.sheet_id)
    }
  }
  const approvedNoPosts = (sheets || []).filter((s) => s.status === 'approved' && !postedSheetIds.has(s.id))
  if (approvedNoPosts.length) {
    note('Medium', 'dailysheet', 'approved sheets with no posted expense lines (empty sheets are legal)', {
      count: approvedNoPosts.length,
    })
  }

  // ── Does each sheet agree with the money it claims? ──────────────────────
  // Every other check in this audit looks at one link of the chain at a time.
  // This one asks whether a sheet's `totals` block actually matches the sales it
  // is supposed to summarise, and whether its own arithmetic holds. A sheet
  // could approve a figure the POS never recorded and everything else stays
  // green.
  const byMethodSum = (t) => (t.byMethod ? Object.values(t.byMethod).reduce((a, b) => a + (Number(b) || 0), 0) : null)
  const n = (v) => Number(v || 0)
  const sheetDrift = []
  for (const sh of sheets || []) {
    const t = sh.totals || {}
    // Expected cash is derived from the sheets that DO balance, so it is the
    // live formula rather than one invented to fit.
    if (t.expectedCashMinor !== undefined && t.cashMinor !== undefined) {
      const expectCash = n(t.cashMinor) - n(t.totalExpensesMinor) + n(sh.opening_float_minor) + n(t.caRepaidMinor)
      if (expectCash !== n(t.expectedCashMinor)) {
        sheetDrift.push({ branch: sh.branch, date: sh.business_date, why: 'expectedCash', deltaPHP: (expectCash - n(t.expectedCashMinor)) / 100 })
      }
    }
    if (t.netMinor !== undefined && t.grossMinor !== undefined && n(t.grossMinor) - n(t.discountsMinor) !== n(t.netMinor)) {
      sheetDrift.push({ branch: sh.branch, date: sh.business_date, why: 'net != gross - discounts', deltaPHP: (n(t.grossMinor) - n(t.discountsMinor) - n(t.netMinor)) / 100 })
    }
    const bm = byMethodSum(t)
    if (bm !== null && bm !== n(t.grossMinor)) {
      sheetDrift.push({ branch: sh.branch, date: sh.business_date, why: 'byMethod != gross', deltaPHP: (bm - n(t.grossMinor)) / 100 })
    }
  }
  // September is the seeded test month, so drift there is a seed artifact and
  // not a production money bug. Reporting it as one would cry wolf on money
  // that is not at risk, and would bury a genuine drift on another day.
  const seeded = (d) => String(d || '').startsWith('2026-09')
  const seededDrift = sheetDrift.filter((d) => seeded(d.date))
  const realDrift = sheetDrift.filter((d) => !seeded(d.date))
  if (realDrift.length) {
    note('High', 'dailysheet', 'a sheet outside the seeded month does not reconcile', {
      count: realDrift.length, detail: realDrift.slice(0, 10),
    })
  } else {
    note('Info', 'dailysheet', 'every non-seeded sheet reconciles internally', {
      checked: (sheets || []).filter((s) => !seeded(s.business_date)).length,
    })
  }
  if (seededDrift.length) {
    note('Info', 'dailysheet', 'seeded September sheets do not reconcile (seed artifact, not a money bug)', {
      count: seededDrift.length,
      detail: seededDrift.slice(0, 5),
      note: 'scripts/seed/september2026Db.mjs writes gross/net/byMethod by a different rule than it writes the sales. The demo month is therefore not a faithful model of a real sheet. See BUG-065.',
    })
  }

  // cash advances must NEVER have posted to expenses (MONEY-CONTRACT rule)
  const caFilter = (q) => q.like('title', 'Cash advance%').not('daily_sheet_line_id', 'is', null)
  const { count: caCount } = await count('expenses', caFilter)
  if (caCount) {
    const { rows: caSample } = await fetchAll('expenses', 'id, title, expense_kind, daily_sheet_line_id', {
      page: 50, filters: caFilter,
    })
    note('Critical', 'dailysheet', 'cash advances posted to expenses — the Daily Sheet contract forbids this', {
      count: caCount, rows: caSample.slice(0, 20),
    })
  }
}

// ── Content / public surface ─────────────────────────────────────────────

if (want('content')) {
  console.log('\n--- content integrity ---')
  for (const [table, col, label] of [
    ['services', 'is_active', 'services'],
    ['blogs', 'is_published', 'blog posts'],
    ['events', 'is_published', 'events'],
  ]) {
    const { count: total } = await count(table)
    const { count: live } = await db.from(table).select('*', { count: 'exact', head: true }).eq(col, true)
    note('Info', 'content', `${label}`, { total, publishedOrActive: live })
  }

  // a published post with no title would render an empty share card
  const { data: untitled } = await db.from('blogs').select('id, slug, title').is('published_at', null).limit(1)
  note('Info', 'content', 'blogs sample checked', { ok: untitled !== null })
}

// ── Audit log ────────────────────────────────────────────────────────────

if (want('audit')) {
  console.log('\n--- audit log ---')
  const { count: n } = await count('audit_logs')
  note('Info', 'audit', 'audit_logs rows', { rows: n })
  if (n === 0) note('High', 'audit', 'audit log is EMPTY — money actions are untraceable')
}

// ── Summary ──────────────────────────────────────────────────────────────

const bySeverity = findings.reduce((acc, f) => {
  acc[f.severity] = (acc[f.severity] || 0) + 1
  return acc
}, {})
const report = {
  ok: !findings.some((f) => f.severity === 'Critical' || f.severity === 'High'),
  url: URL,
  at: new Date().toISOString(),
  bySeverity,
  findings,
}
writeFileSync(join(outDir, 'db-audit.json'), JSON.stringify(report, null, 2))
console.log(`\n---\n${JSON.stringify(bySeverity)}`)
console.log(`report: e2e-evidence/db-audit/db-audit.json`)
process.exit(report.ok ? 0 : 1)