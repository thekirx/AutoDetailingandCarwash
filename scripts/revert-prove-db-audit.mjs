/**
 * Revert-prove harness for the db-audit safety tests.
 *
 * Proves each new assertion actually catches the bug it claims to catch. A test
 * that cannot fail is worse than no test, because it reports safety it has not
 * verified. For each mutation: apply the bug, run the suite, require it to go
 * RED, restore the original bytes, require it to go GREEN.
 *
 *   node scripts/revert-prove-db-audit.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const SUITES = [
  'tests/dbAuditSafety.test.js',
  'tests/transactionsSettlement.test.js',
  'tests/safeEvaluate.test.js',
  'tests/apiRouteContract.test.js',
  'tests/dailySheetReconciliation.test.js',
  'tests/sheetUiConsistency.test.js',
  'tests/roleQaHarness.test.js',
  'tests/bookings401Probe.test.js',
  'tests/strandedHandoffsProbe.test.js',
  'tests/voidPosTestHandoffs.test.js',
  'tests/posInsights.test.js',
  'tests/customerRemountIntegrity.test.js',
  'tests/remountBlastRadiusProbe.test.js',
  'tests/dailySheetApprovalLadder.test.js',
  'tests/probeReadIntegrity.test.js',
  'tests/dailySheetIsManualTask.test.js',
  'tests/sheetPostedExpenseProtection.test.js',
  'tests/adminWritePolicyScope.test.js',
  'tests/authErrorMessage.test.js',
  'tests/customerSignInFailureHonesty.test.js',
  'tests/passwordUpdateErrorHonesty.test.js',
  'tests/guardedMigrationContract.test.js',
  'tests/paymentMethodBucketing.test.js',
  'tests/teamLeadCustomerHistoryAuth.test.js',
  'tests/sessionTokenFreshness.test.js',
  'tests/markdownTableIntegrity.test.js',
  'tests/notificationFanoutReach.test.js',
]

function runSuite() {
  for (const suite of SUITES) {
    try {
      execFileSync(process.execPath, ['--test', suite], {
        cwd: root, stdio: 'pipe', encoding: 'utf8',
      })
    } catch (err) {
      return { red: true, out: `${err.stdout || ''}${err.stderr || ''}` }
    }
  }
  return { red: false, out: '' }
}

const ALL_MUTATIONS = [
  {
    name: 'a read asks for more rows than PostgREST returns',
    from: ".select('id, total_minor').lt('total_minor', 0).limit(20)",
    to: ".select('id, total_minor').lt('total_minor', 0).limit(2000)",
  },
  {
    name: 'an inline read loses its limit and silently truncates',
    from: `.from('expenses')\n    .select('id, title, created_at')\n    .gt('created_at', '2099-01-01')\n    .limit(20)`,
    to: `.from('expenses')\n    .select('id, title, created_at')\n    .gt('created_at', '2099-01-01')`,
  },
  {
    name: 'fetchAll stops gating through the read-only guard',
    from: "  assertReadOnly(`fetchAll(${table})`, `${table} ${columns}`)\n",
    to: '',
  },
  {
    name: 'count stops gating through the read-only guard',
    from: "  assertReadOnly(`count(${table})`, `select * from ${table}`)\n",
    to: '',
  },
  {
    name: 'a money-mutating RPC is introduced',
    from: "async function count(table, filters) {",
    to: "async function count(table, filters) {\n  await db.rpc('submit_daily_sheet', { p_id: 1 })",
  },
  {
    name: 'the audit calls `transactions` a dead ledger again',
    from: "  const settleable = new Set(['pending_payment'])",
    to: "  note('Info', 'money', 'dead ledger, nothing reads it')\n  const settleable = new Set(['pending_payment'])",
  },
  {
    file: 'supabase/migrations/20260812133000_hakum_ops_redesign_followup.sql',
    name: 'the hand-off function inserts a status POS cannot settle',
    from: "'Queue ticket pending payment', release_time, 'pending_payment'",
    to: "'Queue ticket pending payment', release_time, 'pending'",
  },
  {
    file: 'supabase/migrations/20260819081507_complete_pos_sale_settle_txn.sql',
    name: 'the POS settle predicate drifts from what the hand-off creates',
    from: "where t.status = 'pending_payment'",
    to: "where t.status = 'pending'",
  },
  {
    file: 'scripts/e2e-role-qa-wave.mjs',
    name: 'the QA harness goes back to a bare page.evaluate in an assertion',
    from: 'const lane = await safeEvaluate(page, () =>\n          /collect at pos/i',
    to: 'const lane = await page.evaluate(() =>\n          /collect at pos/i',
  },
  {
    file: 'scripts/lib/safe-evaluate.mjs',
    name: 'safeEvaluate stops retrying and rethrows the navigation race',
    from: "      if (!isNavigationRace(err)) throw err",
    to: "      if (!isNavigationRace(err)) throw err\n      throw err",
  },
  {
    file: 'scripts/lib/safe-evaluate.mjs',
    name: 'safeEvaluate swallows genuine errors instead of rethrowing them',
    from: "      if (!isNavigationRace(err)) throw err",
    to: "      if (!isNavigationRace(err)) return false",
  },
  // The BUG-048 guard. Each of these reproduces a real way the deployed app can
  // 404 while every unit test still passes.
  {
    file: 'vercel.json',
    name: 'the /api/push-subscribe rewrite goes missing',
    from: '"source": "/api/push-subscribe"',
    to: '"source": "/api/push-subscribe-RENAMED"',
  },
  {
    file: 'api/public-inquiry.js',
    name: "BUG-048 itself: the gateway loses its defaultOperation",
    from: "createGateway(operations, { defaultOperation: 'complaints' })",
    to: 'createGateway(operations)',
  },
  {
    file: 'api/data-center.js',
    name: 'BUG-048 itself: the data-center gateway loses its defaultOperation',
    from: "createGateway(operations, { defaultOperation: 'data-center' })",
    to: 'createGateway(operations)',
  },
  {
    file: 'api/notifications.js',
    name: 'a gateway operation is renamed out from under its rewrite',
    from: "'push-subscribe': handlePushSubscribeRequest",
    to: "'push-subscribe-v2': handlePushSubscribeRequest",
  },
  {
    file: 'scripts/audit-db-deep.mjs',
    name: 'the audit stops flagging that no sheet exists for real trading',
    from: "note('High', 'dailysheet', 'every Daily Sheet is from the seeded demo month",
    to: "note('Info', 'dailysheet', 'every Daily Sheet is from the seeded demo month",
  },
  {
    file: 'scripts/audit-db-deep.mjs',
    name: 'the audit stops importing the app sheet arithmetic',
    from: "import { computeSheetTotals } from '../src/lib/dailySheet.js'",
    to: "const computeSheetTotals = () => ({})",
  },
  {
    file: 'scripts/audit-db-deep.mjs',
    name: 'the sheet reconciliation loses the totals column',
    from: "'id, branch, business_date, status, opening_float_minor, counted_cash_minor, totals'",
    to: "'id, branch, business_date, status'",
  },
  {
    file: 'scripts/audit-db-deep.mjs',
    name: 'the audit goes back to advising staff to ring up the stranded hand-offs',
    from: 'Do NOT ring these up.',
    to: 'Branch Admin can still ring these up from POS.',
  },
  {
    file: 'scripts/probe-daily-sheets.mjs',
    name: 'the sheet probe stops importing the app arithmetic',
    from: "import { computeSheetTotals } from '../src/lib/dailySheet.js'",
    to: "const computeSheetTotals = () => ({})",
  },
  {
    file: 'scripts/probe-daily-sheets.mjs',
    name: 'the sheet probe stops feeding real sales into the comparison',
    from: 'sales: daySales,',
    to: 'sales: [],',
  },
  // The DB -> screen check. Each of these was a real way it passed while
  // verifying nothing.
  {
    file: 'scripts/check-sheet-ui.mjs',
    name: 'the UI check falls back to the review inbox and compares 1 of 60',
    from: 'branch=all&status=all',
    to: 'branch=all',
  },
  {
    file: 'scripts/check-sheet-ui.mjs',
    name: 'the UI check treats an empty table as a pass',
    from: 'NOT VERIFIED — the table rendered no rows, so nothing could be compared.',
    to: 'PASS — the table rendered no rows, so nothing could be compared.',
  },
  {
    file: 'scripts/check-sheet-ui.mjs',
    name: 'the UI check stops resolving a branch label back to its slug',
    from: 'labelToSlug.set(b.slug, b.slug)',
    to: 'labelToSlug.set(b.slug, b.name)',
  },
  // Phase 2: the till. Each of these is a way the POS comparison could report
  // PASS while comparing the wrong thing, or nothing at all.
  {
    file: 'scripts/check-sheet-ui.mjs',
    name: 'the till is checked as Super Admin instead of the Branch Admin who works the till',
    from: "a.id === 'admin'",
    to: "a.id === 'superadmin'",
  },
  {
    file: 'scripts/check-sheet-ui.mjs',
    name: 'the till is checked on today, which no seeded sheet covers',
    from: 'tab=sheet&date=${posDate}',
    to: 'tab=sheet',
  },
  {
    file: 'scripts/check-sheet-ui.mjs',
    name: 'the till comparison stops flipping the Expenses sign',
    from: "['Expenses', want?.expenses, -1]",
    to: "['Expenses', want?.expenses, 1]",
  },
  {
    file: 'scripts/check-sheet-ui.mjs',
    name: 'the till comparison stops flipping the Salaries sign',
    from: "['Salaries', want?.salaries, -1]",
    to: "['Salaries', want?.salaries, 1]",
  },
  {
    file: 'scripts/check-sheet-ui.mjs',
    name: 'the till comparison negates Net profit',
    from: "['Net profit', want?.profit, 1]",
    to: "['Net profit', want?.profit, -1]",
  },
  {
    file: 'scripts/check-sheet-ui.mjs',
    name: 'the POS branch treats a summary that never rendered as a pass',
    from: 'if (!Object.keys(summary).length || !want) {',
    to: 'if (false) {',
  },
  {
    file: 'scripts/check-sheet-ui.mjs',
    name: 'an unrendered POS summary stops reporting the page errors it saw',
    from: 'page errors: ${posErrors.slice',
    to: 'page errors: (hidden)',
  },
  {
    file: 'scripts/check-sheet-ui.mjs',
    name: 'phase 2 reuses the Super Admin session instead of its own context',
    from: 'await browser.createBrowserContext()',
    to: 'await browser.newPage()',
  },
  {
    file: 'scripts/e2e-role-qa-wave.mjs',
    name: 'a console failure goes back to naming no route at all',
    from: '`console @${where()}: ${msg.text().slice(0, 300)}`',
    to: '`console: ${msg.text().slice(0, 300)}`',
  },
  {
    file: 'scripts/e2e-role-qa-wave.mjs',
    name: 'a page error goes back to naming no route at all',
    from: '`pageerror @${where()}: ${String(err?.message || err).slice(0, 300)}`',
    to: '`pageerror: ${String(err?.message || err).slice(0, 300)}`',
  },
  {
    file: 'scripts/e2e-role-qa-wave.mjs',
    name: 'the route is captured once instead of at event time, blaming the wrong page',
    from: 'return new URL(page.url()).pathname',
    to: 'return "the page"',
  },
  {
    file: 'scripts/e2e-role-qa-wave.mjs',
    name: 'the dock walk goes back to a bare page.goto that can kill the whole wave',
    from: 'const nav = await gotoRoute(page, `${base}${to}`)',
    to: "await page.goto(`${base}${to}`, { waitUntil: 'domcontentloaded', timeout: 60000 })",
  },
  {
    file: 'scripts/e2e-role-qa-wave.mjs',
    name: 'auth failures stop being captured, so the 401 loses its URL again',
    from: "page.on('response', (res) => {",
    to: "page.on('responseDISABLED', (res) => {",
  },
  {
    file: 'scripts/e2e-role-qa-wave.mjs',
    name: 'the bucket widens to every 4xx/5xx, turning dev-server 404s into product faults',
    from: 'if (status !== 401 && status !== 403) return',
    to: 'if (status < 200) return',
  },
  {
    file: 'scripts/e2e-role-qa-wave.mjs',
    name: 'gotoRoute stops retrying and gives up on the first abort',
    from: 'for (let i = 0; i < attempts; i++) {',
    to: 'for (let i = 0; i < 1; i++) {',
  },
  {
    file: 'scripts/e2e-role-qa-wave.mjs',
    name: 'gotoRoute stops saying why it gave up, so failures become unactionable again',
    from: 'return { ok: false, why: last }',
    to: 'return { ok: false }',
  },
  {
    file: 'scripts/check-sheet-ui.mjs',
    name: 'an unrendered POS summary is announced as a pass',
    from: 'NOT VERIFIED — the POS summary did not render',
    to: 'PASS — the POS summary did not render',
  },
  // The BUG-067 probe. A diagnostic that could write to production, or that stops
  // building its own route list, would quietly become useless or dangerous.
  {
    file: 'scripts/probe-bookings-401.mjs',
    name: 'the BUG-067 probe grows a write',
    from: "const failures = []",
    to: "const failures = []\n  await page.evaluate(() => fetch('/x', { method: 'DELETE' }))",
  },
  {
    file: 'scripts/probe-bookings-401.mjs',
    name: 'the probe hardcodes one route and stops covering the rest of the dock',
    from: 'const targets = MODE === \'walk\' ? dock : Array(VISITS).fill(ROUTE)',
    to: "const targets = Array(VISITS).fill('/operations/dashboard')",
  },
  {
    file: 'scripts/probe-bookings-401.mjs',
    name: 'the probe stops reading the wire, so the 401 loses its URL again',
    from: "page.on('response', (res) => {",
    to: "page.on('responseOFF', (res) => {",
  },
  {
    file: 'scripts/probe-bookings-401.mjs',
    name: 'a null result starts reading as a pass',
    from: 'The race did not reproduce in this window — that is a null result, not a clearance.',
    to: 'All clear — no issues found.',
  },
  // The stranded-hand-off probe. Its verdict decides what a destructive wipe may
  // delete, so a silently broken read is worse than no probe at all.
  {
    file: 'scripts/probe-stranded-handoffs.mjs',
    name: 'the handoff probe reads a column that does not exist again',
    from: ".select('id, email, full_name')",
    to: ".select('id, email, name')",
  },
  {
    file: 'scripts/probe-stranded-handoffs.mjs',
    name: 'readOrFail swallows the PostgREST error again, so every customer reads as absent',
    from: 'if (res.error) throw new Error(`${label} read failed: ${res.error.message}`)',
    to: 'if (res.error) return null',
  },
  {
    file: 'scripts/probe-stranded-handoffs.mjs',
    name: 'the customer read bypasses the error-raising helper',
    from: "readOrFail('customers', await db",
    to: 'await db',
  },
  // The void migration. Each guard here is the reason it is safe to run against
  // production at all, so each one is mutated in turn.
  {
    file: 'supabase/migrations/20261009030000_void_20260929_pos_test_handoffs.sql',
    name: 'the void stops guarding the hand-off count',
    from: 'if (select count(*) from unnest(target_handoff_ids)) <> 2 then',
    to: 'if false then',
  },
  {
    file: 'supabase/migrations/20261009030000_void_20260929_pos_test_handoffs.sql',
    name: 'the void stops guarding the booking count',
    from: 'if (select count(*) from unnest(group_ids)) <> 3 then',
    to: 'if false then',
  },
  {
    file: 'supabase/migrations/20261009030000_void_20260929_pos_test_handoffs.sql',
    name: 'the void stops checking for attached sales',
    from: 'if (select count(*) from public.sales s where s.booking_id = any(group_ids)) <> 0 then',
    to: 'if false then',
  },
  {
    file: 'supabase/migrations/20261009030000_void_20260929_pos_test_handoffs.sql',
    name: 'the void stops expanding to visit-group siblings, stranding one ticket per visit',
    from: 'or b.visit_group_id in (',
    to: 'or false in (',
  },
  {
    file: 'supabase/migrations/20261009030000_void_20260929_pos_test_handoffs.sql',
    name: 'the void cancels the hand-off but leaves its transaction pending',
    // Anchored with the update's own indentation and terminating semicolon. The
    // bare `where t.pos_handoff_id = any(target_handoff_ids)` also appears in the
    // earlier guard, and String.replace takes the FIRST match — so an unanchored
    // mutation edits the guard and leaves the update untouched, proving nothing.
    from: "   where t.pos_handoff_id = any(target_handoff_ids)\n     and t.status = 'pending_payment';",
    to: "   where false\n     and t.status = 'pending_payment';",
  },
  {
    file: 'supabase/migrations/20261009030000_void_20260929_pos_test_handoffs.sql',
    name: 'the void cancels the tickets but leaves them visible on the board',
    from: 'is_archived = true,',
    to: 'is_archived = false,',
  },
  {
    file: 'supabase/migrations/20261009030000_void_20260929_pos_test_handoffs.sql',
    name: 'the void leaves no audit trail',
    from: 'insert into public.queue_events (booking_id, branch, old_status, new_status, notes)',
    to: '-- insert into public.queue_events',
  },
  // The Sell-tab layout guard. This mutation is here because the test it
  // protects shipped broken: comparing three indexOf positions passed while the
  // Sell tab had stopped rendering "Sales today" at all.
  {
    file: 'src/pages/PosPage.jsx',
    name: 'the Sell tab silently stops rendering Sales today',
    from: '<PosStatsBoard stats={todaySummary} compact />',
    to: '{false && <PosStatsBoard stats={todaySummary} compact />}',
  },
  // Customer remount data loss. The remount re-points a handful of tables and
  // then deletes the old customers row; anything it forgets is either blocked by
  // a restrict FK (silent failure, duplicate row, request still answers 200) or
  // cascaded away (memberships and birthday perks destroyed by re-entering a
  // phone number at POS).
  {
    file: 'server/provisionCustomer.mjs',
    name: 'the customer remount forgets the loyalty ledger',
    from: "  'loyalty_ledger',\n",
    to: '',
  },
  {
    file: 'server/provisionCustomer.mjs',
    name: 'the customer remount forgets memberships',
    from: "  'customer_memberships',\n",
    to: '',
  },
  {
    file: 'server/provisionCustomer.mjs',
    name: 'the old-row delete goes unchecked again',
    from: "    const { error: deleteError } = await admin.from('customers').delete().eq('id', fromId)\n",
    to: "    await admin.from('customers').delete().eq('id', fromId)\n",
  },
  {
    file: 'scripts/probe-remount-blast-radius.mjs',
    name: 'the blast-radius probe passes a fabricated result into readOrFail',
    from: 'const rows = readOrFail(`${table} read`, res) || []',
    to: 'const rows = readOrFail(`${table} read`, { data: null, error: res.error }) || []',
  },
  // The daily-sheet money ladder. Expenses are copied into the books at approve
  // time, so anything that lets a sheet be edited, submitted or approved out of
  // order makes the sheet and the books disagree.
  {
    file: 'supabase/migrations/20261001090000_daily_sheet.sql',
    name: 'an approved daily sheet becomes editable again',
    from: / {2}if v_status in \('submitted', 'approved'\) then\r?\n {4}raise exception 'This sheet is %[^\n]*\r?\n {2}end if;\r?\n/,
    to: '',
  },
  {
    file: 'supabase/migrations/20261001090000_daily_sheet.sql',
    name: 'a draft or returned sheet submits without the status gate',
    from: / {2}if s\.status not in \('draft', 'returned'\) then\r?\n {4}raise exception 'Only draft or returned sheets can be submitted';\r?\n {2}end if;\r?\n/,
    to: '',
  },
  {
    file: 'supabase/migrations/20261001090000_daily_sheet.sql',
    name: 'review stops requiring a submitted sheet',
    from: / {2}if s\.status <> 'submitted' then raise exception 'Only submitted sheets can be reviewed'; end if;\r?\n/,
    to: '',
  },
  {
    file: 'supabase/migrations/20261001090000_daily_sheet.sql',
    name: 'approving a daily sheet twice posts the expenses twice',
    from: /on conflict \(daily_sheet_line_id\) where daily_sheet_line_id is not null do nothing;/,
    to: '-- no conflict guard: every approval inserts again',
  },
  {
    file: 'supabase/migrations/20261001090000_daily_sheet.sql',
    name: 'the already-approved short-circuit no longer returns posted 0',
    from: / {2}if s\.status = 'approved' and v_action = 'approve' then\r?\n {4}return jsonb_build_object\('id', s\.id, 'status', 'approved', 'posted', 0\);\r?\n {2}end if;\r?\n/,
    to: '',
  },
  {
    file: 'supabase/migrations/20261001090000_daily_sheet.sql',
    name: 'client-supplied totals beat the server arithmetic at submit',
    from: /totals = coalesce\(s\.totals, '\{\}'::jsonb\) \|\| v_totals/,
    to: "totals = coalesce(payload->'totals', s.totals)",
  },
  {
    file: 'supabase/migrations/20261001090000_daily_sheet.sql',
    name: 'reopening an approved sheet stops voiding the posted expense rows',
    from: / {2}delete from public\.expenses\r?\n {2}where daily_sheet_line_id in \(select id from public\.daily_sheet_lines where sheet_id = s\.id\);\r?\n {2}get diagnostics v_voided = row_count;\r?\n/,
    to: '  -- posted rows are left behind\r\n',
  },
  {
    file: 'supabase/migrations/20261001090000_daily_sheet.sql',
    name: 'any role can reopen an approved daily sheet',
    from: / {2}if public\.current_user_role\(\) is distinct from 'BossMich' then\r?\n {4}raise exception using errcode = '42501', message = 'Only Super Admin may reopen an approved sheet';\r?\n {2}end if;\r?\n/,
    to: '',
  },
  // Read-only probes. Three of these shipped a fabricated `{ data: null }`
  // into readOrFail and printed a clean "0 affected" for tables holding
  // thousands of rows, which is how a live data-loss bug becomes a blank.
  {
    file: 'scripts/probe-branch-residue.mjs',
    name: 'a probe fabricates its result into readOrFail again',
    from: "const rows = readOrFail(`${table} read`, res) || []",
    to: 'const rows = readOrFail(`${table} read`, { data: null, error: res.error }) || []',
  },
  {
    file: 'scripts/probe-tl-crew-scope.mjs',
    name: 'the crew-scope probe fabricates its staff read again',
    from: "const staff = readOrFail('staff_profiles', await db.from('staff_profiles').select('id, full_name, role, branch_slug, is_active').limit(1000)) || []",
    to: "const staff = readOrFail('staff_profiles', { data: null, error: null }) || []",
  },
  {
    file: 'scripts/probe-branch-residue.mjs',
    name: 'the branch-residue probe stops reading a real branch row count',
    from: /const branches = readOrFail\('branches',[\s\S]{0,160}?\) \|\| \[\]/,
    to: "const branches = readOrFail('branches', { data: null, error: null }) || []",
  },
  // The daily sheet is a manual BA task. If the tab stops being reachable, no
  // close-of-day happens at all and nothing else in the app would report it.
  {
    file: 'src/pages/PosPage.jsx',
    name: 'the Daily sheet tab stops being visible to a Branch Admin',
    from: /\{ id: 'sheet', label: 'Daily sheet', icon: ClipboardList \}/,
    to: '',
  },
  {
    file: 'src/pages/PosPage.jsx',
    name: 'the Today panel stops offering a way into the sheet',
    from: /onOpenSheet=\{canSheet \? \(\) => setShellTab\('sheet'\) : undefined\}/,
    to: 'onOpenSheet={undefined}',
  },
  {
    file: 'src/lib/dailySheet.js',
    name: 'a Branch Admin loses the right to file a daily sheet',
    from: /if \(role === 'BossMich' \|\| role === 'admin'\) return true/,
    to: "if (role === 'BossMich') return true",
  },
  // Money posted by an approved Daily Sheet must not be deletable behind the
  // sheet's back, and the Books route must not be the only control on it.
  {
    file: 'src/pages/finance/FinancePurchasesTab.jsx',
    name: 'Finance deletes a bill an approved sheet depends on',
    from: / {4}if \(row\.daily_sheet_line_id\) \{[\s\S]{0,300}?\n {4}\}\n/,
    to: '',
  },
  {
    file: 'src/pages/finance/FinancePurchasesTab.jsx',
    name: 'the expense delete stops being scoped to non-sheet rows',
    from: /\.is\('daily_sheet_line_id', null\)/,
    to: '',
  },
  {
    file: 'src/pages/finance/FinancePurchasesTab.jsx',
    name: 'deleting money stops leaving an audit row',
    from: /await writeAudit\(\{[\s\S]{0,320}?\}\)\n/,
    to: '',
  },
  {
    file: 'supabase/migrations/20261010120000_protect_daily_sheet_posted_expenses.sql',
    name: 'the DELETE policy stops excluding sheet-posted expenses',
    from: /using \(\r?\n {2}daily_sheet_line_id is null\r?\n {2}and \(\r?\n {4}public\.is_super_admin\(\)/,
    to: 'using (\r\n  (\r\n    public.is_super_admin()',
  },
  {
    file: 'supabase/migrations/20261010120000_protect_daily_sheet_posted_expenses.sql',
    name: 'the UPDATE policy stops excluding sheet-posted expenses',
    from: /using \(\r?\n {2}daily_sheet_line_id is null\r?\n {2}and \(\r?\n {4}public\.is_super_admin\(\)/,
    to: 'using (\r\n  (\r\n    public.is_super_admin()',
  },
  {
    file: 'supabase/migrations/20261010120000_protect_daily_sheet_posted_expenses.sql',
    name: 'Branch Admin gets expense DELETE back',
    from: /create policy "expenses_delete"\r?\non public\.expenses[\s\S]{0,400}?;/,
    to: 'create policy "expenses_delete"\r\non public.expenses\r\nfor delete\r\nto authenticated\r\nusing (\r\n  public.is_admin()\r\n  or public.is_super_admin()\r\n);',
  },
  // The drop migration removes Branch Admin's transaction writes. That is only
  // safe while every write to `transactions` runs as a definer and no app code
  // reaches the table through PostgREST — otherwise narrowing RLS breaks the
  // daily queue handoff.
  {
    file: 'supabase/migrations/20260808190000_visit_group_payment_admin_override.sql',
    name: 'the queue handoff stops being SECURITY DEFINER, so RLS would apply to it',
    from: /security\s+definer/i,
    to: 'security invoker',
  },
  {
    file: 'src/lib/posInsights.js',
    name: 'app code starts writing transactions through the client',
    from: /export const POS_LONG_WAIT_MIN = 20/,
    to: "export const POS_LONG_WAIT_MIN = 20\n// const t = supabase.from('transactions').insert({ id: 1 })",
  },
  {
    file: 'scripts/check-sheet-ui.mjs',
    name: 'the till summary is read through a selector that matches nothing',
    from: ".ds-summary .ds-row",
    to: ".ds-summary .ds-nothing-matches-this",
  },
  // BUG-077 — the customer sign-in page. It answered every non-session response
  // from /api/customer-auth-lookup with a literal credential string, discarding
  // the status. `data` is {} whenever the body is not JSON — a 502, a function
  // timeout, a hard crash — which is exactly when the fallback fired.
  {
    file: 'src/pages/CustomerSignInPage.jsx',
    name: 'BUG-077 itself: the sign-in branch blames the password for any failure',
    // Anchored on its own comment because `describeCustomerAuthFailure({ status: res.status, data })`
    // also appears in authLookup and in the email fallback — an unanchored
    // mutation would edit the first of those three and prove nothing.
    from: / {8}\/\/ BUG-077: this branch used to answer[\s\S]{0,300}?throw new Error\(describeCustomerAuthFailure\(\{ status: res\.status, data \}\)\)/,
    to: "        throw new Error(data.error || 'Invalid phone or password.')",
  },
  {
    file: 'src/pages/CustomerSignInPage.jsx',
    name: 'the email fallback goes back to preferring the endpoint error over Auth',
    from: /pwError\r?\n {14}\? describeAuthError\(pwError\)\r?\n {14}: describeCustomerAuthFailure\(\{ status: res\.status, data \}\),/,
    to: "            data.error || pwError?.message || 'Invalid email or password.',",
  },
  {
    file: 'src/pages/CustomerSignInPage.jsx',
    name: 'a dead network is shown to the customer as the browser raw message',
    from: / {2}\} catch \(err\) \{\r?\n {4}throw new Error\(describeAuthError\(\{ message: err\?\.message \}\)\)/,
    to: "  } catch (err) {\n    throw err",
  },
  {
    file: 'src/pages/CustomerSignInPage.jsx',
    name: 'the lookup helper passes our own 5xx exception text to the customer',
    from: "if (!res.ok) throw new Error(describeCustomerAuthFailure({ status: res.status, data }))",
    to: "if (!res.ok) throw new Error(data.error || 'Lookup failed.')",
  },
  {
    file: 'src/pages/CustomerSignInPage.jsx',
    name: 'the password-reset fallback shows a raw Supabase error verbatim',
    from: 'if (resetError) throw new Error(describeAuthError(resetError))',
    to: 'if (resetError) throw resetError',
  },
  // The mapper itself. The first of these is the important one: a "fix" that made
  // every failure vague would satisfy the honesty tests while breaking the only
  // message a customer can act on. Honesty must not collapse into vagueness.
  {
    file: 'src/lib/authErrorMessage.js',
    name: 'the mapper stops saying the credentials were wrong when they were',
    from: / {2}if \(code === 401\) \{\r?\n {4}\/\/ The server reserves 401 for a genuine credentials rejection\.\r?\n {4}return serverMessage \|\| 'Invalid phone or password\.'\r?\n {2}\}\r?\n/,
    to: '',
  },
  {
    file: 'src/lib/authErrorMessage.js',
    name: 'the mapper leaks our internal config names onto a customer screen',
    from: / {2}if \(code >= 500\) \{\r?\n {4}return 'The sign-in service is having trouble\. Try again in a moment\.'\r?\n {2}\}/,
    to: "  if (code >= 500) {\n    return serverMessage || 'The sign-in service is having trouble. Try again in a moment.'\n  }",
  },
  // BUG-078 — the last two customer auth surfaces. The password-update mapping
  // has to stay separate from the sign-in one: merging them re-creates BUG-076.
  {
    file: 'src/lib/authErrorMessage.js',
    name: 'the password mapper starts blaming the credentials it cannot know about',
    from: / {2}return 'Could not save your password\. Try again\.'\r?\n\}/,
    to: "  if (status === 400) return 'Invalid email or password.'\n\n  return 'Could not save your password. Try again.'\n}",
  },
  {
    file: 'src/lib/authErrorMessage.js',
    name: 'the password mapper stops pointing an expired reset link at the email',
    from: / {2}if \(\/auth session missing[\s\S]{0,200}?return 'Your reset link has expired\.[\s\S]{0,120}?'\r?\n {2}\}\r?\n/,
    to: '',
  },
  {
    file: 'src/lib/authErrorMessage.js',
    name: 'the password mapper goes back to Supabase own six-character floor',
    from: / {2}if \(\/at least \\d\+ characters\/\.test\(message\)\) \{\r?\n {4}return 'Password must be at least 8 characters\.'\r?\n {2}\}/,
    to: "  if (/at least \\d+ characters/.test(message)) {\n    return message\n  }",
  },
  {
    file: 'src/pages/CustomerSetPasswordPage.jsx',
    name: 'set-password shows the raw Supabase error again',
    from: / {6}if \(updateError\) \{\r?\n {8}setError\(describePasswordUpdateError\(updateError\)\)\r?\n {8}return\r?\n {6}\}/,
    to: '      if (updateError) throw updateError',
  },
  {
    file: 'src/pages/CustomerSetPasswordPage.jsx',
    name: 'set-password reports a save failure after the save already succeeded',
    from: /homeAfterPassword\(userData\.user\?\.id\)\.catch\(\(\) => '\/account'\)/,
    to: 'homeAfterPassword(userData.user?.id)',
  },
  {
    file: 'src/pages/CustomerSignUpPage.jsx',
    name: 'signup goes back to blaming every failure on account creation',
    from: /throw new Error\(describeCustomerAuthFailure\(\{ status: res\.status, data: body \}\)\)/,
    to: "throw new Error(body.error || 'Unable to create account.')",
  },
  {
    file: 'src/pages/CustomerSignUpPage.jsx',
    name: 'signup drops the per-field validation errors the server sends',
    from: 'if (body.fields) setErrors(body.fields)',
    to: '',
  },
  // BUG-079 — the Branch Admin company-wide inbox. NotificationBell selects with
  // no user_id filter, so this read policy is the only scoping that exists.
  {
    file: 'supabase/migrations/20261010140000_scope_notification_reads.sql',
    name: 'BUG-079 itself: the read policy hands Branch Admin every notification',
    from: /create policy user_notifications_select\r?\non public\.user_notifications\r?\nfor select\r?\nto authenticated\r?\nusing \(\r?\n {2}user_id = \(select auth\.uid\(\)\)\r?\n {2}or public\.is_super_admin\(\)\r?\n\);/,
    to: 'create policy user_notifications_select\non public.user_notifications\nfor select\nto authenticated\nusing (\n  user_id = (select auth.uid())\n  or public.is_admin()\n);',
  },
  {
    file: 'supabase/migrations/20261010140000_scope_notification_reads.sql',
    name: 'the narrowing forgets to keep a user their own rows',
    from: / {2}user_id = \(select auth\.uid\(\)\)\r?\n {2}or public\.is_super_admin\(\)/,
    to: '  public.is_super_admin()',
  },
  {
    file: 'supabase/migrations/20261010140000_scope_notification_reads.sql',
    name: 'the narrowing stops keeping Super Admin the support read',
    from: / {2}or public\.is_super_admin\(\)\r?\n\);/,
    to: '  or public.is_super_admin() and false\n);',
  },
  {
    file: 'supabase/migrations/20261010140000_scope_notification_reads.sql',
    name: 'the drop guard stops refusing a policy it has not read',
    from: / {2}if v_current is distinct from '[\s\S]{0,200}?' then\r?\n {4}raise exception 'user_notifications_select has drifted/,
    to: '  if false then\n    raise exception \'user_notifications_select has drifted',
  },
  {
    file: 'supabase/migrations/20261010140000_scope_notification_reads.sql',
    name: 'the migration stops checking is_super_admin exists, denying Super Admin silently',
    from: / {2}if not exists \(\r?\n {4}select 1 from pg_proc p[\s\S]{0,400}?raise exception 'public\.is_super_admin\(\) is missing/,
    to: "  if false then\n    raise exception 'public.is_super_admin() is missing",
  },
  {
    file: 'scripts/verify-after-rls-migration.sql',
    name: 'the owner verification stops checking the bell still works',
    from: "select case when count(*) > 0 then 'PASS' else 'FAIL — no policy would let a user read their own inbox' end as verdict",
    to: "select case when count(*) > 0 then 'PASS' else 'unverified' end as verdict",
  },
  // BUG-080 — Branch Admin could rewrite every SMS template, because a single
  // `for all` policy named "Marketing sms templates" was gated on is_admin().
  {
    file: 'supabase/migrations/20261010150000_scope_sms_template_writes.sql',
    name: 'BUG-080 itself: a FOR ALL policy hands Branch Admin every template write',
    from: /drop policy if exists "Marketing sms templates" on public\.sms_templates;/,
    to: 'create policy "Marketing sms templates" on public.sms_templates\nfor all to authenticated\nusing ((select public.is_admin()) or (select public.current_user_role()) = \'marketing\')\nwith check ((select public.is_admin()) or (select public.current_user_role()) = \'marketing\');',
  },
  {
    file: 'supabase/migrations/20261010150000_scope_sms_template_writes.sql',
    name: 'the template update policy goes back to is_admin()',
    from: /create policy "sms_templates_update"\r?\non public\.sms_templates\r?\nfor update\r?\nto authenticated\r?\nusing \(public\.is_super_admin\(\) or public\.current_user_role\(\) = 'marketing'\)/,
    to: 'create policy "sms_templates_update"\non public.sms_templates\nfor update\nto authenticated\nusing (public.is_admin() or public.current_user_role() = \'marketing\')',
  },
  {
    file: 'supabase/migrations/20261010150000_scope_sms_template_writes.sql',
    name: 'the template delete policy goes back to is_admin()',
    from: /create policy "sms_templates_delete"\r?\non public\.sms_templates\r?\nfor delete\r?\nto authenticated\r?\nusing \(public\.is_super_admin\(\) or public\.current_user_role\(\) = 'marketing'\);/,
    to: 'create policy "sms_templates_delete"\non public.sms_templates\nfor delete\nto authenticated\nusing (public.is_admin());',
  },
  {
    file: 'supabase/migrations/20261010150000_scope_sms_template_writes.sql',
    name: 'the template read is closed off, so nobody can list the catalogue',
    from: /create policy "sms_templates_read"\r?\non public\.sms_templates\r?\nfor select\r?\nto authenticated\r?\nusing \(true\);/,
    to: "create policy \"sms_templates_read\"\non public.sms_templates\nfor select\nto authenticated\nusing (false);",
  },
  {
    file: 'supabase/migrations/20261010150000_scope_sms_template_writes.sql',
    name: 'the drift guard stops refusing a policy it has not read',
    from: / {2}if v_current not ilike '%is_admin%' or v_current not ilike '%marketing%' then\r?\n {4}raise exception 'the "Marketing sms templates" policy has drifted/,
    to: '  if false then\n    raise exception \'the "Marketing sms templates" policy has drifted',
  },
  {
    file: 'supabase/migrations/20261010150000_scope_sms_template_writes.sql',
    name: 'the guard stops refusing to run without is_super_admin()',
    from: / {2}if not exists \(\r?\n {4}select 1 from pg_proc p[\s\S]{0,400}?raise exception 'public\.is_super_admin\(\) is missing/,
    to: "  if false then\n    raise exception 'public.is_super_admin() is missing",
  },
  // The guarded-migration contract. Each of these removes one half of a
  // requirement, so the file stops describing what it exists to enforce.
  {
    file: 'supabase/migrations/20261010140000_scope_notification_reads.sql',
    name: 'the contract stops requiring a transaction around the narrowing',
    from: 'begin;',
    to: '-- no transaction: a failure halfway would leave policies half-applied',
  },
  {
    file: 'supabase/migrations/20261010140000_scope_notification_reads.sql',
    name: 'the contract stops requiring the migration to be able to abort',
    from: /raise exception 'user_notifications_select is missing/,
    to: '-- nothing to abort on',
  },
  {
    file: 'supabase/migrations/20261010120000_protect_daily_sheet_posted_expenses.sql',
    name: 'the contract stops requiring is_super_admin to be checked before depending on it',
    from: /raise exception 'public\.is_super_admin\(\) is missing — the replacement policies depend on it'/,
    to: "-- is_super_admin() is assumed to exist",
  },
  {
    file: 'tests/guardedMigrationContract.test.js',
    name: 'the contract stops covering the migrations it lists',
    from: "  '20261010150000_scope_sms_template_writes.sql',\n]",
    to: ']',
  },
  // BUG-081 — the drawer could tell a Branch Admin their correct drawer was
  // short, because an unrecognised payment method fell back to CASH.
  {
    file: 'src/lib/dailySheet.js',
    name: 'BUG-081 itself: an unknown payment method is counted as drawer cash',
    // The original defect, restored in full: a private map whose fallback is
    // 'cash'. An earlier version of this mutation only forced 'cash' -> cash and
    // left everything else on drawerPaymentBucket, so it never actually
    // reintroduced the bug and correctly reported NOT PROVED. A mutation that
    // does not reproduce the defect proves nothing.
    from: 'byMethod[drawerPaymentBucket(s.payment_method)] += amount(s.total_minor)',
    to:
      "byMethod[({ cash: 'cash', gcash: 'gcash', 'g-cash': 'gcash', card: 'card', credit: 'card', debit: 'card', online: 'bank', bank: 'bank', transfer: 'bank' })[String(s.payment_method || 'cash').toLowerCase()] || 'cash'] += amount(s.total_minor)",
  },
  {
    file: 'src/lib/paymentMethods.js',
    name: 'the shared map sends unknown back to cash',
    from: "  if (raw == null || String(raw).trim() === '') return 'other'\n  return ALIASES[String(raw).trim().toLowerCase()] || 'other'",
    to: "  if (raw == null || String(raw).trim() === '') return 'other'\n  return ALIASES[String(raw).trim().toLowerCase()] || 'cash'",
  },
  {
    file: 'src/lib/paymentMethods.js',
    name: 'the drawer stops falling back to cash for a recorded-but-unknown method',
    from: /export function drawerPaymentBucket\(raw\) \{\r?\n {2}if \(raw == null \|\| String\(raw\)\.trim\(\) === ''\) return 'cash'\r?\n {2}return paymentBucket\(raw\)/,
    to: "export function drawerPaymentBucket(raw) {\n  return 'cash'\n}",
  },
  {
    file: 'src/lib/paymentMethods.js',
    name: 'the normalizer stops trimming and lowercasing, so CASH becomes unknown',
    from: "return ALIASES[String(raw).trim().toLowerCase()] || 'other'",
    to: "return ALIASES[String(raw)] || 'other'",
  },
  {
    file: 'src/lib/salesSummary.js',
    name: 'the finance summary goes back to a third private map that never lowercases',
    from: 'const summaryBucket = (raw) => METHOD_BUCKET[paymentBucket(raw)]',
    to: "const summaryBucket = (raw) => METHOD_BUCKET[raw] || 'other'",
  },
  {
    file: 'src/lib/dailySheet.js',
    name: 'the Other bucket disappears, so unknown methods stop being accounted for',
    from: /const byMethod = \{ cash: 0, gcash: 0, card: 0, bank: 0, other: 0 \}/,
    to: 'const byMethod = { cash: 0, gcash: 0, card: 0, bank: 0 }',
  },
  // BUG-083 — Team Lead customer history 401s on every call and hides it behind
  // a fallback onto a different dataset.
  {
    file: 'src/pages/TeamLeadQueuePage.jsx',
    name: 'BUG-083 itself: the history fetch sends no Authorization header again',
    from: /const res = await fetch\(`\/api\/customer-history\?\$\{params\}`, \{\r?\n {8}headers: \{ Authorization: `Bearer \$\{token\}` \},\r?\n {6}\}\)/,
    to: 'const res = await fetch(`/api/customer-history?${params}`)',
  },
  {
    file: 'src/pages/TeamLeadQueuePage.jsx',
    name: 'the history call stops refreshing the token and reuses a captured one',
    from: / {6}const token = await getAccessTokenFresh\(\)\r?\n {6}if \(!token\) \{\r?\n {8}setHistoryError\('Sign in required'\)\r?\n {8}return\r?\n {6}\}/,
    to: "      const token = session?.access_token\n      if (!token) return",
  },
  {
    file: 'server/customerHistoryApi.mjs',
    name: 'the endpoint stops refusing an anonymous caller',
    from: / {4}if \(!token\) return json\(res, 401, \{ error: 'Unauthorized' \}\)/,
    to: "    if (!token) token = 'x'",
  },
  {
    file: 'src/pages/TeamLeadQueuePage.jsx',
    name: 'the open-queue fallback silently replaces history before the API is consulted',
    // An earlier version of this mutation only reworded the comment above the
    // fallback, so it never moved anything and correctly reported NOT PROVED.
    // This one neuters the gate for real: the API-success branch never runs, so
    // the board query always does — which is the defect being guarded.
    from: 'if (res.ok) {',
    to: 'if (res.ok && !res.ok) {',
  },
  {
    file: 'src/pages/TeamLeadQueuePage.jsx',
    name: 'a new staff fetch is added without a bearer token',
    from: / {6}const token = await getAccessTokenFresh\(\)\r?\n {6}if \(!token\) \{/,
    to: "      await fetch('/api/maintenance-schedules?branch=x')\n      const token = await getAccessTokenFresh()\n      if (!token) {",
  },
  // BUG-084 — a refresh that yields nothing hands back a token that has already
  // expired. Every authenticated /api/* call routes through this helper.
  {
    file: 'src/lib/session.js',
    name: 'BUG-084 itself: the stale fallback ignores expiry again',
    from: / {2}if \(next\?\.access_token\) return next\.access_token\r?\n {2}if \(session\?\.access_token && !isSessionExpired\(session\)\) return session\.access_token\r?\n {2}return null/,
    to: "  return next?.access_token || session?.access_token || null",
  },
  {
    file: 'src/lib/session.js',
    name: 'the guard is swapped for the blunt one that throws away usable tokens',
    from: 'if (session?.access_token && !isSessionExpired(session)) return session.access_token',
    to: 'if (session?.access_token && !needsRefresh(session)) return session.access_token',
  },
  {
    file: 'src/lib/session.js',
    name: 'a refresh that succeeds is no longer preferred over the old token',
    from: 'if (next?.access_token) return next.access_token',
    to: 'if (next?.access_token && isSessionExpired(next)) return next.access_token',
  },
  {
    file: 'src/lib/session.js',
    name: 'a refresh error is swallowed instead of propagating, hiding the dead token',
    from: / {4}const \{ data, error \} = await auth\.refreshSession\(\)\r?\n {6}if \(error\) throw error\r?\n {6}return data\.session \|\| null/,
    to: '      const { data } = await auth.refreshSession()\n      return data.session || null',
  },
  // BUG-085 — self-approval. review_daily_sheet separates roles but never
  // people, and a default ASA holds both `pos` and `finance_view` (asa_has_grant
  // denies only finance_write/planning_edit/rbac_edit when a key is absent), so
  // one identity could file a sheet and approve it. Mutations target the guard
  // migration rather than the original, which is the live definition after apply.
  {
    file: 'supabase/migrations/20261010160000_daily_sheet_separation_of_duties.sql',
    name: 'BUG-085 itself: the self-approval guard is gone from review_daily_sheet',
    from: /\r?\n {2}if v_action = 'approve'\r?\n {5}and s\.submitted_by is not null\r?\n {5}and s\.submitted_by = caller[\s\S]*?message = 'You cannot approve a daily sheet you submitted yourself';\r?\n {2}end if;\r?\n/,
    to: '\n',
  },
  {
    file: 'supabase/migrations/20261010160000_daily_sheet_separation_of_duties.sql',
    name: 'BUG-085: the guard compares the reviewer to the wrong column',
    // reviewed_by is null on a first submission and stale on a resubmission, so
    // this reads as a passing guard while every self-approval walks straight through.
    from: 'and s.submitted_by = caller',
    to: 'and s.reviewed_by = caller',
  },
  {
    file: 'supabase/migrations/20261010160000_daily_sheet_separation_of_duties.sql',
    name: 'BUG-085: the Super Admin exemption is inverted, locking the owner out',
    from: "and public.current_user_role() is distinct from 'BossMich' then",
    to: "and public.current_user_role() = 'BossMich' then",
  },
  {
    file: 'supabase/migrations/20261010160000_daily_sheet_separation_of_duties.sql',
    name: 'BUG-085: the guard reads submitted_by from the client payload',
    from: 's.submitted_by is not null',
    to: "nullif(payload->>'submitted_by', '')::uuid is not null",
  },
  {
    file: 'supabase/migrations/20261010160000_daily_sheet_separation_of_duties.sql',
    name: 'BUG-085: the guard sits after the expenses it was meant to prevent',
    from: /(\r?\n {2}if v_action = 'approve'\r?\n {5}and s\.submitted_by is not null[\s\S]*?submitted yourself';\r?\n {2}end if;)(\r?\n\r?\n {2}if v_action = 'approve' then[\s\S]*?get diagnostics v_cleared = row_count;\r?\n {2}end if;\r?\n)/,
    to: '$2$1',
  },
  {
    file: 'supabase/migrations/20261010160000_daily_sheet_separation_of_duties.sql',
    name: 'BUG-085: the guard blocks returning your own sheet, stranding a rejected one',
    from: / {2}if v_action = 'approve'\r?\n {5}and s\.submitted_by is not null/,
    to: '  if s.submitted_by is not null',
  },
  {
    file: 'supabase/migrations/20261010160000_daily_sheet_separation_of_duties.sql',
    name: 'BUG-085: the refusal is downgraded to a generic error code',
    from: /errcode = '42501',\r?\n {6}message = 'You cannot approve a daily sheet you submitted yourself';/,
    to: "errcode = 'P0001',\r\n      message = 'You cannot approve a daily sheet you submitted yourself';",
  },
  {
    file: 'supabase/migrations/20261010160000_daily_sheet_separation_of_duties.sql',
    name: 'BUG-085: create-or-replace silently drops the double-post guard',
    from: /\r?\n {4}on conflict \(daily_sheet_line_id\) where daily_sheet_line_id is not null do nothing;/,
    to: ';',
  },
  {
    file: 'supabase/migrations/20261010160000_daily_sheet_separation_of_duties.sql',
    name: 'BUG-085: create-or-replace silently drops the submitted-only status gate',
    from: /\r?\n {2}if s\.status <> 'submitted' then raise exception 'Only submitted sheets can be reviewed';/,
    to: '',
  },
  {
    file: 'src/lib/dailySheetApi.js',
    name: 'BUG-085: the error mapper swallows the self-approval refusal as a migration prompt',
    from: '/daily_sheet|does not exist|schema cache/i',
    to: '/daily_sheet|daily sheet|does not exist|schema cache/i',
  },
  {
    file: 'src/lib/dailySheet.js',
    name: 'BUG-085: the client predicate stops refusing self-approval',
    from: 'return submittedBy !== currentUserId',
    to: 'return true',
  },
  {
    file: 'src/lib/dailySheet.js',
    name: 'BUG-085: the client predicate drops the Super Admin exemption too',
    from: "if (profile?.role === 'BossMich') return true\n  const submittedBy = sheet?.submitted_by",
    to: 'const submittedBy = sheet?.submitted_by',
  },
  {
    file: 'src/pages/pos/DailySheetPanel.jsx',
    name: 'BUG-085: Approve is rendered unconditionally again',
    from: "canApproveSheet(profile, sheet, user?.id) ? (",
    to: 'true ? (',
  },
  // The notification fan-out gate. planStaffRecipients drops any recipient it
  // cannot give a URL to, so a role that is notified but cannot open the link
  // silently hears nothing.
  {
    file: 'src/lib/notifyRouting.js',
    name: 'a notified role is pointed only at a url it cannot open',
    from: "complaint: { roles: [R.SUPER_ADMIN, R.ASSISTANT_SUPER_ADMIN, R.ADMIN], urls: ['/operations/planning?tab=forms'] }",
    to: "complaint: { roles: [R.SUPER_ADMIN, R.ASSISTANT_SUPER_ADMIN, R.ADMIN], urls: ['/operations/data-center'] }",
  },
  {
    file: 'src/lib/notifyRouting.js',
    name: 'a notification url is a route the app does not render',
    from: "inquiry: { roles: [R.SUPER_ADMIN, R.ASSISTANT_SUPER_ADMIN], urls: ['/operations/inquiries'] }",
    to: "inquiry: { roles: [R.SUPER_ADMIN, R.ASSISTANT_SUPER_ADMIN], urls: ['/operations/inguiries'] }",
  },
  // The SQL/JS parity assertions. Mutated on the JS side deliberately: the
  // geo_clock_in migration belongs to a concurrent session editing this tree, and
  // revert-prove writes mutations in place. The parity check reads both, so
  // changing either half makes it fail — and this one is ours to touch.
  {
    file: 'src/lib/notifyRouting.js',
    name: 'the JS notify table drifts from the geo_clock_in SQL recipients',
    from: 'attendance_location_alert: { roles: [R.SUPER_ADMIN, R.ASSISTANT_SUPER_ADMIN, R.ADMIN], urls: [\'/operations/attendance\'] }',
    to: "attendance_location_alert: { roles: [R.SUPER_ADMIN, R.ASSISTANT_SUPER_ADMIN], urls: ['/operations/attendance'] }",
  },
  {
    file: 'src/lib/notifyRouting.js',
    name: 'a SQL-notified role is given a url it cannot open',
    from: "attendance_location_alert: { roles: [R.SUPER_ADMIN, R.ASSISTANT_SUPER_ADMIN, R.ADMIN], urls: ['/operations/attendance'] }",
    to: "attendance_location_alert: { roles: [R.SUPER_ADMIN, R.ASSISTANT_SUPER_ADMIN, R.ADMIN], urls: ['/operations/data-center'] }",
  },
]

// An optional substring filter (`node scripts/revert-prove-db-audit.mjs till`)
// narrows the run while iterating on one area. Comma-separate it to prove a group
// (`... "dead network,lookup helper"`) in one pass instead of paying the full
// ~20-suite startup cost per mutation. The unfiltered run stays the gate: a
// filtered run proves the named mutations and nothing else.
const filter = process.argv[2] || ''
const needles = filter ? filter.split(',').map((s) => s.trim()).filter(Boolean) : []
const MUTATIONS = needles.length ? ALL_MUTATIONS.filter((m) => needles.some((n) => m.name.includes(n))) : ALL_MUTATIONS
if (filter && !MUTATIONS.length) {
  console.error(`no mutation name matches "${filter}" — nothing was proved`)
  process.exit(1)
}

let failures = 0

// OneDrive and antivirus both hold short-lived write locks on a file they are
// syncing, and Node surfaces those as `UNKNOWN` / `EBUSY` / `EPERM`. A bare
// writeFileSync turns a transient lock into a dead run that leaves the mutated
// source on disk, which is the worst possible outcome: the tree is broken and
// nothing recorded that it was broken. Retry instead.
const TRANSIENT = new Set(['UNKNOWN', 'EBUSY', 'EPERM', 'EACCES', 'EMFILE'])

function writeText(abs, content, label, attempts = 12) {
  for (let i = 1; i <= attempts; i++) {
    try {
      writeFileSync(abs, content, 'utf8')
      return
    } catch (err) {
      const transient = TRANSIENT.has(err.code)
      if (!transient || i === attempts) {
        console.error(`\nFATAL: could not ${label} ${abs}`)
        console.error(`  code=${err.code} after ${i} attempt(s)`)
        console.error(`  The file is in an unknown state. Inspect it before trusting the tree.`)
        process.exit(2)
      }
      // Synchronous sleep; this loop must not yield, or the restore ordering breaks.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.min(250 * i, 2000))
    }
  }
}

for (const m of MUTATIONS) {
  const relPath = m.file || 'scripts/audit-db-deep.mjs'
  const abs = join(root, relPath)
  const original = readFileSync(abs, 'utf8')
  // Anchors are either a literal string or a RegExp. RegExps are required for
  // anything spanning lines in a CRLF checkout — a literal "\n" never matches.
  const isRe = m.from instanceof RegExp
  const matches = isRe ? m.from.test(original) : original.includes(m.from)
  if (!matches) {
    console.log(`SKIP  ${m.name} — anchor text not found in ${relPath}`)
    failures++
    continue
  }
  writeText(abs, original.replace(m.from, m.to), 'mutate')
  // Prove the mutation actually landed. `String.replace` silently returns the
  // input unchanged when the anchor matches but `to` happens to equal the match
  // (or when a RegExp match is empty-width), and an unmutated file passes the
  // suite trivially — which reads downstream as "the guard does not work" and
  // sends you hunting a bug in the code instead of in the harness. Also refuse a
  // mutation that would leave the source byte-identical for any other reason.
  const mutated = readFileSync(abs, 'utf8')
  if (mutated === original) {
    writeText(abs, original, 'restore')
    console.log(`NOT PROVED  ${m.name} — the mutation produced a byte-identical file`)
    failures++
    continue
  }
  let bad
  try {
    bad = runSuite()
  } catch (err) {
    // Never let a suite throw skip the restore. The mutation is live right now.
    writeText(abs, original, 'restore')
    throw err
  }
  writeText(abs, original, 'restore')
  const good = runSuite()

  if (bad.red && !good.red) {
    const which = [...bad.out.matchAll(/^✖ (.+?) \([\d.]+ms\)/gm)]
      .map((m) => m[1])
      .join(' | ')
    console.log(`PROVED  ${m.name}`)
    console.log(`        caught by: ${which || '(NO TEST REPORTED A FAILURE — proof is incomplete)'}`)
    if (!which) failures++
  } else {
    console.log(`NOT PROVED  ${m.name} — red=${bad.red} greenAfterRestore=${!good.red}`)
    failures++
  }
}

console.log(failures === 0 ? '\nALL MUTATIONS PROVED' : `\n${failures} MUTATION(S) NOT PROVED`)
process.exit(failures === 0 ? 0 : 1)