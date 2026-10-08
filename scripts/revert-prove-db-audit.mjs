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

const SUITES = ['tests/dbAuditSafety.test.js', 'tests/transactionsSettlement.test.js']

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

const MUTATIONS = [
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
]

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