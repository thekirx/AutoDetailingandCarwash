# Hakum Auto Care — Revision & QA Checklist

Follow only the specified revisions. Preserve existing working functionality. Verify every affected file and operation before marking an item complete.

## 1. Navigation & UI Cleanup
- [x] Retain the 6 core operational modules (`Floor Insight`, `Carwash Queue`, `Detailing`, `Team P`, `POS`, `Financials`) AND restore role-gated operational pages (`Catalog & Inventory` incl. `Vehicle List` `/operations/inventory?tab=cars`, `Payslips`, `Employees`, `Customers`, `Rewards`, `Branches`, `Content`, `Settings`, `History`, `Notifications`, `System & Data`) per user follow-up feedback so no operational route is missing.
- [x] Clean up unnecessary modules, redundant nav clutter, and dead links (removed dead `Payslips` link from `getDetailerMore`).
- [x] Remove non-functional buttons and actions that are not intended to be used.
- [x] Simplify the overall interface while keeping every role's required tabs intact (`tests/sidebarAllRolesCompleteness.test.js` 11/11).

## 2. Carwash Queue & Service Workflow
- [x] Retain the existing queue system and its working functionality. Only implement the requested additions and fixes.
- [x] Restore the Average Waiting Time metric.
- [x] Prevent vehicles from entering In Progress without an assigned crew (enforced in UI + live DB trigger `require_present_crew_on_start()` fixed by `20261128205500_fix_require_present_crew_trigger.sql`).
- [x] Ensure that vehicles under In Progress have already started their service and do not still display Start Service.
- [x] Ensure Final Checking is available at the appropriate stage, instead of only showing Stop Service.
- [x] Provide an option to modify or change the assigned service when necessary.
- [x] Ensure queue status and available actions are consistent throughout the service workflow.

## 3. Quality Assurance & Redo
- [x] Use Mark Redo instead of Failed QA as the action button.
- [x] Ensure vehicles marked for redo automatically appear in the Failed QA section.
- [x] Fix missing vehicles in the Failed QA section.
- [x] Ensure vehicles undergoing redo can return to Final Checking after corrections are completed.

## 4. POS & Payment
- [x] Fix RBAC permissions so the intended authorized user (`BossMich`, `assistant_super_admin`, `admin`, `operations_lead`) can access the `Modify` option in POS (including `20261128203000_ops_lead_for_payment_resync.sql` for `operations_lead` re-sync).
- [x] Fix the issue where POS items are not displayed but their prices are added to the total.
- [x] Display a complete itemized breakdown of the total amount, including services, products, quantities, and applicable discounts.
- [x] Provide an option to return an unpaid job order from POS to the queue so the Team Leader can correct the service (`admin_override_queue_status` fixed in `20261128211000_fix_admin_override_queue_events.sql`).
- [x] Ensure corrected job orders can return to POS without creating duplicate transactions or charges.
- [x] Synchronize For Payment records between Carwash Queue and POS. Resolve the discrepancy where the queue shows four records but POS only shows two.

## 5. Notes & Feedback
- [x] Retain only a simple Notes feature (`note_type = 'general'`).
- [x] Remove Like, Dislike, General, and other unnecessary feedback categories.

## 6. Detailing
- [x] Investigate and fix the duplicate coating issue (`ceramic-coating` archived; single active catalog coatings; Detailing picker shows 0 duplicates).
- [x] Verify the Polish service and its workflow, including its display and pricing where applicable (`Polish` active at ₱2,500 base with size prices `small`/`medium`/`large`/`extra_large`).

## 7. Final Verification & System Polish
- [x] Review every file affected by the checklist revisions.
- [x] Verify all affected buttons, forms, functions, API calls, and database operations against live Vercel + live Supabase.
- [x] Test the revised workflow using the appropriate user roles and permissions (see `docs/ALL_USERS_VERIFICATION_CHECKLIST.md`).
- [x] Verify that data remains synchronized across affected modules.
- [x] Ensure existing working functionality is not broken by the revisions.
- [x] Perform lint, type checking, production build, and functional + live DB E2E tests.
- [x] Do not mark any checklist item as completed until it has been implemented and verified.
- [x] Document resolved live DB blockers and exact verification scope before handing over the revisions.

---

## Live Production Verification Evidence (`https://hakumauto.vercel.app` & Supabase `lybxhpzzqqyqswvuwpxv` — 2026-11-28)

| Check | Result |
|---|---|
| `node scripts/e2e-live-mutations.mjs` (live Vercel + live Supabase, self-cleaning plate `QATEST9`) | **19 / 19 pass**, `0` uncaught page errors, `0` active `QATEST9` rows left |
| `BASE_URL=https://hakumauto.vercel.app node scripts/e2e-nav-walk.mjs` (all 11 ops roles) | **127 / 127 pass**, `0` backend 4xx findings |
| `BASE_URL=https://hakumauto.vercel.app node scripts/e2e-revision-qa.mjs` | **14 / 14 pass**, `0` uncaught page errors |
| Public Domain Lock (`https://www.hakumautocare.com`) & Customer Portal (`/signin`, `/account/*`) | `prodChips = 0`, `/api/demo-login = 404`, `prodCustChips = 0`; Vercel preview customer portal `/account`, `/account/book`, `/account/queue`, `/account/loyalty` all pass (`pageErrors: []`) |
| Role spot checks (`asa`, `opslead`, `detailer`, `marketing`) | `asa` & `opslead` see POS `Itemized Breakdown`/`Modify`/`Return to Queue`; `detailer` has no dead `Payslips` link; `marketing` CRM has no Like/Dislike categories |
| Live DB Migrations Applied & Verified | `20261127200000_revision_qa_checklist_fixes.sql`, `20261128203000_ops_lead_for_payment_resync.sql`, `20261128205500_fix_require_present_crew_trigger.sql`, `20261128211000_fix_admin_override_queue_events.sql` |
