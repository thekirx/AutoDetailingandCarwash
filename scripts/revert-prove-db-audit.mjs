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
  {
    file: 'scripts/check-sheet-ui.mjs',
    name: 'the till summary is read through a selector that matches nothing',
    from: ".ds-summary .ds-row",
    to: ".ds-summary .ds-nothing-matches-this",
  },
]

// An optional substring filter (`node scripts/revert-prove-db-audit.mjs till`)
// narrows the run while iterating on one area. The unfiltered run stays the gate:
// a filtered run proves the named mutations and nothing else.
const filter = process.argv[2] || ''
const MUTATIONS = filter ? ALL_MUTATIONS.filter((m) => m.name.includes(filter)) : ALL_MUTATIONS
if (!MUTATIONS.length) {
  console.error(`no mutation name matches "${filter}" — nothing was proved`)
  process.exit(1)
}

let failures = 0

for (const m of MUTATIONS) {
  const relPath = m.file || 'scripts/audit-db-deep.mjs'
  const abs = join(root, relPath)
  const original = readFileSync(abs, 'utf8')
  if (!original.includes(m.from)) {
    console.log(`SKIP  ${m.name} — anchor text not found in ${relPath}`)
    failures++
    continue
  }
  writeFileSync(abs, original.replace(m.from, m.to), 'utf8')
  const bad = runSuite()
  writeFileSync(abs, original, 'utf8')
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