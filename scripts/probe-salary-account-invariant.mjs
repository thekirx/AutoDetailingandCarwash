/**
 * READ-ONLY. Is account 14 (the one review_daily_sheet posts salary lines to)
 * actually present and usable, and have any salary expenses landed without a
 * category?
 *
 * review_daily_sheet does:
 *
 *   select id into v_salary_account from public.expense_categories where code = '14';
 *
 * and then writes that into expenses.category_id. There is no null check on the
 * result, and expenses.category_id is nullable, so IF account 14 were missing
 * every salary line would post as a paid expense with no account -- invisible in
 * the P&L rather than failing loudly.
 *
 * 20261009180000_expense_categories_crud.sql defends it with a trigger that
 * refuses to DELETE code 14 and refuses to move it off code 14 / kind payroll /
 * unarchived. So this should be unreachable. "Should be" is what this probe
 * exists to replace with a fact, because a trigger is only as good as the table
 * it was attached to.
 *
 * SELECT only. Writes nothing.
 *
 *   node scripts/probe-salary-account-invariant.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue
  const i = line.indexOf('=')
  if (i < 0) continue
  const k = line.slice(0, i).trim()
  if (!process.env[k]) process.env[k] = line.slice(i + 1).trim()
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function readOrFail(label, res) {
  if (res.error) throw new Error(`${label} read failed: ${res.error.message}`)
  return res.data
}

const cats = readOrFail(
  'expense_categories',
  await db.from('expense_categories').select('id, name, code, kind, is_archived').order('code'),
) || []

const salary = cats.filter((c) => c.code === '14')
console.log(`expense_categories rows: ${cats.length}`)
console.log(`rows with code '14': ${salary.length}`)

if (salary.length === 0) {
  console.log('\nBROKEN — account 14 is absent. Every salary line would post uncategorised.')
  process.exit(1)
}
if (salary.length > 1) {
  console.log(`\nAMBIGUOUS — ${salary.length} rows share code '14'; review_daily_sheet picks one arbitrarily.`)
}
for (const s of salary) {
  console.log(`  id=${s.id} name="${s.name}" kind=${s.kind} is_archived=${s.is_archived}`)
  if (s.is_archived) console.log('  !! archived — the CRUD trigger is meant to prevent this')
}

// The lookup ignores is_active and is_archived, so it finds the row either way.
// What matters is that the id it would find is the one the books already use.
const salaryId = salary[0].id

const uncategorised = readOrFail(
  'paid expenses without a category',
  await db
    .from('expenses')
    .select('id, title, total_minor, branch, created_at')
    .eq('status', 'paid')
    .is('category_id', null)
    .limit(100),
) || []

console.log(`\npaid expenses with NO category: ${uncategorised.length}`)
for (const e of uncategorised.slice(0, 10)) {
  console.log(`  ${e.created_at?.slice(0, 10)} ${e.branch} ${(Number(e.total_minor || 0) / 100).toFixed(2)}  ${String(e.title).slice(0, 60)}`)
}
if (uncategorised.length) {
  console.log('\nThese are NOT necessarily salary lines — an expense may legitimately lack a category.')
  console.log('The point is the count, which the sheet path would grow if account 14 ever went missing.')
}

const salaryExpenses = readOrFail(
  'salary expenses',
  await db
    .from('expenses')
    .select('id, total_minor, branch, created_at, category_id')
    .eq('category_id', salaryId)
    .order('created_at', { ascending: false })
    .limit(50),
) || []
console.log(`\nexpenses filed against account 14: ${salaryExpenses.length} (most recent first)`)
for (const e of salaryExpenses.slice(0, 5)) {
  console.log(`  ${e.created_at?.slice(0, 10)} ${e.branch} ${(Number(e.total_minor || 0) / 100).toFixed(2)}`)
}

const sheetSalaries = readOrFail(
  'posted sheet expenses',
  await db
    .from('expenses')
    // category_id MUST be selected. An earlier version of this probe omitted it,
    // every row came back with `undefined`, the filter counted zero, and it
    // cheerfully reported "SOME ARE UNCATEGORISED" for 349 perfectly categorised
    // rows. A probe that reports a finding must be distinguishable from one that
    // failed to look -- silence is safe, a false Critical is not.
    .select('id, total_minor, daily_sheet_line_id, category_id, status')
    .not('daily_sheet_line_id', 'is', null),
) || []

// Prove the read actually carried the column before counting anything with it.
const sample = sheetSalaries[0] || {}
if (sheetSalaries.length && !('category_id' in sample)) {
  throw new Error('category_id was not returned — refusing to count rows I did not read')
}

const postedWithCat = sheetSalaries.filter((e) => e.category_id).length
const paidSheet = sheetSalaries.filter((e) => e.status === 'paid')
console.log(`\nsheet-posted expenses: ${sheetSalaries.length}, of which carry a category: ${postedWithCat}`)
console.log(`sheet-posted AND status='paid': ${paidSheet.length}`)
if (postedWithCat !== sheetSalaries.length) {
  console.log('\n!! SOME SHEET-POSTED EXPENSES ARE UNCATEGORISED — salary costs would be missing from the P&L')
  for (const e of sheetSalaries.filter((x) => !x.category_id).slice(0, 10)) {
    console.log(`   ${String(e.created_at).slice(0, 10)} ${e.branch} ₱${(Number(e.total_minor || 0) / 100).toFixed(2)}`)
  }
} else {
  console.log('Every sheet-posted expense carries a category — the invariant holds in the data.')
}