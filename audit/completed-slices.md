# Completed audit slices

Chronological. Each slice includes tests and, when applicable, live DB apply.

## Slice A — Payroll, POS, concurrency, login deep-links

- Floor overflow **Pay** for TL / sales / marketing / detailer / video
- Post-login paths: attendance, history, reviews, content, notifications, broadcast
- POS `?tab=expenses` → Finance Purchases (`resolveFinanceTab`)
- P&L fake format switcher removed
- My pay sums **latest run** (`currentPostedPayoutMinor`)
- Homepage coming-soon from `branches.coming_soon`
- Ceramic packages book `/book` with prefill
- Partnership inquiries status workflow
- Detailers locked to detailing queue family
- **Live:** dropped legacy queue trigger; revoked `award_loyalty_stamps` from authenticated; tightened `is_inquiry_reader`
- **Tests:** `tests/leftoverUxSeam.test.js` (partial), payroll/POS seams
- **Migration:** `20260820120000_leftover_hot_path.sql`

## Slice B — BA/ASA gates, inquiries, People

- **Branch Admin** `allowRoute` matches Command nav (denies finance/CRM/people/console by URL)
- ASA **CRM** + **content** grant-gated
- Public `/services` + `/packages` aligned with homepage names (static, pre-catalog)
- Complaints inbox status UPDATE + RLS
- Contact inquiries read-only (no status yet)
- People edit temporary password + directory `overflow-x-auto`
- **Live:** revoked client execute on `assign_daily_queue_number(text, date)`; complaints UPDATE policy
- **Migration:** `20260820130000_leftover_gate_rpc.sql`

## Slice C — ASA chrome grants, contact workflow, People mobile

- ASA **console**, **reviews**, **notifications**, **queue_all** (view + redo + failed QA) grant-gated
- Post-login home skips denied role home (`resolvePostLoginPath` / `allowedRoleHome`)
- Contact inbox **status** column + UPDATE RLS (matches partnership CHECK)
- People directory **card layout** on mobile, table on desktop
- **Migration:** `20260820140000_contact_status_asa_grants.sql` (live: `20260820055834`)

## Slice D — Public catalog + sale bucket unification

- **`src/lib/publicCatalog.js`** — `/services` loads Inventory `services` (anon SELECT RLS)
- Marketing copy overlay by slug alias; book CTA passes `service_id`
- PPF package titles from `ppfPackages.js`
- **Single classifier path:** `bacoorDailyReport.classifySaleBucket` → `posSellables` + `posBucketToBacoor`
- Name-only sale rows (Coffee, Accessories) classify without `item_type`
- **Tests:** `tests/publicCatalog.test.js`, updated `leftoverUxSeam.test.js`

## Slice E — ASA history/bookings + catalog copy seed (this continue)

- ASA **history** + **bookings** grant keys (People editor labels included)
- `canAccessHistory` / `canAccessBookingBoard` honor grants for ASA
- **Data fix:** mock queue-test service names/descriptions updated in live DB
- **Migration:** `20260820150000_catalog_copy_seed.sql`
- **Audit folder:** this directory created

## Slice F — Public inquiry API + server geofence

- **`/api/public-inquiry`** gateway (`contact` | `complaints` | `partnership`) with honeypot, min delay, rate limit, service-role insert
- **Contact**, **Complaints**, **Partnership** forms route through `postPublicInquiry` (no direct PostgREST INSERT)
- **Revoke** anon/authenticated INSERT on inquiry tables
- **DB geofence trigger** on `staff_attendance` when `source='geo'`
- **Tests:** `tests/publicInquiry.test.js`
- **Migration:** `20260820160000_public_inquiry_api_geofence.sql` (live: `20260820064044`)

## Slice G — Floor bucket parity + dead dock cleanup

- **`classifyFloorSaleBucket`** delegates to `posSellables.classifySaleBucket`
- Removed unused **`getBranchAdminDock`**
- **O-06 corrected:** prior audit said hours table missing; live had orphaned migration name only

## Slice H — Branch operating hours schema + UI

- **Table:** `branch_operating_hours` with public SELECT + manager write RLS
- **Ops UI + public `/branches`:** open-now badges
- **Migration:** `20260820170000_branch_operating_hours_table.sql` (live: `20260820070315`)

## Slice I — Homepage wash SKUs + inquiry status filters

- Inventory seed Glass/Engine (active) + Mobile (inactive)
- Inquiry status filter chips
- **Migration:** `20260820180000_homepage_wash_sku_seed.sql` (live: `20260820070916`)

## Slice J — POS/payroll concurrency proofs

- **Live proof O-03:** inserted two paid `sales` for one `pos_handoffs` row → second hit `sales_pos_handoff_paid_uidx` unique_violation; RPC already uses `FOR UPDATE` + “already paid”
- **Live proof O-09:** second `payroll_run_sales` for same `sale_id` → `payroll_run_sales_sale_uidx` unique_violation
- **Bug fix:** concurrent `run_payroll` could pass overlap checks before either inserts → added `pg_advisory_xact_lock(87201401)`
- **Tests:** `tests/concurrencyGuards.test.js`
- **Migration:** `20260820190000_run_payroll_advisory_lock.sql` (live: `20260820072056`)

## Slice K — ASA grant editor + audit hygiene close-out

- **O-12:** `AssistantGrantsEditor` — grouped grants, Defaults / Safe / Enable all, enabled count; shared create+edit on People
- Helpers: `normalizeAssistantGrants`, `setAssistantGrantsPreset`, `ASSISTANT_GRANT_GROUPS`
- **O-07:** closed as intentional (homepage static marketing vs live `/services`)
- **O-10/O-11/O-14:** documented only in migration-ledger (no rename; orphan hours name noted)
- **Tests:** `tests/assistantGrantsEditor.test.js`

## Slice L — Full roles/users inventory + login_email backfill

- **`audit/roles-users.md`:** every `ROLES` value, demo chips, live active roster, customer demo, access snapshot
- **B-26:** backfilled `staff_profiles.login_email` from `auth.users` (was null for all demos)
- QA matrix: add `inquiries` / `payroll` / `my-pay` keys; assert every role has home + nav + allowRoute(home)
- Demo test: every `ROLES` value covered by a chip
- **Migration:** `20260820200000_staff_login_email_backfill.sql` (live: `20260820074343`)

## Slice M — Demo login smoke + advisor harden

- Live smoke `scripts/_qa-live-smoke.mjs` **21/21** (ASA + crew1–3 + all primary roles + customer)
- **B-27:** demo chip tooltip no longer leaks password
- **B-28:** revoke RPC on geofence trigger; harden `haversine_meters` search_path
- **`audit/advisors-snapshot.md`** — DEFINER views intentional; remaining WARNs documented
- **roles-users:** secondary accounts (admin2, TL Batangas) documented as chip-less
- **Migration:** `20260820210000_revoke_geofence_rpc.sql` (live: `20260820075224`)

## Slice N — One-tap demo auto sign-in

- Demo chips now **auto sign in** for easier QA on both `LoginPage` and `CustomerSignInPage`
- Reuses the same guarded login paths as manual submit; customer demo skips only the pre-submit lifecycle hint gate
- Demo chips disable while submit is in flight, preventing double taps
- **Tests:** `tests/floorStatusCards.test.js`, `tests/demoAccounts.test.js`

## Slice O — Performance FK indexes + RLS InitPlan

- **OPT-06 (partial):** 21 covering indexes on unindexed FKs for bookings / queue / POS / memberships / transactions / planner
- **B-29:** `auth.uid()` InitPlan wrap on `staff_branch_assignments` + `customer_birthday_perks` read policies
- Remaining advisors: unused_index INFO, multiple_permissive_policies WARN, leftover auth_rls on blogs/notifications — parked as OPT-07
- **Migrations:** `hot_path_fk_indexes` (live `20260820083107`), `rls_auth_uid_initplan` (live `20260820083213`)
- **Tests:** `tests/hotPathFkIndexes.test.js`

## Slice P — Advisor close-out (OPT-07)

- **B-30:** blogs + notification_templates + notification_broadcast_kinds RLS InitPlan
- **16 remaining FK indexes** (blogs, complaints, events, SMS, products, notifications, ops forms, plan boards)
- Live advisor recheck: `unindexed_foreign_keys` **0**, `auth_rls_initplan` **0**
- Parked: `unused_index` INFO + `multiple_permissive_policies` WARN (need usage stats / policy merge review)
- **Migrations:** `rls_initplan_blogs_notifications` (`20260820092531`), `remaining_fk_indexes` (`20260820092625`)

## Slice Q — Redundant indexes + ASA grant RLS parity

- **OPT-08 (partial):** dropped **7 proven-redundant** indexes only (duplicates / leftmost of composites / superseded by unique or partial). Did **not** drop young zero-scan FK indexes from O/P.
- **B-31:** blogs + notification_templates/kinds staff RLS now require `asa_has_grant('content'|'notifications')` for ASA (matches `permissions.js`); public published blogs policy unchanged
- **roles-users:** refreshed active counts (14 staff / 16 customers)
- **Migrations:** `drop_redundant_indexes` (`20260820093756`), `asa_content_notifications_rls` (`20260820093901`)
- **Tests:** `tests/hotPathFkIndexes.test.js` (drop list + grant RLS source scan)

## Slice R — Events RLS parity + safe permissive merges (OPT-09)

- **B-32:** `events` write no longer uses bare `is_admin()` (every ASA) or marketing ALL; matches Content (`content`) ∪ Planning edit (SA / BA / ASA `planning_edit`)
- **OPT-09 (partial):** single SELECT for `events` + `blogs`; split blog/event writes to I/U/D; merged `app_settings` write keys into one I/U/D expression (SELECT stays the read-all policy)
- Live advisor: `multiple_permissive_policies` **50 → 44**; `app_settings` / `blogs` / `events` **0**
- **Migration:** `events_rls_and_permissive_merge` (`20260820100833`)
- **Tests:** `tests/hotPathFkIndexes.test.js`

## Slice S — Bookings/customers/vehicles RLS merge (OPT-09)

- **B-33:** `customers` no longer `is_admin()` FOR ALL; ASA needs `crm|queue_all|pos` to read, `crm` to update; delete scoped to SA/ASA+crm/BA
- **B-34:** `bookings` queue read no longer bare `is_admin()` (cross-branch leak for BA/ASA); uses `can_manage_branch(branch)`; redundant sales policies collapsed
- **Vehicles:** one SELECT + I/U/D; ASA write/read via `crm|queue_all` (and `pos` for read)
- Live advisor: `multiple_permissive_policies` **44 → 34**; `vehicles` / `bookings` / `customers` **0**
- **Migration:** `bookings_customers_vehicles_rls_merge` (`20260820104531`)
- **Tests:** `tests/hotPathFkIndexes.test.js`

## Slice T — Planner / attendance / branches RLS merge (OPT-09)

- **B-35:** `can_edit_planning()` now uses `asa_has_grant('planning_edit')` (aligned with app + InitPlan-friendly)
- **B-36:** `staff_attendance` SELECT uses `can_manage_branch(branch_slug)` instead of bare `is_admin()`
- **Branches:** one `branches_select` for anon+authenticated (public active ∪ staff scope)
- **Planner:** split FOR ALL writes to I/U/D; merged SELECT (+ assignee self-update) on boards/lists/cards/assignees/checklists/templates/presets
- Live advisor: `multiple_permissive_policies` **34 → 19**
- **Migration:** `planner_attendance_branches_rls_merge` (`20260820105543`)
- **Tests:** `tests/hotPathFkIndexes.test.js`

## Slice U — Finance / loyalty / catalog / ops RLS (OPT-09 close-out)

- **B-37:** `sales` SELECT requires `asa_has_grant('finance_view')` (not bare ASA)
- **B-38:** loyalty settings/milestones/tiers write via `memberships` grant (not `is_admin`)
- **B-39:** services/products/sizes/prices write via `services_merch|pos` (BA no longer catalog writer)
- **B-40:** `customer_memberships` write SA/ASA+memberships only; BA/marketing/sales keep read for POS/CRM
- Merged expenses+investor SELECT; split FOR ALL on finance/catalog/ops/sms/maint; merged birthday + notifications SELECT
- Live advisor: `multiple_permissive_policies` **19 → 0** (OPT-09 closed)
- **Live applies:** `finance_loyalty_catalog_rls_merge` (`20260820110153`) + `finance_catalog_ops_rls_merge` (`20260820110238`) — one repo file
- **Tests:** `tests/hotPathFkIndexes.test.js`

## Slice V — Hospitality ops (newplans W1–W7)

- **W1:** `shift_close_reports` + field config + submit/review RPCs; POS End of shift; Finance Shift reviews
- **W2:** payroll `custom`, `staff_pay_packages`, labeled add/deduct; `run_payroll` nets deducts
- **W3:** My pay today/month confirmed + estimate — unpaid
- **W4:** `customer_notes` + queue/CRM + complaint promote
- **W5:** `role_definitions` + `custom_role_key`; People UI; Auth overlay; video_editor QA still green
- **W6:** `expense_reports` → `expenses`; Finance Expense reports tab
- **W7:** newplans §8 checked; OPT-05/08 deferred notes
- **Repo:** `20260821010000` … `20260821050000_*`
- **Tests:** `tests/shiftClose.test.js`, `tests/hospitalityOps.test.js`

## Slice W — Multi-branch + Finance integrity hardening

- Kill silent `'bacoor'` defaults (`requireBranchSlug` / `branchSlugsForOwnPay`)
- `staff_pay_packages.branch` NOT NULL + payroll loadProof/history/UI filter
- Expense reports respect Finance `branchFilter`; `submit_expense_report` ASA branch ACL
- Finance Reports: accepted/locked `shift_close_reports` read-only attestation (does not rewrite POS/P&L)
- My pay estimate uses assigned branch_slugs
- **Repo:** `20260821100000_staff_pay_packages_branch.sql`, `20260821110000_submit_expense_report_branch_acl.sql`
- **Tests:** `tests/branchFinanceHardening.test.js`
