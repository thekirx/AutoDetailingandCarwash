import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sql = readFileSync(join(root, 'supabase/migrations/20260820220000_hot_path_fk_indexes.sql'), 'utf8')

const rlsSql = readFileSync(join(root, 'supabase/migrations/20260820230000_rls_auth_uid_initplan.sql'), 'utf8')

describe('hot path FK indexes migration', () => {
  it('covers floor, membership, and ledger FK columns', () => {
    for (const name of [
      'bookings_team_lead_id_idx',
      'queue_assignments_assigned_by_idx',
      'pos_handoffs_handed_off_by_idx',
      'customer_memberships_customer_id_idx',
      'transactions_customer_id_idx',
      'staff_attendance_marked_by_idx',
      'service_reviews_customer_id_idx',
      'payroll_run_lines_expense_id_idx',
    ]) {
      assert.match(sql, new RegExp(name))
    }
    assert.match(sql, /create index if not exists/i)
  })

  it('wraps auth.uid() in select for InitPlan on hot RLS policies', () => {
    assert.match(rlsSql, /staff_id = \(select auth\.uid\(\)\)/)
    assert.match(rlsSql, /customer_id = \(select auth\.uid\(\)\)/)
    assert.match(rlsSql, /sp\.id = \(select auth\.uid\(\)\)/)
  })

  it('covers blogs/notifications InitPlan + remaining FK indexes', () => {
    const blogs = readFileSync(join(root, 'supabase/migrations/20260820240000_rls_initplan_blogs_notifications.sql'), 'utf8')
    const rest = readFileSync(join(root, 'supabase/migrations/20260820250000_remaining_fk_indexes.sql'), 'utf8')
    assert.match(blogs, /sp\.id = \(select auth\.uid\(\)\)/)
    assert.match(blogs, /blogs_staff_select/)
    assert.match(blogs, /notification_templates_staff_read/)
    assert.match(rest, /blogs_created_by_idx/)
    assert.match(rest, /sms_events_customer_id_idx/)
    assert.match(rest, /complaints_booking_id_idx/)
  })

  it('drops proven-redundant indexes only (OPT-08 partial)', () => {
    const drop = readFileSync(join(root, 'supabase/migrations/20260820260000_drop_redundant_indexes.sql'), 'utf8')
    for (const name of [
      'events_slug_idx',
      'payroll_run_sales_sale_idx',
      'idx_bookings_branch_queue_date_number',
      'idx_bookings_customer_id',
      'idx_bookings_vehicle_id',
      'service_reviews_booking_idx',
      'staff_attendance_staff_date_idx',
    ]) {
      assert.match(drop, new RegExp(`drop index if exists.*${name}`, 'i'))
    }
  })

  it('ties ASA blogs/notifications RLS to asa_has_grant', () => {
    const sql = readFileSync(join(root, 'supabase/migrations/20260820270000_asa_content_notifications_rls.sql'), 'utf8')
    assert.match(sql, /asa_has_grant\('content'\)/)
    assert.match(sql, /asa_has_grant\('notifications'\)/)
    assert.match(sql, /blogs_staff_write/)
  })

  it('aligns events RLS with Content/Planning gates and merges SELECT policies', () => {
    const sql = readFileSync(join(root, 'supabase/migrations/20260820280000_events_rls_and_permissive_merge.sql'), 'utf8')
    assert.match(sql, /asa_has_grant\('planning_edit'\)/)
    assert.match(sql, /asa_has_grant\('content'\)/)
    assert.match(sql, /events_select/)
    assert.match(sql, /blogs_select/)
    assert.match(sql, /app_settings_staff_insert/)
    assert.match(sql, /blogs_staff_insert/)
    assert.match(sql, /drop policy if exists "Admins manage events"/)
  })

  it('merges bookings/customers/vehicles permissive policies and tightens ASA', () => {
    const sql = readFileSync(join(root, 'supabase/migrations/20260820290000_bookings_customers_vehicles_rls_merge.sql'), 'utf8')
    assert.match(sql, /create policy bookings_select/)
    assert.match(sql, /can_manage_branch\(branch\)/)
    assert.match(sql, /create policy customers_select/)
    assert.match(sql, /asa_has_grant\('crm'\)/)
    assert.match(sql, /asa_has_grant\('queue_all'\)/)
    assert.match(sql, /asa_has_grant\('pos'\)/)
    assert.match(sql, /create policy vehicles_select/)
    assert.match(sql, /drop policy if exists "Admin has full access to customers"/)
    assert.match(sql, /drop policy if exists "Sales can read branch bookings"/)
  })

  it('merges planner/attendance/branches policies and fixes can_edit_planning', () => {
    const sql = readFileSync(join(root, 'supabase/migrations/20260820300000_planner_attendance_branches_rls_merge.sql'), 'utf8')
    assert.match(sql, /asa_has_grant\('planning_edit'\)/)
    assert.match(sql, /create policy branches_select/)
    assert.match(sql, /create policy staff_attendance_select/)
    assert.match(sql, /can_manage_branch\(branch_slug\)/)
    assert.match(sql, /create policy plan_boards_select/)
    assert.match(sql, /create policy plan_card_assignees_update/)
    assert.match(sql, /plan_checklist_items_select/)
  })

  it('merges finance/loyalty/catalog RLS and tightens ASA/BA grants', () => {
    const sql = readFileSync(join(root, 'supabase/migrations/20260820310000_finance_loyalty_catalog_rls_merge.sql'), 'utf8')
    assert.match(sql, /create policy sales_select/)
    assert.match(sql, /asa_has_grant\('finance_view'\)/)
    assert.match(sql, /asa_has_grant\('memberships'\)/)
    assert.match(sql, /asa_has_grant\('services_merch'\)/)
    assert.match(sql, /create policy services_select/)
    assert.match(sql, /create policy customer_memberships_select/)
    assert.match(sql, /create policy user_notifications_select/)
    assert.doesNotMatch(sql, /is_assistant_super_admin\(\)\s*OR \(\(current_user_role\(\) = 'admin'/)
  })
})
