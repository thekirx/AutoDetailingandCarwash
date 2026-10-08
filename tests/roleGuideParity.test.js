/**
 * Role-guide parity — docs/guides/roles/*.md must match permissions.js.
 *
 * These guides are what a new hire (or an agent) reads to learn what a role can
 * do. They drifted for weeks after the 2026-10-01 money-path cutover — four
 * guides granted a "Pay" dock item whose module was deleted, and the SA/ASA
 * guide pointed at /operations/console, a route that does not exist — because
 * designSystemRedesign.test.js only asserted the files *exist*.
 *
 * This suite imports the real pure functions rather than regex-scanning
 * permissions.js, so it survives a refactor and fails only when behaviour
 * actually changes.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getDetailerDock,
  getDetailerMore,
  getSalesDock,
  getSalesMore,
  getMarketingDock,
  getMarketingMore,
  getStaffDock,
  getOperationsNav,
  redirectForRole,
  ROLES,
} from '../src/auth/permissions.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const guide = (name) => readFileSync(join(root, 'docs', 'guides', 'roles', name), 'utf8')

const profile = (role) => ({ role, branch_slug: 'bacoor' })

/**
 * Strip markdown, then split a "A · B · C (More: D, E)" dock line into its
 * individual labels. Parentheticals are unwrapped first so "Forms (More: Floor,
 * KPI)" yields Forms, Floor and KPI rather than one blob.
 */
function words(md) {
  return (
    md
      // "Attendance · Tasks · Forms (More: Floor, KPI)" — the More clause is a
      // separate list that follows the primary dock with no `·` separator, so
      // insert one before it rather than just deleting the word.
      .replace(/\(?\s*\bMore\s*:/gi, ' · ')
      .replace(/\(([^)]*)\)/g, ' $1 ')
      .replace(/^#.*$/gm, '')
      .replace(/[*_`>#]/g, ' ')
      .split(/[·\n,+]/)
      .map((s) => s.trim())
      .filter(Boolean)
  )
}

test('every role guide file exists', () => {
  for (const f of [
    'detailer.md', 'sales.md', 'marketing.md', 'super-admin-asa.md',
    'team-lead.md', 'branch-admin.md', 'operations-lead.md', 'video-editor.md',
    'crew-staff.md', 'investor.md', 'customer.md',
  ]) {
    assert.ok(existsSync(join(root, 'docs', 'guides', 'roles', f)), `${f} must exist`)
  }
})

// ── forward direction: every dock/nav label is documented ────────────────

test('Detailer guide documents every dock and More label', () => {
  const md = guide('detailer.md')
  const known = words(md)
  for (const item of [...getDetailerDock(profile(ROLES.DETAILER)), ...getDetailerMore()]) {
    assert.ok(known.includes(item.label), `detailer.md is missing dock item "${item.label}"`)
  }
})

test('Sales guide documents every dock and More label', () => {
  const md = guide('sales.md')
  const known = words(md)
  for (const item of [...getSalesDock(profile(ROLES.SALES)), ...getSalesMore()]) {
    assert.ok(known.includes(item.label), `sales.md is missing dock item "${item.label}"`)
  }
})

test('Marketing guide documents every dock and More label', () => {
  const md = guide('marketing.md')
  const known = words(md)
  for (const item of [...getMarketingDock(profile(ROLES.MARKETING)), ...getMarketingMore(profile(ROLES.MARKETING))]) {
    assert.ok(known.includes(item.label), `marketing.md is missing dock item "${item.label}"`)
  }
})

test('Crew/Staff guide documents every dock label', () => {
  const md = guide('crew-staff.md')
  const known = words(md)
  for (const item of getStaffDock(profile('staff'))) {
    assert.ok(known.includes(item.label), `crew-staff.md is missing dock item "${item.label}"`)
  }
})

test('SA/ASA guide documents every nav label', () => {
  const md = guide('super-admin-asa.md')
  const known = words(md)
  for (const group of getOperationsNav(profile(ROLES.BOSS))) {
    for (const item of group.items) {
      assert.ok(known.includes(item.label), `super-admin-asa.md is missing nav item "${item.label}"`)
    }
  }
})

// ── reverse direction: retired surfaces must NOT be documented ───────────

const RETIRED = [
  { term: 'Pay', why: 'My Pay was retired with the Daily Sheet cutover (2026-10-01)' },
  { term: 'Payroll', why: 'payroll_runs / run_payroll are REVOKEd from authenticated' },
  { term: 'My pay', why: 'MyPayPage was deleted' },
  { term: 'End of shift', why: 'shift_close_reports path was retired' },
  { term: 'End of Shift', why: 'shift_close_reports path was retired' },
]

test('no role guide advertises a retired capability', () => {
  for (const f of ['detailer.md', 'sales.md', 'marketing.md', 'super-admin-asa.md', 'team-lead.md', 'branch-admin.md']) {
    const lines = words(guide(f))
    for (const { term, why } of RETIRED) {
      assert.ok(
        !lines.includes(term),
        `${f} advertises "${term}" as a capability — ${why}`,
      )
    }
  }
})

test('no guide points at the retired /operations/console route', () => {
  for (const f of ['super-admin-asa.md', 'team-lead.md', 'branch-admin.md', 'operations-lead.md', 'detailer.md', 'sales.md']) {
    const md = guide(f)
    assert.ok(
      !md.includes('/operations/console'),
      `${f} references /operations/console — canAccessConsole() is false and the route does not exist`,
    )
  }
})

// ── Home must match the real redirect ───────────────────────────────────

test('SA/ASA guide Home matches redirectForRole', () => {
  const md = guide('super-admin-asa.md')
  for (const role of [ROLES.BOSS, ROLES.ASSISTANT_SUPER_ADMIN]) {
    const home = redirectForRole(role)
    assert.ok(
      md.includes(home),
      `super-admin-asa.md Home must be ${home} for ${role} (redirectForRole)`,
    )
  }
})