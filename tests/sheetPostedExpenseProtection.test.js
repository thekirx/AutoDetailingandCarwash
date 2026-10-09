import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { allowRoute } from '../src/auth/permissions.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const strip = (rel) =>
  readFileSync(join(root, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

const tab = strip('src/pages/finance/FinancePurchasesTab.jsx')
const sheet = strip('supabase/migrations/20261001090000_daily_sheet.sql')

/**
 * The policy in force is the LAST one a migration defines, not the first.
 * Reading a single migration file would have passed while production still ran
 * the permissive original, so the effective definition is derived from the
 * whole chain in filename order.
 */
function effectivePolicy(name) {
  const dir = join(root, 'supabase', 'migrations')
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  let found = null
  for (const f of files) {
    const body = strip(`supabase/migrations/${f}`)
    const re = new RegExp(`create\\s+policy\\s+"?${name}"?[\\s\\S]{0,700}?;`, 'gi')
    let m
    while ((m = re.exec(body))) found = { file: f, text: m[0] }
  }
  return found
}

/**
 * An expense posted by an approved Daily Sheet is not an ordinary Finance bill.
 * `review_daily_sheet` copies it into `expenses` with `daily_sheet_line_id`
 * set, and the sheet's stored totals are computed from exactly those rows.
 * Deleting one afterwards leaves an `approved` sheet whose figures no longer
 * exist in the books — the one divergence the approval ladder prevents.
 */
describe('an expense posted by an approved Daily Sheet cannot be undone behind its back', () => {
  it('the UI refuses and says why', () => {
    // Assert the guard's own shape, not just the presence of the column name:
    // `daily_sheet_line_id` also appears in the query scope below, so a bare
    // /daily_sheet_line_id/ assertion passes even when the guard is gone.
    assert.match(
      tab,
      /if \(row\.daily_sheet_line_id\)\s*\{[\s\S]{0,300}?toast\.error\([\s\S]{0,200}?return\s*\n/,
      'the UI must short-circuit on a sheet-posted expense, with a toast and an early return',
    )
    assert.match(tab, /approved daily sheet|approved sheet/i)
  })

  it('scopes the delete in the query, because a JS-only guard is not a control', () => {
    assert.match(
      tab,
      /\.from\('expenses'\)[\s\S]{0,200}?\.delete\(\)[\s\S]{0,200}?\.eq\('id',\s*row\.id\)[\s\S]{0,120}?\.is\('daily_sheet_line_id',\s*null\)/,
    )
  })

  it('writes an audit row, so a money deletion is never silent', () => {
    assert.match(tab, /writeAudit/)
    assert.match(tab, /finance\.expense\.delete/)
  })

  it('the database refuses too — the effective DELETE policy excludes sheet-posted rows', () => {
    const p = effectivePolicy('expenses_delete')
    assert.ok(p, 'no migration defines an expenses_delete policy')
    assert.match(
      p.text,
      /daily_sheet_line_id is null/i,
      `the DELETE policy in force (${p.file}) still permits deleting a row an approved sheet depends on`,
    )
  })

  it('the effective UPDATE policy excludes sheet-posted rows as well', () => {
    const p = effectivePolicy('expenses_update')
    assert.ok(p, 'no migration defines an expenses_update policy')
    assert.match(
      p.text,
      /daily_sheet_line_id is null/i,
      `the UPDATE policy in force (${p.file}) still permits editing a row an approved sheet depends on`,
    )
  })

  it('the DELETE policy no longer grants is_admin()', () => {
    // BUG-054 made the route the control. A permissive policy leaves the UI as
    // the only thing between a Branch Admin and the books, and a direct
    // PostgREST call skips the UI entirely.
    assert.equal(allowRoute({ role: 'admin' }, 'finance'), false, 'premise: BA cannot reach the Books')
    const p = effectivePolicy('expenses_delete')
    assert.ok(
      !/is_admin\(\)/.test(p.text),
      `the DELETE policy in force (${p.file}) still grants is_admin()`,
    )
  })

  it('a Branch Admin keeps READ on its branch expenses, which POS needs', () => {
    const p = effectivePolicy('expenses_select')
    assert.ok(p, 'no migration defines an expenses_select policy')
    assert.match(p.text, /user_has_branch_access\(branch\)/)
  })

  it('the sanctioned path — Super Admin reopening the sheet — is still there', () => {
    assert.match(
      sheet,
      /create or replace function public\.reopen_daily_sheet[\s\S]*?current_user_role\(\) is distinct from 'BossMich'/,
    )
    assert.match(
      sheet,
      /delete from public\.expenses[\s\S]{0,200}?daily_sheet_line_id in \(select id from public\.daily_sheet_lines where sheet_id = s\.id\)/,
    )
  })
})