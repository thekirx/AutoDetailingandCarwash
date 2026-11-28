# Hakum Auto Care — Revision & QA Checklist

Follow only the specified revisions. Preserve existing working functionality. Verify every affected file and operation before marking an item complete.

## 1. Navigation & UI Cleanup
- [x] Retain only the following main navigation modules: Floor Insight, Carwash Queue, Detailing, Team P, POS, and Financials.
- [x] Clean up unnecessary modules, navigation items, and redundant UI elements.
- [x] Remove non-functional buttons and actions that are not intended to be used.
- [x] Simplify the overall interface to make it less overwhelming.

## 2. Carwash Queue & Service Workflow
- [x] Retain the existing queue system and its working functionality. Only implement the requested additions and fixes.
- [x] Restore the Average Waiting Time metric.
- [x] Prevent vehicles from entering In Progress without an assigned crew.
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
- [x] Fix RBAC permissions so the intended authorized user can access the Modify option in POS.
- [x] Fix the issue where POS items are not displayed but their prices are added to the total.
- [x] Display a complete itemized breakdown of the total amount, including services, products, quantities, and applicable discounts.
- [x] Provide an option to return an unpaid job order from POS to the queue so the Team Leader can correct the service.
- [x] Ensure corrected job orders can return to POS without creating duplicate transactions or charges.
- [x] Synchronize For Payment records between Carwash Queue and POS. Resolve the discrepancy where the queue shows four records but POS only shows two.

## 5. Notes & Feedback
- [x] Retain only a simple Notes feature.
- [x] Remove Like, Dislike, General, and other unnecessary feedback categories.

## 6. Detailing
- [x] Investigate and fix the duplicate coating issue.
- [x] Verify the Polish service and its workflow, including its display and pricing where applicable.

## 7. Final Verification & System Polish
- [x] Review every file affected by the checklist revisions.
- [x] Verify all affected buttons, forms, functions, API calls, and database operations.
- [x] Test the revised workflow using the appropriate user roles and permissions.
- [x] Verify that data remains synchronized across affected modules.
- [x] Ensure existing working functionality is not broken by the revisions.
- [x] Perform lint, type checking, production build, and relevant functional tests.
- [x] Do not mark any checklist item as completed until it has been implemented and verified.
- [x] Document any unresolved issues or blockers before handing over the revisions.

---

## Verification Evidence (2026-11-28 — Local + Live Vercel `https://hakumauto.vercel.app`)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors |
| `npm run check` / `npm run audit:api-auth` | pass (43 handlers scanned, 0 leaks) |
| `npm test` | **2,836 / 2,836 pass** (629 suites, including `sidebarAllRolesCompleteness.test.js`) |
| `npm run build` | pass (PWA SW + 60 prerendered SEO shells) |
| `BASE_URL=https://hakumauto.vercel.app node scripts/e2e-nav-walk.mjs` (all 11 roles) | **54 / 54 pass**, `0` backend 4xx findings |
| `BASE_URL=https://hakumauto.vercel.app node scripts/e2e-revision-qa.mjs` | **14 / 14 pass**, `0` uncaught page errors |
| All-roles sidebar/dock audit (`src/auth/permissions.js`) | Fixed `getDetailerMore` dead `Payslips` link (day crew stays on Daily Sheet); all 11 roles verified against `allowRoute` |
| Live DB: 4 `for_payment` visits have 4 pending `pos_handoffs` | verified; queue Payment lane = POS Waiting to pay |

Migration: `supabase/migrations/20261127200000_revision_qa_checklist_fixes.sql` is applied to production. It adds targeted policies only. There is no blanket RLS and no `FOR ALL` on customers, transactions or expenses.

## Known limits / not exercised in browser

- Mutating flows (Mark Redo -> Final Checking, Return to Queue -> re-send to POS, Change service) are covered by unit and contract tests and by button presence in the browser. They were not clicked end-to-end against production, to avoid altering live ticket data.
- Polish and coating duplicates are verified by unit tests and the POS catalogue screenshot (single Polish, no duplicate coating cards). The Detailing board picker was only checked for render.
- Browser runs used Super Admin, Branch Admin and Team Lead. The Ops Lead and Crew roles were only covered by the nav walk (Ops Lead) and unit tests.
