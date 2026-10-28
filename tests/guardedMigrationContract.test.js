import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * A contract for migrations that narrow policies on the LIVE production database.
 *
 * These migrations cannot be applied casually — they run once, against real rows,
 * and nobody can undo them from here. Each one therefore has to fail loudly rather
 * than half-apply if the database is not in the shape it was written against.
 *
 * This file exists because the same gap bit twice in a row:
 *
 *   - BUG-079 (20261010140000) shipped with its two safety guards written but
 *     NOT tested. Three of its mutations reported NOT PROVED, because nothing
 *     asserted the guards were there.
 *   - BUG-080 (20261010150000) did it again — three more NOT PROVED, same cause.
 *
 * Revert-prove is what caught it both times, and it caught it only because it was
 * run. A guard nobody asserts is a guard nobody maintains, so the requirement is
 * stated here once instead of being rediscovered per migration.
 *
 * Scope is deliberately narrow: this does NOT assert that every migration in the
 * repo is guarded. ~100 legacy migrations are not, several legitimately so. It
 * asserts the contract for the migrations that narrow live policies, which are
 * the ones where getting it wrong loses data or silently grants access.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = join(root, 'supabase', 'migrations')

/** Migrations that narrow or replace an RLS policy on the live database. */
const GUARDED = [
  '20261010120000_protect_daily_sheet_posted_expenses.sql',
  '20261010130000_drop_permissive_admin_for_all_policies.sql',
  '20261010140000_scope_notification_reads.sql',
  '20261010150000_scope_sms_template_writes.sql',
  '20261010160000_daily_sheet_separation_of_duties.sql',
  '20261010170000_daily_sheet_cash_blank_is_cash.sql',
  '20261011090000_reconcile_live_admin_policies.sql',
  '20261013090000_queue_start_requires_present_crew.sql',
  '20261015090000_revoke_legacy_checkout_rpcs.sql',
  '20261018120000_refer_a_friend.sql',
  '20261019210000_daily_sheet_expected_cash_paid_from.sql',
]

/** Post-2026-10-10 migrations that do not narrow live RLS (schema/RPC/feature work). */
const EXEMPTED = [
  '20261017100000_pos_announce_clips_bucket.sql',
  '20261017120000_booking_reschedule_requested.sql',
  '20261017130000_booking_referral_source.sql',
  '20261017140000_referral_source_options.sql',
  '20261017150000_friend_referral_vouchers.sql',
  '20261017160000_branch_stock_asa_pos_grant.sql',
  '20261017170000_referral_program_settings.sql',
  '20261017180000_redeem_branch_stock.sql',
  '20261017190000_friend_referral_on_update.sql',
  '20261017191000_booking_payable_minor.sql',
  '20261018150000_ops_forms_custom_kind.sql',
  '20261019090000_cash_advance_approval_code.sql',
  '20261019100000_birthday_perk_code.sql',
  '20261019110000_promo_vouchers.sql',
  '20261019120000_crew_day_card.sql',
  '20261019130000_staff_birthday.sql',
  '20261019140000_expense_paid_from.sql',
  '20261019150000_inventory_crud_lock.sql',
  '20261019160000_save_own_staff_phone.sql',
  '20261019170000_plan_category_visible_roles.sql',
  '20261019180000_rbac_sheet_write_locks.sql',
  '20261019190000_plan_card_form_link.sql',
  '20261019200000_product_size_options.sql',
  '20261019220000_product_branch_stock_size_key.sql',
  '20261019221000_plan_boards_visible_roles.sql',
  '20261019230000_sheet_money_left_channels.sql',
  '20261021120000_sheet_collection_no_float.sql',
  '20261021140000_daily_sales_summary_split.sql',
  '20261026190000_cash_advance_ledger.sql',
  '20261026200000_payslips.sql',
  '20261026201000_rewards_catalog_points.sql',
  '20261026202000_voucher_apply_pos.sql',
  '20261026210000_inventory_categories.sql',
  '20261026220000_coffee_inventory_only.sql',
  '20261026230000_merch_point_prices.sql',
  '20261026240000_service_points_children.sql',
  '20261028120000_referral_discount_default_5.sql',
  '20261028121000_transfer_branch_stock.sql',
  '20261028130000_payroll_period_lock.sql',
  '20261028140000_payslip_posts_finance.sql',
  '20261028150000_payroll_period_calendar.sql',
]

const read = (name) => readFileSync(join(migrationsDir, name), 'utf8')

describe('the guarded migrations are all present — otherwise this file tests nothing', () => {
  it('every named migration exists', () => {
    const missing = GUARDED.filter((f) => {
      try {
        read(f)
        return false
      } catch {
        return true
      }
    })
    assert.deepEqual(missing, [], `named migrations not found: ${missing.join(', ')}`)
  })
})

describe('every guarded migration runs as one transaction or not at all', () => {
  for (const name of GUARDED) {
    it(`${name} wraps its work in begin/commit`, () => {
      const sql = read(name)
      assert.match(sql, /^\s*begin;/im, 'no BEGIN — a failure halfway would leave policies half-applied')
      assert.match(sql, /\bcommit;/i, 'no COMMIT')
      const begins = (sql.match(/^\s*begin;/gim) || []).length
      const commits = (sql.match(/\bcommit;/gi) || []).length
      assert.equal(commits, begins, 'unbalanced BEGIN/COMMIT pairs')
    })
  }
})

describe('every guarded migration refuses to run against a database it has not read', () => {
  for (const name of GUARDED) {
    it(`${name} aborts rather than half-applying`, () => {
      const sql = read(name)
      const exceptions = (sql.match(/raise\s+exception/gi) || []).length
      assert.ok(
        exceptions > 0,
        'a migration that narrows live policies with no RAISE EXCEPTION cannot tell drift from success',
      )
    })
  }
})

describe('a policy a migration drops is accounted for', () => {
  // Deliberately NOT "every dropped policy is re-created in the same file".
  // That invariant is wrong: for 20261010130000 the drops ARE the fix — removing
  // `Admins manage expenses` is how BUG-069/070 stay closed, and there is
  // nothing left to create. Shipping that as a red test would train the owner to
  // ignore a red, which is worse than having no test. What is always true, and
  // what actually catches a copy-paste error, is that the name is not dropped
  // twice in one file.
  for (const name of GUARDED) {
    it(`${name} never drops the same policy twice`, () => {
      const sql = read(name)
      const seen = new Map()
      for (const m of sql.matchAll(/drop\s+policy\s+(?:if\s+exists\s+)?("[^"]+"|[\w]+)\s+on\s+([\w.]+)/gi)) {
        const key = `${m[2]}|${m[1].replace(/"/g, '')}`
        seen.set(key, (seen.get(key) || 0) + 1)
      }
      const twice = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k)
      assert.deepEqual(twice, [], `dropped more than once: ${twice.join(', ')}`)
    })
  }
})

describe('a narrowing migration checks the helper functions it depends on exist', () => {
  // `is_super_admin()` missing does not error at CREATE POLICY time — it errors
  // the first time a row is read, or silently denies. Either way the breakage
  // shows up after the migration has already run.
  //
  // The assertion requires `) then raise exception` as one shape. Matching only
  // that a `pg_proc` lookup mentioning the function exists was not enough: deleting
  // the `raise exception` leaves the lookup intact and the test still passed, which
  // is a check that reads like a guard and guards nothing. A lookup with no raise
  // is an empty `if` — it computes a boolean and throws it away.
  for (const name of GUARDED) {
    const sql = read(name)
    if (!/is_super_admin\(\)/.test(sql)) continue
    it(`${name} aborts when is_super_admin() is missing, rather than only looking`, () => {
      assert.match(
        sql,
        /if not exists \([\s\S]{0,400}?from pg_proc[\s\S]{0,400}?\)\s*then\s*raise exception 'public\.is_super_admin\(\) is missing/,
        'the migration references is_super_admin() but never raises when it is absent — a missing function fails later, on the first row, with this migration already committed',
      )
    })
  }
})

describe('a drift list built with array_to_string can come back clean', () => {
  // array_to_string of an empty array is '', not NULL. 20261010160000 and
  // 20261010170000 shipped with `if v_missing is not null`, so on production they
  // refused a perfectly matching body with "missing: " and an empty list.
  for (const name of GUARDED) {
    const sql = read(name)
    if (!/:=\s*(?:nullif\()?array_to_string\(/i.test(sql)) continue
    it(`${name} treats an empty drift list as no drift`, () => {
      assert.doesNotMatch(sql, /:=\s*array_to_string\(/i, 'wrap array_to_string in nullif(..., \'\') or the guard can never pass')
    })
  }
})

describe('the guarded set is the live set — a new narrowing migration must be added here', () => {
  it('every migration dated 2026-10-10 or later is in GUARDED', () => {
    // A narrowing migration written after this file and not added to the list
    // above would ship with no contract at all — which is exactly the BUG-079 and
    // BUG-080 failure, one directory listing away.
    const all = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql') && f >= '20261010')
      .sort()
    const unlisted = all.filter((f) => !GUARDED.includes(f) && !EXEMPTED.includes(f))
    assert.deepEqual(
      unlisted,
      [],
      `new migrations must either be listed as guarded or explicitly exempted: ${unlisted.join(', ')}`,
    )
  })
})