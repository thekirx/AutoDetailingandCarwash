import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { canApproveSheet, canEditDailySheet, canReviewDailySheet } from '../src/lib/dailySheet.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SQL_FILE = 'supabase/migrations/20261001090000_daily_sheet.sql'
const SOD_FILE = 'supabase/migrations/20261010160000_daily_sheet_separation_of_duties.sql'

// Strip comments: prose about a rule names the rule it replaced, and a
// commented-out guard is not a guard.
function uncomment(raw) {
  return raw.split(/\r?\n/).filter((l) => !l.trimStart().startsWith('--')).join('\n')
}

const raw = readFileSync(join(root, SQL_FILE), 'utf8')
const sql = uncomment(raw)

let sodRaw = ''
let sodSql = ''
try {
  sodRaw = readFileSync(join(root, SOD_FILE), 'utf8')
  sodSql = uncomment(sodRaw)
} catch {
  sodRaw = ''
}

function fnBody(name, source = sql, file = SQL_FILE) {
  const start = source.indexOf(`create or replace function public.${name}`)
  assert.notEqual(start, -1, `${name} not found in ${file}`)
  const end = source.indexOf('\n$$;', start)
  assert.notEqual(end, -1, `${name} body end not found`)
  return source.slice(start, end)
}

// The self-approval guard is the only `if` in the migration that raises the
// "cannot approve a sheet you submitted yourself" error. Pulling exactly that
// block out of the body lets the assertions below talk about the guard itself
// instead of grepping a 40-line function for a word that occurs elsewhere.
function selfApprovalGuard() {
  assert.notEqual(sodSql, '', `${SOD_FILE} is missing — no separation-of-duties guard exists`)
  const review = fnBody('review_daily_sheet', sodSql, SOD_FILE)
  const at = review.indexOf('you submitted yourself')
  assert.notEqual(at, -1, `review_daily_sheet in ${SOD_FILE} has no self-approval guard`)
  const start = review.lastIndexOf('if ', at)
  const end = review.indexOf('end if;', at)
  assert.notEqual(start, -1, 'guard has no opening if')
  assert.notEqual(end, -1, 'guard has no closing end if')
  return review.slice(start, end + 'end if;'.length)
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

// Every assertion above separates ROLES. None of them separates PEOPLE. An ASA
// satisfies both predicates at once by default: DEFAULT_ASSISTANT_GRANTS ships
// `pos: true` and `finance_view: true` (src/auth/permissions.js:26-29), and
// asa_has_grant() only denies finance_write/planning_edit/rbac_edit when the
// key is absent — so a default ASA could save a sheet, submit it, and approve it,
// producing expense rows whose created_by and approved_by are the same UUID.
describe('BUG-085: a daily sheet cannot be approved by the person who submitted it', () => {
  it('the guarded migration replaces review_daily_sheet', () => {
    assert.notEqual(sodSql, '', `${SOD_FILE} is missing`)
    assert.match(sodSql, /create or replace function public\.review_daily_sheet/)
  })

  it('refuses to approve when the caller is the submitter', () => {
    const guard = selfApprovalGuard()
    assert.match(guard, /s\.submitted_by\s*=\s*caller/, 'the guard must compare the server submitter to the caller')
    assert.match(guard, /raise\s+exception/, 'the guard must actually raise')
  })

  it('scopes the guard to approve — returning your own sheet is rework, not a control', () => {
    // Returning a sheet you filed is how a Branch Admin corrects it. Blocking
    // that would strand a rejected sheet with no path back, so the guard has to
    // be provably narrow rather than merely "present".
    const guard = selfApprovalGuard()
    assert.match(guard, /v_action\s*=\s*'approve'/)
    assert.doesNotMatch(guard, /'return'/, 'returning must stay open or a returned sheet cannot be resubmitted')
  })

  it('exempts the Super Admin, who is the only reviewer in a one-owner shop', () => {
    // Not a concession. If BossMich were also blocked, a sheet the owner filed
    // would sit at 'submitted' forever: reopen_daily_sheet only accepts
    // 'approved' sheets, so there would be no recovery path at all.
    const guard = selfApprovalGuard()
    assert.match(guard, /current_user_role\(\)\s+is\s+distinct\s+from\s+'BossMich'/)
  })

  it('raises an authorization code so the client can tell refusal from a crash', () => {
    assert.match(selfApprovalGuard(), /errcode\s*=\s*'42501'/)
  })

  it('reads submitted_by from the locked server row, never from the client payload', () => {
    // A guard that reads payload->>'submitted_by' would be decided by the
    // caller. This assertion is what makes the previous one meaningful.
    const review = fnBody('review_daily_sheet', sodSql, SOD_FILE)
    assert.doesNotMatch(review, /payload->>'submitted_by'/, 'the submitter must come from the row, not the request')
  })

  it('runs after the row is locked and before any expense is posted', () => {
    // Ordering, not presence: a guard parked after the insert still leaves every
    // token in the file while the approval it is meant to prevent already ran.
    const review = fnBody('review_daily_sheet', sodSql, SOD_FILE)
    const locked = review.indexOf('for update')
    const guardAt = review.indexOf('you submitted yourself')
    const posted = review.indexOf('insert into public.expenses')
    assert.notEqual(locked, -1, 'review no longer locks the sheet row')
    assert.ok(locked < guardAt, 'the guard must read the submitter from a locked row')
    assert.notEqual(posted, -1, 'review no longer posts expenses')
    assert.ok(guardAt < posted, 'the guard must run before expenses are posted')
  })

  it('the replacement keeps every guard the original had', () => {
    // create or replace silently drops whatever the new text omits. Copying the
    // function without one check would trade a segregation gap for a lost status
    // check or a double-posting bug, and the ladder suite above would not notice.
    const guarded = fnBody('review_daily_sheet', sodSql, SOD_FILE)
    for (const [label, re] of [
      ['auth required', /if\s+caller\s+is\s+null/],
      ['reviewer predicate', /if\s+not\s+public\.daily_sheet_can_review\(\)/],
      ['action whitelist', /v_action\s+not\s+in\s*\(\s*'approve'\s*,\s*'return'\s*\)/],
      ['return needs a note', /v_action\s*=\s*'return'\s+and\s+\(v_note\s+is\s+null\s+or\s+char_length\(v_note\)\s*<\s*3\)/],
      ['sheet must exist', /if\s+s\.id\s+is\s+null\s+then\s+raise\s+exception\s+'Daily sheet not found'/],
      ['submitted-only short circuit', /if\s+s\.status\s*=\s*'approved'\s+and\s+v_action\s*=\s*'approve'\s*then/],
      ['status must be submitted', /if\s+s\.status\s*<>\s*'submitted'\s+then\s+raise\s+exception\s+'Only submitted sheets can be reviewed'/],
      ['no double post', /on conflict \(daily_sheet_line_id\)[\s\S]{0,60}do nothing/],
      ['audit log written', /insert into\s+public\.audit_logs/],
    ]) {
      assert.match(guarded, re, `the replacement dropped the "${label}" guard`)
    }
  })

  it('the refusal reaches the reviewer instead of a misleading migration prompt', () => {
    // src/lib/dailySheetApi.js rewrites any message matching /daily_sheet/ into
    // "needs its database update (migration 20261001090000)". The guard's text
    // says "daily sheet" with a SPACE, so it passes through unchanged — but a
    // future edit that loosened the pattern to the spaced form would silently
    // tell the owner to re-apply a migration that is already live, which is the
    // least useful possible answer to "why was my approval refused".
    //
    // Asserted at the source rather than by calling it: dailySheetApi.js imports
    // through the '@/' Vite alias and cannot be loaded by the node test runner.
    const api = uncomment(readFileSync(join(root, 'src/lib/dailySheetApi.js'), 'utf8'))
    const start = api.indexOf('export function sheetErrorMessage')
    assert.notEqual(start, -1, 'sheetErrorMessage not found in src/lib/dailySheetApi.js')
    const body = api.slice(start, api.indexOf('\n}', start))
    const trigger = body.match(/if \(\/([\s\S]*?)\/i\.test\(msg\)\)/)
    assert.ok(trigger, 'sheetErrorMessage no longer gates its rewrite on a named pattern')
    assert.match(trigger[1], /daily_sheet/, 'the rewrite trigger must keep the underscored table name')
    assert.doesNotMatch(trigger[1], /daily sheet/i, 'a spaced "daily sheet" would swallow the self-approval refusal')
    assert.match(body, /return msg \|\|/, 'the refusal must fall through to the server message verbatim')
  })
})

// The DB guard above makes the existing Approve button a dead control for the one
// person it most obviously tempts — the ASA who filed the sheet. Shipping the
// guard without mirroring it would trade a false-green approval for a button that
// always fails, which is the same class of client/DB divergence as BUG-052.
describe('BUG-085: the client does not offer an approval the server will refuse', () => {
  const asa = { role: 'assistant_super_admin', permission_grants: { finance_view: true, pos: true } }
  const boss = { role: 'BossMich' }
  const ba = { role: 'admin' }
  const me = '00000000-0000-0000-0000-00000000000a'
  const other = '00000000-0000-0000-0000-00000000000b'

  it('an ASA cannot approve a sheet they submitted', () => {
    assert.equal(canReviewDailySheet(asa), true, 'the role gate itself still admits them')
    assert.equal(canApproveSheet(asa, { submitted_by: me }, me), false)
  })

  it('the same ASA can approve everyone else\'s sheet', () => {
    assert.equal(canApproveSheet(asa, { submitted_by: other }, me), true)
  })

  it('the Super Admin keeps self-approval, exactly as the SQL exempts them', () => {
    assert.equal(canApproveSheet(boss, { submitted_by: me }, me), true)
  })

  it('a Branch Admin cannot approve at all, submitted or not', () => {
    // Over-correcting here would show a reviewer-only button to the person who
    // is meant to file the sheet, which is the BUG-052 mirror in reverse.
    assert.equal(canApproveSheet(ba, { submitted_by: other }, me), false)
  })

  it('a sheet with no recorded submitter is left alone', () => {
    // The SQL guard requires `submitted_by is not null`, so the client must not
    // be stricter than the server or it blocks a submission the server permits.
    assert.equal(canApproveSheet(asa, { submitted_by: null }, me), true)
    assert.equal(canApproveSheet(asa, {}, me), true)
  })

  it('does not treat an unresolved identity as a match', () => {
    // No current user resolved => we cannot claim it is this person's sheet.
    // Blocking here would hide Approve from everyone whenever identity is slow.
    assert.equal(canApproveSheet(asa, { submitted_by: me }, undefined), true)
  })

  it('the panel actually calls it — a predicate nobody wires is not a control', () => {
    // canApproveSheet passing its own unit tests proves nothing if the button
    // still renders unconditionally. Source-level because the panel is JSX and
    // cannot be rendered by the node test runner.
    const panel = readFileSync(join(root, 'src/pages/pos/DailySheetPanel.jsx'), 'utf8')
    assert.match(panel, /canApproveSheet\(profile,\s*sheet,\s*user\?\.id\)/, 'Approve is not gated on the client predicate')
    assert.match(panel, /import \{ useAuth \} from '@\/auth\/AuthProvider'/, 'the current user is never resolved')
    // Returning must survive: it is offered in the same block as Approve.
    const block = panel.slice(panel.indexOf('status === \'submitted\' && canReviewDailySheet(profile)'))
    assert.match(block, /decide\('return'\)/, 'returning your own sheet must stay reachable')
  })
})