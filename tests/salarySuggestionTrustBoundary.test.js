import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { salaryLineNeedsReason, canEditDailySheet } from '../src/lib/dailySheet.js'

/**
 * BUG-087 — the "changed salaries need a reason" rule is enforced against a
 * baseline the caller chose.
 *
 * submit_daily_sheet refuses a sheet containing a salary line where
 *
 *   amount_minor is distinct from suggested_minor and reason is null
 *
 * which is a real control through the UI: suggestSalaries() computes
 * suggested_minor from attendance and the wash pool, the sheet prints
 * "Suggested ₱X · reason" whenever the two differ, and the reason reaches
 * the audit trail.
 *
 * But both operands are columns the CALLER wrote. save_daily_sheet takes
 * suggested_minor straight from the payload --
 *
 *   case when v_kind = 'salary' then greatest(coalesce((v_line->>'suggested_minor')::integer, 0), 0) end
 *
 * -- and no SQL anywhere recomputes the suggestion, because the whole
 * calculation lives in JavaScript. So a direct rpc('save_daily_sheet') call
 * with amount_minor equal to suggested_minor never trips the rule, whatever
 * the number is, and review_daily_sheet then posts it to expenses as 'paid'.
 *
 * daily_sheet_can_edit admits a Branch Admin -- the role that is deliberately
 * denied approval. So the party who may not approve the sheet can still choose
 * what is in it. Same shape as BUG-024 (complete_pos_sale trusted a client
 * unit_price_minor) and as BUG-071: page and client validation are not a
 * boundary against PostgREST.
 *
 * This file is a TRIPWIRE, not a fix. It asserts the current trust boundary so
 * the gap is visible in the suite rather than only in a docs row, and it is
 * written to FAIL the day someone recomputes the suggestion server-side --
 * at which point the control becomes real and this file should be replaced by
 * an assertion that it is enforced against server data.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function body(name, file) {
  const raw = readFileSync(join(root, file), 'utf8')
  const sql = raw.split(/\r?\n/).filter((l) => !l.trimStart().startsWith('--')).join('\n')
  const start = sql.indexOf(`create or replace function public.${name}`)
  assert.notEqual(start, -1, `${name} not found in ${file}`)
  const end = sql.indexOf('\n$$;', start)
  assert.notEqual(end, -1, `${name} body end not found in ${file}`)
  return sql.slice(start, end)
}

const DAILY_SHEET = 'supabase/migrations/20261001090000_daily_sheet.sql'
const save = body('save_daily_sheet', DAILY_SHEET)
const submit = body('submit_daily_sheet', DAILY_SHEET)

describe('the salary suggestion is the engine’s number, not the caller’s', () => {
  it('the client computes it from attendance and the wash pool', () => {
    const js = readFileSync(join(root, 'src/lib/dailySheet.js'), 'utf8')
    assert.match(js, /suggested_minor: daily \+ p\.wash_minor \+ p\.detailing_minor/)
    assert.match(js, /suggested_minor: l\.kind === 'salary' \? amount\(l\.suggested_minor\) : null/)
  })

  it('a changed salary really does need a reason, through the client', () => {
    assert.equal(salaryLineNeedsReason({ kind: 'salary', amount_minor: 1000, suggested_minor: 1000 }), false)
    assert.equal(salaryLineNeedsReason({ kind: 'salary', amount_minor: 2000, suggested_minor: 1000 }), true)
    assert.equal(salaryLineNeedsReason({ kind: 'salary', amount_minor: 2000, suggested_minor: 1000, reason: 'extra hours' }), false)
    assert.equal(salaryLineNeedsReason({ kind: 'expense', amount_minor: 2000, suggested_minor: null }), false)
  })

  it('and the server applies the same rule to what it stored', () => {
    assert.match(
      submit,
      /kind = 'salary' and \(staff_id is null or \(amount_minor is distinct from suggested_minor and reason is null\)\)/,
    )
  })
})

describe('BUG-087 tripwire: the baseline is the caller’s, and nobody has fixed it yet', () => {
  it('save_daily_sheet takes suggested_minor from the payload', () => {
    assert.match(
      save,
      /case when v_kind = 'salary' then greatest\(coalesce\(\(v_line->>'suggested_minor'\)::integer, 0\), 0\) end/,
      'no longer client-supplied — update this tripwire, the control may now be real',
    )
  })

  it('no SQL recomputes the suggestion from attendance or compensation settings', () => {
    // If this ever finds a server-side recomputation, the bug is fixed and the
    // two assertions above need to become "the server compares against ITS OWN
    // number" rather than "the server stores the caller's number".
    const sql = readFileSync(join(root, DAILY_SHEET), 'utf8')
    assert.doesNotMatch(
      sql,
      /compensation_settings[\s\S]{0,200}wash_pool/,
      'the sheet totals function now reads compensation settings — the gap may be closed',
    )
    assert.doesNotMatch(sql, /attendance_records[\s\S]{0,160}suggested/i)
  })

  it('a Branch Admin can write the sheet even though they may not approve it', () => {
    // The control only matters if someone can reach it who is not the owner.
    assert.equal(canEditDailySheet({ role: 'admin' }), true, 'the BA files the sheet')
  })

  it('the amount posted to the books is the stored amount, unchanged', () => {
    // review_daily_sheet copies l.amount_minor straight into expenses. There is
    // no re-derivation at approval time either, so the gap is not closed later.
    const review = body('review_daily_sheet', DAILY_SHEET)
    assert.match(review, /l\.amount_minor > 0/)
    assert.match(review, /1, l\.amount_minor, l\.amount_minor, s\.branch/)
    assert.doesNotMatch(review, /suggested_minor/, 'approval does not re-check the suggestion')
  })
})

/**
 * Why the expense lines are NOT the same defect.
 *
 * submit_daily_sheet also requires expense lines to carry a caller-chosen
 * account_id and amount_minor, and review_daily_sheet posts those unchanged.
 * On its face that looks identical to the salary gap. It is not, and the
 * difference is the whole point:
 *
 *   salary  — a CANONICAL value exists (suggestSalaries computes it), so
 *             comparing the caller's amount against a copy the caller also
 *             supplied is a control that can be switched off. That is BUG-087.
 *   expense — no canonical value exists. Which bucket a spend belongs to, and
 *             what was actually handed over, are human judgements. There is
 *             nothing for the server to check them against.
 *
 * So the Daily Sheet is a TRUSTED document. Its controls are structural --
 * completeness, branch scope, and the approval step (BUG-085) -- and approval
 * is the financial control. These assertions exist so that distinction is
 * recorded rather than re-derived next time someone spots the pattern.
 */
describe('the salary gap is a defect because a canonical value exists; expenses are not', () => {
  it('salary lines are validated against a suggested figure', () => {
    assert.match(submit, /amount_minor is distinct from suggested_minor/)
  })

  it('expense lines are validated for presence, not against any figure', () => {
    // description + account + a positive amount. No comparison, because there
    // is nothing canonical to compare to.
    assert.match(
      submit,
      /kind = 'expense' and \(description is null or account_id is null or amount_minor <= 0\)/,
    )
    assert.doesNotMatch(
      submit,
      /kind = 'expense'[^\n]*suggested_minor/,
      'an expense compared against a suggestion would need a canonical value to exist',
    )
  })

  it('suggested_minor is only ever stored on salary lines', () => {
    // The insert is `case when v_kind = 'salary' then ... end`, so every other
    // kind lands as NULL. If that changed, non-salary lines would start
    // carrying a figure nothing validates.
    assert.match(
      save,
      /case when v_kind = 'salary' then greatest\(coalesce\(\(v_line->>'suggested_minor'\)::integer, 0\), 0\) end/,
    )
  })

  it('the account_id an expense chooses is real, or the FK refuses the row', () => {
    // expenses.category_id references expense_categories(id), so a fabricated
    // account id fails at the database rather than posting an uncategorised
    // expense. That is the one financial field the caller cannot invent.
    const schema = readFileSync(
      join(root, 'supabase/migrations/20260720130000_phase1_to_4_platform_schema.sql'),
      'utf8',
    )
    assert.match(schema, /category_id uuid references public\.expense_categories \(id\)/)
  })
})