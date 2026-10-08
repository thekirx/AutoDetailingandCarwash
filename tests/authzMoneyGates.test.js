/**
 * Slice I — authorization and money-path gates.
 *
 * BUG-052: the client and the database disagreed about an Assistant Super Admin
 * whose permission_grants were missing a key. src/lib/dailySheet.js used a local
 * `grantOr` helper that treated ANY absent key as granted, while
 * public.asa_has_grant() denies the denied-by-default keys (finance_write,
 * planning_edit, rbac_edit) when they are absent. An ASA with
 * `{ pos: false }` therefore saw the Daily Sheet editor and the finance quote
 * path, but the server refused both. This is the same client-says-yes /
 * server-says-no class as BUG-049, on the money path.
 *
 * These are pure predicates, so the assertions are on their return values for
 * real role x grant combinations — not on strings in the source.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ROLES,
  DEFAULT_ASSISTANT_GRANTS,
  ASSISTANT_GRANT_KEYS,
  resolveAssistantGrants,
  normalizeAssistantGrants,
  isSuperAdmin,
  isAssistantSuperAdmin,
  isOperationsLead,
  canUseOperations,
  canOpenFinanceHub,
  canAccessFinance,
  canAccessReports,
  canSeeForPaymentLane,
  canSeeAllKpiBranches,
  canAccessAudit,
  canAccessDataCenter,
  canAccessInquiries,
  canAccessMarketing,
  canAccessMemberships,
  canAddQueueService,
  canManageOpsFormTemplates,
  canAccessQueuePage,
} from '../src/auth/permissions.js'

import {
  canEditDailySheet,
  canReviewDailySheet,
} from '../src/lib/dailySheet.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const ALL_ROLES = Object.values(ROLES)
const asa = (grants) => ({ role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: grants })
const profile = (role, extra = {}) => ({ role, ...extra })

// ── BUG-052: grant parity between the client and the database ─────────────

test('the denied-by-default grant list matches the database rule', () => {
  // Read the actual SQL rather than restating it: if someone adds a key to the
  // denied list in the migration without updating the client defaults, the two
  // drift again and this fails.
  const sql = readFileSync(
    join(root, 'supabase', 'migrations', '20260730120000_asa_grant_queue_all_enforcement.sql'),
    'utf8',
  )
  const m = /when grant_key in \(([^)]*)\) then false/.exec(sql)
  assert.ok(m, 'the asa_has_grant denied-by-default list must be findable in SQL')
  const deniedInSql = [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort()

  const deniedInClient = ASSISTANT_GRANT_KEYS.filter((k) => DEFAULT_ASSISTANT_GRANTS[k] === false).sort()
  assert.deepEqual(
    deniedInClient,
    deniedInSql,
    'a key that SQL denies when absent must default to false in the client too',
  )
})

test('an absent finance_write grant is denied, not assumed', () => {
  // The exact BUG-052 case: `pos: false` and no finance_write key at all.
  const p = asa({ pos: false })
  assert.equal(normalizeAssistantGrants(p.permission_grants).finance_write, false)
  assert.equal(canEditDailySheet(p), false, 'the Daily Sheet is a money surface — absent must mean denied')
})

test('an absent planedit grant is denied, not assumed', () => {
  const p = asa({ pos: true })
  assert.equal(normalizeAssistantGrants(p.permission_grants).planning_edit, false)
  assert.equal(canManageOpsFormTemplates(p), false)
})

test('an explicitly granted finance_write is honoured', () => {
  assert.equal(canEditDailySheet(asa({ pos: false, finance_write: true })), true)
  assert.equal(resolveAssistantGrants(asa({ finance_write: true })).finance_write, true)
})

test('an absent ordinary grant is still granted, matching SQL', () => {
  // finance_view is not in the denied list: absent means granted on both sides.
  const p = asa({})
  assert.equal(DEFAULT_ASSISTANT_GRANTS.finance_view, true)
  assert.equal(canReviewDailySheet(p), true)
  assert.equal(canEditDailySheet(p), true, 'pos defaults to granted')
})

test('client gate results agree with the gate they claim to mirror', () => {
  // canEditDailySheet and canReviewDailySheet are documented as mirrors of the
  // SQL functions; assert they actually agree across the ASA grant space.
  for (const pos of [undefined, true, false]) {
    for (const financeWrite of [undefined, true, false]) {
      for (const financeView of [undefined, true, false]) {
        const g = {}
        if (pos !== undefined) g.pos = pos
        if (financeWrite !== undefined) g.finance_write = financeWrite
        if (financeView !== undefined) g.finance_view = financeView
        const p = asa(g)
        const grants = normalizeAssistantGrants(g)

        // daily_sheet_can_review: SA, or ASA with finance_view.
        const sqlReview = p.role === ROLES.SUPER_ADMIN || grants.finance_view
        assert.equal(
          canReviewDailySheet(p),
          Boolean(sqlReview),
          `review mismatch for ${JSON.stringify(g)}`,
        )

        // daily_sheet_can_edit: SA, or ASA with (pos OR finance_write).
        const sqlEdit =
          p.role === ROLES.SUPER_ADMIN || (grants.pos || grants.finance_write)
        assert.equal(
          canEditDailySheet(p),
          Boolean(sqlEdit),
          `edit mismatch for ${JSON.stringify(g)}`,
        )
      }
    }
  }
})

test('the daily sheet gates are closed to every non-ASA, non-admin role', () => {
  for (const role of [ROLES.STAFF, ROLES.DETAILER, ROLES.TEAM_LEAD, ROLES.SALES, ROLES.MARKETING, ROLES.VIDEO_EDITOR, ROLES.INVESTOR, ROLES.OPERATIONS_LEAD]) {
    const p = profile(role)
    assert.equal(canEditDailySheet(p), false, `${role} must not write the Daily Sheet`)
    assert.equal(canReviewDailySheet(p), false, `${role} must not approve the Daily Sheet`)
  }
  // Operations Lead is explicitly NOT a books approver: finance is read-only there.
  assert.equal(canAccessFinance(profile(ROLES.OPERATIONS_LEAD)), true)
  assert.equal(canReviewDailySheet(profile(ROLES.OPERATIONS_LEAD)), false)
})

// ── The Books entry gate ──────────────────────────────────────────────────

test('the Books hub opens for finance or reports, and for nothing else', () => {
  assert.equal(canOpenFinanceHub(profile(ROLES.SUPER_ADMIN)), true)
  assert.equal(canOpenFinanceHub(profile(ROLES.INVESTOR)), true)
  assert.equal(canOpenFinanceHub(profile(ROLES.ADMIN)), true)
  // Both arms are entry points, not a bypass: the hub opens on EITHER grant and
  // the tab the role may actually read is decided by the underlying gate.
  const reportsOnly = asa({ reports: true, finance_view: false })
  assert.equal(canAccessReports(reportsOnly), true)
  assert.equal(canOpenFinanceHub(reportsOnly), true)
  assert.equal(canAccessFinance(reportsOnly), false, '...but a reports-only ASA still cannot read finance')
  const financeOnly = asa({ reports: false, finance_view: true })
  assert.equal(canOpenFinanceHub(financeOnly), true)
  assert.equal(canAccessReports(financeOnly), false)
  assert.equal(canOpenFinanceHub(profile(ROLES.STAFF)), false)
  assert.equal(canOpenFinanceHub(profile(ROLES.OPERATIONS_LEAD)), true)
})

// ── The For Payment lane ─────────────────────────────────────────────────

test('the For Payment lane is console tier plus the operations lead', () => {
  // Documented contract: "Team Lead never sees the For Payment lane; console
  // tier does" — console tier is SA / ASA / Branch Admin.
  for (const role of [ROLES.SUPER_ADMIN, ROLES.ASSISTANT_SUPER_ADMIN, ROLES.ADMIN, ROLES.OPERATIONS_LEAD]) {
    assert.equal(canSeeForPaymentLane(profile(role)), true, `${role} is console tier and must see it`)
  }
  for (const role of [ROLES.STAFF, ROLES.DETAILER, ROLES.TEAM_LEAD, ROLES.SALES, ROLES.MARKETING, ROLES.VIDEO_EDITOR, ROLES.INVESTOR]) {
    assert.equal(canSeeForPaymentLane(profile(role)), false, `${role} must not see pending payments`)
  }
  // A Team Lead is explicitly the excluded case (BUG-049 fixed this lane).
  assert.equal(canSeeForPaymentLane(profile(ROLES.TEAM_LEAD)), false)
  // An ASA reaches the lane by role, not by any grant value.
  assert.equal(canSeeForPaymentLane(asa({ pos: false })), true)
})

// ── Root predicates ──────────────────────────────────────────────────────

test('the three root predicates match only their own role', () => {
  for (const role of ALL_ROLES) {
    const p = profile(role)
    assert.equal(isSuperAdmin(p), role === ROLES.SUPER_ADMIN, `isSuperAdmin(${role})`)
    assert.equal(isAssistantSuperAdmin(p), role === ROLES.ASSISTANT_SUPER_ADMIN, `isAssistantSuperAdmin(${role})`)
    assert.equal(isOperationsLead(p), role === ROLES.OPERATIONS_LEAD, `isOperationsLead(${role})`)
  }
  assert.equal(isSuperAdmin(null), false)
  assert.equal(isOperationsLead(null), false)
  assert.equal(isAssistantSuperAdmin(null), false)
})

test('a staff profile carrying admin grants is still not an admin', () => {
  // The gates must read the role, never a grant value that happens to be present.
  const impostor = { role: ROLES.STAFF, permission_grants: { finance_view: true, pos: true } }
  assert.equal(isSuperAdmin(impostor), false)
  assert.equal(isOperationsLead(impostor), false)
  assert.equal(canSeeForPaymentLane(impostor), false)
  assert.equal(canAccessDataCenter(impostor), false)
})

test('resolveAssistantGrants only answers for an ASA', () => {
  assert.equal(resolveAssistantGrants(profile(ROLES.ADMIN)), null)
  assert.equal(resolveAssistantGrants(profile(ROLES.SUPER_ADMIN)), null)
  assert.ok(resolveAssistantGrants(asa({})))
})

// ── Restricted surfaces ──────────────────────────────────────────────────

test('the data centre is Super Admin only', () => {
  assert.equal(canAccessDataCenter(profile(ROLES.SUPER_ADMIN)), true)
  for (const role of ALL_ROLES.filter((r) => r !== ROLES.SUPER_ADMIN)) {
    assert.equal(canAccessDataCenter(profile(role)), false, `${role} must not open the data centre`)
  }
  assert.equal(canAccessDataCenter(asa({})), false, 'grants must not open the data centre')
})

test('inquiries and memberships need their own grants', () => {
  assert.equal(canAccessInquiries(profile(ROLES.SUPER_ADMIN)), true)
  assert.equal(canAccessInquiries(asa({ inquiries: true })), true)
  assert.equal(canAccessInquiries(asa({ inquiries: false })), false)
  assert.equal(canAccessInquiries(asa({})), true, 'inquiries defaults to granted')
  assert.equal(canAccessInquiries(profile(ROLES.ADMIN)), false)

  assert.equal(canAccessMemberships(profile(ROLES.SUPER_ADMIN)), true)
  assert.equal(canAccessMemberships(asa({ memberships: false })), false)
  assert.equal(canAccessMemberships(profile(ROLES.OPERATIONS_LEAD)), false)
})

test('the audit log is open to admins and ops lead, not to crew', () => {
  assert.equal(canAccessAudit(profile(ROLES.SUPER_ADMIN)), true)
  assert.equal(canAccessAudit(profile(ROLES.ADMIN)), true)
  assert.equal(canAccessAudit(profile(ROLES.OPERATIONS_LEAD)), true)
  assert.equal(canAccessAudit(asa({ audit: false })), false)
  for (const role of [ROLES.STAFF, ROLES.DETAILER, ROLES.TEAM_LEAD, ROLES.SALES, ROLES.MARKETING, ROLES.VIDEO_EDITOR]) {
    assert.equal(canAccessAudit(profile(role)), false, `${role} must not read the audit log`)
  }
})

test('KPI scope uses kpi_all, independent of branches_all', () => {
  // A grants regression here leaks another branch's revenue figures, and the
  // two grants are deliberately separate: a network-wide queue scope must not
  // silently hand over network-wide revenue.
  const kpiOnly = asa({ kpi_all: true, branches_all: false })
  assert.equal(canSeeAllKpiBranches(kpiOnly), true)
  const branchOnly = asa({ kpi_all: false, branches_all: true })
  assert.equal(canSeeAllKpiBranches(branchOnly), false, 'branches_all must not imply KPI scope')
  const neither = asa({ kpi_all: false, branches_all: false })
  assert.equal(canSeeAllKpiBranches(neither), false)
  assert.equal(canSeeAllKpiBranches(asa({})), true, 'kpi_all defaults to granted')
  assert.equal(canSeeAllKpiBranches(profile(ROLES.SUPER_ADMIN)), true)
  assert.equal(canSeeAllKpiBranches(profile(ROLES.ADMIN, { branch_slug: 'bacoor' })), false)
})

test('marketing access follows CRM, and queue-service follows the queue page', () => {
  assert.equal(canAccessMarketing(profile(ROLES.MARKETING)), true)
  assert.equal(canAccessMarketing(profile(ROLES.SUPER_ADMIN)), true)
  assert.equal(canAccessMarketing(asa({ crm: false })), false)
  assert.equal(canAccessMarketing(profile(ROLES.SALES)), false, 'Sales works bookings, not CRM')
  assert.equal(canAccessMarketing(profile(ROLES.STAFF)), false)

  // canAddQueueService delegates to the queue page, which is TL / OL / SA / ASA.
  assert.equal(canAddQueueService(profile(ROLES.TEAM_LEAD)), true)
  assert.equal(canAddQueueService(profile(ROLES.OPERATIONS_LEAD)), true)
  assert.equal(canAddQueueService(profile(ROLES.ADMIN)), false, 'Branch Admin is not on the Queue')
  for (const role of ALL_ROLES) {
    assert.equal(
      canAddQueueService(profile(role)),
      canAccessQueuePage(profile(role)),
      `${role}: adding a queue service must require the Queue page`,
    )
  }
})

test('every ops login role reaches the operations app, and nothing else does', () => {
  // The retired cashier role must not creep back in, and an unknown role must
  // not fall through to an open door.
  for (const role of ALL_ROLES) {
    assert.equal(canUseOperations(profile(role)), true, `${role} is an ops login role`)
  }
  for (const role of ['cashier', 'owner', 'customer', '', 'ADMIN', 'bossmich']) {
    assert.equal(canUseOperations(profile(role)), false, `${role} must not reach the operations app`)
  }
  assert.equal(canUseOperations(null), false)
  assert.equal(canUseOperations({}), false)
})