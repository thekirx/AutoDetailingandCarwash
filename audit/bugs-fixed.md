# Bugs fixed during audit

Concrete defects corrected (not intentional design).

| ID | Symptom | Root cause | Fix | Verified |
|----|---------|------------|-----|----------|
| B-01 | Double queue numbers / race | Legacy `trg_assign_daily_queue_number` MAX+1 | Drop trigger; keep DEFINER allocator only | Migration + tests |
| B-02 | Clients could mint loyalty stamps | `award_loyalty_stamps` granted to authenticated | REVOKE execute from anon/authenticated | Migration |
| B-03 | Branch Admin could open Finance/CRM via URL | `allowRoute` wider than Command nav | `BRANCH_ADMIN_ROUTE_KEYS` early return | `adminScope.test.js` |
| B-04 | ASA saw CRM/Content with grant=false | Hardcoded true for ASA tier | `hasGrant('crm'/'content')` | `leftoverUxSeam.test.js` |
| B-05 | ASA saw Console/Reviews/Notifications/Queue with grant=false | Same pattern | Grant keys + `canViewQueueOperations` | `leftoverUxSeam.test.js` |
| B-06 | Login → access-denied for denied ASA home | `redirectForRole` ignored grants | `allowedRoleHome` in `authRedirect.js` | `authRedirect.test.js` |
| B-07 | Complaints inbox read-only | No UPDATE policy | RLS policy via `is_inquiry_reader()` | Migration + UI |
| B-08 | Contact inbox read-only | No status column / UPDATE | Status CHECK + UPDATE policy | Migration + UI |
| B-09 | My pay under-reported | Summed first line only | `currentPostedPayoutMinor` latest run | `leftoverUxSeam.test.js` |
| B-10 | P&L showed three fake-active formats | Dead UI switcher | Removed `COMMON_FORMATS` chrome | Source scan test |
| B-11 | Public `/services` ≠ POS/book names | Static marketing list | `fetchPublicCatalogServices` from DB | `publicCatalog.test.js` |
| B-12 | Bacoor close ≠ POS bucket totals | Duplicate `classifySaleBucket` | Delegate to `posSellables` | `hakumRedesignLibs.test.js` |
| B-13 | Coffee/accessories mis-bucketed on close | Missing name heuristic without `item_type` | Name checks in `posSellables` | `requestBriefE2e.test.js` |
| B-14 | `/services` showed "Premium Car Wash" mock copy | Seed data never updated | `catalog_copy_seed` migration | Live SQL |
| B-15 | ASA always had History/Bookings | No grant keys | `history` / `bookings` grants | `leftoverUxSeam.test.js` |
| B-16 | Clients could call queue allocator RPC | EXECUTE granted to authenticated | REVOKE on two-arg function | Migration |
| B-17 | Public forms spam/abuse via direct PostgREST INSERT | RLS `WITH CHECK (true)` + client honeypot only | `/api/public-inquiry` + REVOKE INSERT | `publicInquiry.test.js` + live |
| B-18 | Geo attendance bypass via forged coordinates | Client-only `attendanceGeo.js` check | `enforce_staff_attendance_geofence` trigger | Migration live |
| B-19 | Floor board sale buckets ≠ POS/Bacoor close | Duplicate `classifyFloorSaleBucket` heuristics | Delegate to `posSellables.classifySaleBucket` | `hakumRedesignLibs.test.js` |
| B-20 | Dead `getBranchAdminDock` exported but never wired | BA moved to Command shell | Removed function; test asserts Command nav | `branchAdminShell.test.js` |
| B-21 | `branch_operating_hours` in schema_migrations but table missing | Orphaned / empty prior apply (`20260819185520`) | New migration creates table + RLS + seed | Live `20260820070315` |
| B-22 | Public /branches showed fake “Open daily” | No hours data | Wire `branch_operating_hours` + open-now | `PublicPages.jsx` |
| B-23 | Homepage Glass/Engine bookable in marketing but missing from Inventory | No `services` rows | Seed SKUs + public catalog aliases | Live `homepage_wash_sku_seed` |
| B-24 | Concurrent `run_payroll` could double-confirm overlapping periods | TOCTOU on overlap `exists` check | `pg_advisory_xact_lock(87201401)` before checks | Live `run_payroll_advisory_lock` |
| B-25 | ASA grant UI was a flat raw-key checklist (hard to scan / easy to over-grant) | Single long checkbox list + `(key)` noise | Grouped `AssistantGrantsEditor` + Defaults/Safe/All presets | `assistantGrantsEditor.test.js` |
| B-26 | People/Crew hid login emails for every staff demo | `staff_profiles.login_email` null while `auth.users.email` set | Backfill from auth (`staff_login_email_backfill`) | Live SQL + migration |
| B-27 | Demo chip hover tooltip showed plaintext password | `title={email · password}` | Title is email/label only | `floorStatusCards.test.js` |
| B-28 | Anon/authenticated could RPC `enforce_staff_attendance_geofence` | Trigger fn granted EXECUTE to API roles | REVOKE ALL; keep as trigger-only | Live `revoke_geofence_rpc` |
| B-29 | Hot RLS policies re-eval `auth.uid()` per row | Missing `(select auth.uid())` InitPlan wrap | Rewrote staff_branch_assignments + birthday_perks policies | Live `rls_auth_uid_initplan` |
| B-30 | Blogs/notification RLS still re-eval `auth.uid()` per row | Same InitPlan pattern | Rewrote blogs + notification_templates/kinds policies | Live `rls_initplan_blogs_notifications` |
| B-31 | ASA with `content`/`notifications` grant=false could still read/write blogs & notification catalog via PostgREST | Staff RLS allowed any ASA role, ignoring `asa_has_grant` | Rewrite policies to call `asa_has_grant('content'|'notifications')` | Live `asa_content_notifications_rls` |
| B-32 | ASA without grants / marketing could manage `events` via PostgREST; Branch Admin OK but ASA over-wide | `Admins manage events` used `is_admin()` (includes every ASA) + marketing | Rewrite to SA / BA / `asa_has_grant(planning_edit|content)`; I/U/D + merged SELECT | Live `events_rls_and_permissive_merge` |
| B-33 | ASA without CRM/POS/queue grants had full `customers` access | `Admin has full access` FOR ALL via `is_admin()` | Split I/U/D/SELECT; ASA read `crm\|queue_all\|pos`, write `crm` | Live `bookings_customers_vehicles_rls_merge` |
| B-34 | Branch Admin / ASA could read bookings on branches outside scope | Queue SELECT used bare `is_admin()` (no branch check) | `bookings_select` uses `can_manage_branch(branch)`; merge sales overlaps | Live `bookings_customers_vehicles_rls_merge` |
| B-35 | `can_edit_planning()` duplicated grant logic / raw `auth.uid()` | Inline `permission_grants->>'planning_edit'` | Delegate to `asa_has_grant('planning_edit')` | Live `planner_attendance_branches_rls_merge` |
| B-36 | BA/ASA could read attendance outside branch scope | SELECT used bare `is_admin()` | `staff_attendance_select` uses `can_manage_branch(branch_slug)` | Live `planner_attendance_branches_rls_merge` |
| B-37 | ASA without finance_view could read all `sales` | Staff read policy used bare `is_assistant_super_admin()` | `sales_select` requires `asa_has_grant('finance_view')` | Live `finance_loyalty_catalog_rls_merge` |
| B-38 | ASA without memberships grant could manage loyalty tables | Write policies used `is_admin()` | Write via `asa_has_grant('memberships')` | Live `finance_loyalty_catalog_rls_merge` |
| B-39 | Branch Admin could write services/products via PostgREST | Catalog write used `is_admin()`; app `canManageServices` excludes BA | Write via SA / `services_merch` / `pos` only | Live `finance_catalog_ops_rls_merge` |
| B-40 | BA could manage `customer_memberships` (app Memberships is SA/ASA only) | `is_admin()` FOR ALL | Write SA/ASA+memberships; BA keeps SELECT for POS | Live `finance_loyalty_catalog_rls_merge` |

## Not bugs (see intentional-by-design.md)

- Public queue DEFINER views
- Crew compensation tab estimate-only
- ~~Dual `classifyFloorSaleBucket` for Super Admin floor board vs Bacoor close~~ (unified Slice G)
- ~~`getBranchAdminDock` unused~~ (removed Slice G)
