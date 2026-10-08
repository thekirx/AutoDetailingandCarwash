/**
 * Seam: documentation cutover (Slice D).
 *
 * The Daily Sheet cutover retired End of Shift, Payroll and My Pay on
 * 2026-10-01, and `/operations/console` was removed from the router — but the
 * documentation still taught all of it. `docs/POS/05-PAYROLL-CONNECTION.md`
 * had no retirement banner and presented the revoked `run_payroll` as the money
 * path, while `docs/guides/pages/console.md` documented a route that no longer
 * exists. A reader following those files would build against dead endpoints.
 *
 * This asserts the *contract* rather than grepping for words: the current
 * instruction docs must not teach a retired feature, and any file that does
 * mention it must say so in a banner. Archived/audit material is allowed to
 * keep old behaviour — that is what makes it an archive.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { canAccessQueuePage, ROLES } from '../src/auth/permissions.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

/** Docs that instruct a reader how the product works today. */
const CURRENT_GUIDES = [
  'docs/guides/pages/console.md',
  'docs/guides/pages/settings.md',
  'docs/guides/pages/queue.md',
  'docs/guides/pages/finance-reports.md',
  'docs/guides/pages/payroll.md',
  'docs/guides/pages/my-pay.md',
  'docs/guides/roles/super-admin-asa.md',
  'docs/guides/roles/branch-admin.md',
]

const CURRENT_STORIES = [
  'docs/user-stories/roles-matrix.md',
  'docs/user-stories/epic-role-leadership.md',
  'docs/user-stories/epic-ops-lab-console.md',
  'docs/user-stories/epic-role-video-editor.md',
  'docs/user-stories/epic-finance.md',
]

/** A retirement banner is one of these, near the top of the file. */
const BANNER = /retired|superseded|no longer|historical|archiv|removed/i

const RETIRED = [
  { label: 'Payroll', pattern: /payroll/i },
  { label: 'My Pay', pattern: /my pay/i },
  { label: 'End of Shift', pattern: /end[- ]of[- ]shift|\bEoS\b/i },
  { label: 'the console route', pattern: /\/operations\/console/i },
  { label: 'shift close review', pattern: /shift close/i },
]

// ── 1. No current-instruction doc teaches a retired feature without saying so ──

test('every current guide exists', () => {
  for (const f of [...CURRENT_GUIDES, ...CURRENT_STORIES]) {
    assert.ok(existsSync(join(root, f)), `${f} is listed as current but does not exist`)
  }
})

test('a guide that mentions a retired feature carries a retirement banner', () => {
  const offenders = []
  for (const f of CURRENT_GUIDES) {
    const src = read(f)
    const head = src.split('\n').slice(0, 12).join('\n')
    for (const item of RETIRED) {
      if (!item.pattern.test(src)) continue
      // A page whose whole subject IS the retired feature is fine as long as it
      // says so up front.
      if (BANNER.test(head)) break
      offenders.push(`${f} mentions ${item.label} with no banner in the first 12 lines`)
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n'))
})

test('no current guide routes readers to a dead npm script', () => {
  const scripts = Object.keys(JSON.parse(read('package.json')).scripts)
  const offenders = []
  for (const f of [...CURRENT_GUIDES, ...CURRENT_STORIES]) {
    const src = read(f)
    for (const m of src.matchAll(/npm run ([\w:-]+)/g)) {
      if (!scripts.includes(m[1])) offenders.push(`${f} tells the reader to run "npm run ${m[1]}", which no longer exists`)
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n'))
})

test('no current guide routes readers to the removed console route', () => {
  const offenders = []
  for (const f of [...CURRENT_GUIDES, ...CURRENT_STORIES]) {
    const head = read(f).split('\n').slice(0, 20).join('\n')
    if (/\/operations\/console/i.test(head) && !BANNER.test(head)) {
      offenders.push(f)
    }
  }
  assert.deepEqual(offenders, [], `these still present /operations/console as a current route: ${offenders.join(', ')}`)
})

// ── 2. The claims that are actively wrong right now ──────────────────────

test('the queue guide matches who can actually open the Queue', () => {
  const src = read('docs/guides/pages/queue.md')
  // permissions.js: canAccessQueuePage = canEditQueueOperations = SA / ASA /
  // Team Lead / Operations Lead. Branch Admin is denied (BUG-043, 2026-10-04).
  assert.equal(canAccessQueuePage({ role: ROLES.ADMIN, branch_slug: 'bacoor' }), false)
  assert.equal(canAccessQueuePage({ role: ROLES.TEAM_LEAD, branch_slug: 'bacoor' }), true)
  assert.equal(canAccessQueuePage({ role: ROLES.SUPER_ADMIN }), true)
  assert.equal(canAccessQueuePage({ role: ROLES.OPERATIONS_LEAD }), true)

  const rolesLine = (src.split('\n').find((l) => /^\s*\*\*Roles:\*\*/.test(l)) || '').toLowerCase()
  assert.ok(rolesLine, 'the queue guide must state who can open it')
  // Branch Admin must not be listed as a Queue role without an explicit denial.
  if (/\bba\b|branch admin/.test(rolesLine)) {
    assert.match(
      rolesLine,
      /denied|not |no\b/,
      'if Branch Admin is mentioned in the queue guide roles, it must be as a denial',
    )
  }
})

test('the payroll POS guide is marked retired', () => {
  // This file taught `run_payroll` as the live money path and pointed at a
  // deleted script. It is the highest-severity doc in the cutover.
  const src = read('docs/POS/05-PAYROLL-CONNECTION.md')
  const head = src.split('\n').slice(0, 12).join('\n')
  assert.match(head, BANNER, 'docs/POS/05-PAYROLL-CONNECTION.md must open with a retirement banner')
  assert.doesNotMatch(
    head,
    /Live seam/i,
    'it must not still advertise a retired script as a live seam',
  )
})

test('the owner daily SMS is not presented as a required setting', () => {
  // Product decision: outbound customer reminders only; Finance acceptance goes
  // to web push. OWNER_SMS_PHONE is not a readiness gate.
  const offenders = []
  for (const f of ['docs/OPS/NEW-REVISIONS-CHECKLIST.md', 'docs/qa/RESULTS.md', 'CONTEXT.md']) {
    const head = read(f).split('\n').slice(0, 20).join('\n')
    if (/OWNER_SMS_PHONE|owner daily SMS|owner SMS/i.test(head) && !BANNER.test(head)) {
      offenders.push(f)
    }
  }
  assert.deepEqual(offenders, [], `these still present the owner daily SMS as current: ${offenders.join(', ')}`)
})

test('the maintained money docs are left intact', () => {
  // Guard against over-editing: the canonical guides already say the right
  // thing and must keep saying it.
  const money = read('docs/OPS/MONEY-CONTRACT.md')
  assert.match(money, /No owner SMS/i)
  const sheet = read('docs/daily-sheet/README.md')
  assert.match(sheet, /retire/i)
  const runbook = read('docs/qa/SHOP-DAY-RUNBOOK.md')
  assert.match(runbook, /No owner daily SMS/i)
})

test('archived audit material is left alone', () => {
  // These SHOULD keep the old behaviour; that is what makes them an archive.
  // Listed so a future pass cannot "helpfully" rewrite history.
  for (const f of ['docs/audits/2026-09-money-path/PAYROLL-DEEP-AUDIT.md', 'CHANGELOG.md']) {
    assert.ok(existsSync(join(root, f)), `${f} is the archive record and must exist`)
  }
  assert.match(read('CHANGELOG.md'), /Daily Sheet replaces End of shift, Payroll and My pay/i)
})