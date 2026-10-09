import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { canEditDailySheet, canReviewDailySheet } from '../src/lib/dailySheet.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SQL_FILE = 'supabase/migrations/20261001090000_daily_sheet.sql'
const raw = readFileSync(join(root, SQL_FILE), 'utf8')
// Strip comments: prose about a rule names the rule it replaced, and a
// commented-out guard is not a guard.
const sql = raw.split(/\r?\n/).filter((l) => !l.trimStart().startsWith('--')).join('\n')

function fnBody(name) {
  const start = sql.indexOf(`create or replace function public.${name}`)
  assert.notEqual(start, -1, `${name} not found in ${SQL_FILE}`)
  const end = sql.indexOf('\n$$;', start)
  assert.notEqual(end, -1, `${name} body end not found`)
  return sql.slice(start, end)
}

const save = fnBody('save_daily_sheet')
const submit = fnBody('submit_daily_sheet')
const review = fnBody('review_daily_sheet')
const reopen = fnBody('reopen_daily_sheet')
const canEdit = fnBody('daily_sheet_can_edit')
const canReview = fnBody('daily_sheet_can_review')

describe('daily sheet approval ladder cannot be short-circuited', () => {
  it('refuses to edit a sheet that is submitted or approved', () => {
    // Without this, a Branch Admin could change expense amounts after approval.
    // The expenses rows are copied at approve time and are NOT updated by an
    // edit, so the sheet and the books would silently diverge.
    assert.match(save, /if\s+v_status\s+in\s*\(\s*'submitted'\s*,\s*'approved'\s*\)\s*then\s*\n\s*raise exception/)
  })

  it('only submits a draft or returned sheet', () => {
    assert.match(submit, /s\.status\s+not\s+in\s*\(\s*'draft'\s*,\s*'returned'\s*\)/)
  })

  it('only reviews a submitted sheet', () => {
    assert.match(review, /if\s+s\.status\s*<>\s*'submitted'\s*then\s+raise exception 'Only submitted sheets can be reviewed'/)
  })

  it('server totals win over anything the client sent', () => {
    // `totals = coalesce(s.totals,'{}'::jsonb) || v_totals` — the right-hand
    // side is the server computation, so a client-supplied total cannot survive.
    assert.match(submit, /totals\s*=\s*coalesce\(s\.totals,\s*'\{\}'::jsonb\)\s*\|\|\s*v_totals/)
  })

  it('approving twice does not post the expenses twice', () => {
    assert.match(review, /on conflict \(daily_sheet_line_id\)[\s\S]{0,60}do nothing/)
    // And the already-approved short-circuit returns posted 0 before any insert.
    assert.match(
      review,
      /if\s+s\.status\s*=\s*'approved'\s+and\s+v_action\s*=\s*'approve'\s*then\s*\n\s*return jsonb_build_object\('id',\s*s\.id,\s*'status',\s*'approved',\s*'posted',\s*0\)/,
    )
  })

  it('reopening an approved sheet is Super Admin only and voids the posted rows', () => {
    assert.match(reopen, /current_user_role\(\)\s+is\s+distinct\s+from\s+'BossMich'/)
    assert.match(reopen, /delete\s+from\s+public\.expenses\s*\n\s*where\s+daily_sheet_line_id\s+in\s*\(select\s+id\s+from\s+public\.daily_sheet_lines\s+where\s+sheet_id\s*=\s*s\.id\)/)
  })

  it('Branch Admin may submit but may never approve', () => {
    assert.equal(canEditDailySheet({ role: 'admin' }), true, 'BA files the sheet')
    assert.equal(canReviewDailySheet({ role: 'admin' }), false, 'BA must not approve their own sheet')
  })

  it('the client predicates still mirror the SQL they claim to mirror', () => {
    // A divergence here is BUG-052 repeating: the client shows a button the DB refuses.
    assert.match(canEdit, /current_user_role\(\)\s*=\s*'BossMich'/)
    assert.match(canEdit, /current_user_role\(\)\s*=\s*'admin'/)
    assert.match(canEdit, /asa_has_grant\('pos'\)\s+or\s+public\.asa_has_grant\('finance_write'\)/)
    assert.match(canReview, /current_user_role\(\)\s*=\s*'BossMich'/)
    assert.match(canReview, /assistant_super_admin'\s+and\s+public\.asa_has_grant\('finance_view'\)/)

    for (const role of ['team_lead', 'staff', 'sales', 'detailer', 'marketing', 'video_editor', 'investor', 'operations_lead']) {
      assert.equal(canEditDailySheet({ role }), false, `${role} must not edit a daily sheet`)
      assert.equal(canReviewDailySheet({ role }), false, `${role} must not review a daily sheet`)
    }
  })
})