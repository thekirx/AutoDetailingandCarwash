# Hakum Auto Care — All-Users Strict E2E Verification Checklist

Verified against live production (`https://hakumauto.vercel.app`), public domain lock (`https://www.hakumautocare.com`), and live Supabase (`lybxhpzzqqyqswvuwpxv`) on **2026-11-28**.

> **Honesty & Strictness Note:** During live DB mutation E2E, two real production SQL drift defects blocked floor/POS workflows until fixed and applied live:
> 1. `public.require_present_crew_on_start()` referenced `coalesce(old.status, '')` (`ERROR 22P02` on enum) and dropped `employees`/`employee_attendance` tables → Fixed in `supabase/migrations/20261128205500_fix_require_present_crew_trigger.sql` (uses `queue_assignments` + `staff_attendance`).
> 2. `public.admin_override_queue_status()` inserted into nonexistent `queue_events` columns (`event_type, actor_id, note, payload`) causing `Return to Queue` to fail on live DB → Fixed in `supabase/migrations/20261128211000_fix_admin_override_queue_events.sql` (maps cleanly to `booking_id, branch, old_status, new_status, changed_by, notes`).
> 3. Live verification re-ran after both live DB fixes with self-cleaning test plate `QATEST9` (`0` active `QATEST9` rows left behind).

---

## 1. Super Admin (`BossMich` — `bossmich@hakumautocare.com`)
- [x] Sidebar shows all permitted Command modules (`Floor Insight`, `Carwash Queue`, `Detailing`, `Team P`, `POS`, `Catalog & Inventory` incl. `Vehicle List` `/operations/inventory?tab=cars`, `Financials`, `Payslips`, `Employees`, `Customers`, `Rewards`, `Branches`, `Content`, `Settings`, `History`, `Notifications`, `System & Data`) — verified live via `e2e-nav-walk.mjs` (`35/35` routes, `0` 4xx) and `e2e-revision-qa.mjs`.
- [x] Carwash Queue shows `Average Waiting Time`, `Failed QA` lane, `Mark Redo` (not `Mark failed QA`) action button, and `Modify assigned service` — verified live via `e2e-revision-qa.mjs`.
- [x] Live Queue Redo workflow: Super Admin clicked `Mark Redo` on a `final_checking` ticket -> live DB set `status = 'redo'` and vehicle appeared in `FAILED QA` lane -> re-opened redo ticket and returned it directly to `final_checking` — verified live via `e2e-live-mutations.mjs` (`19/19`).
- [x] POS shows all synchronized `For Payment` handoffs across branches (`ABC124`, `ABC7643`, `NIK3577`), full `Itemized Breakdown`, `Modify`, and `Return to Queue` — verified live via `e2e-revision-qa.mjs`.
- [x] Customer Notes panel displays simple `Notes` without `Like`, `Dislike`, `General`, or feedback category dropdowns and saves to `customer_notes` (`note_type = 'general'`) — verified live via `e2e-live-mutations.mjs` and `e2e-revision-qa.mjs`.
- [x] Detailing catalog contains zero duplicate active coating entries and keeps `Polish` active with size pricing (`small` ₱2,500 base) while legacy `Ceramic Coating` (`ceramic-coating`) is archived (`is_active = false, is_archived = true`) — verified via live Supabase SQL + Chromium picker check (`15` options, `0` duplicates, `Polish` once).

## 2. Assistant Super Admin (`assistant_super_admin` — `assistant@hakumautocare.com`)
- [x] Opens `/operations/queue` home cleanly and reaches all `35` granted Command sidebar/tab modules with `0` backend 4xx errors — verified live via `e2e-nav-walk.mjs`.
- [x] POS ticket view renders `Itemized Breakdown`, `Modify`, and `Return to Queue` controls cleanly with zero page errors (underlying `admin_override_queue_status` + `updateTicketService` RPCs verified live via `e2e-live-mutations.mjs` and `tests/posModifySync.test.js`) — verified live via Chromium spot check (`asa: { hasItemized: true, hasModify: true, hasReturn: true }`).

## 3. Branch Admin (`admin` — `admin@hakumautocare.com`)
- [x] Lands on `/operations/pos`, reaches all `18` scoped routes (`Carwash Queue`, `Detailing`, `Team P`, `POS`, `Financials`, `Catalog & Inventory` `Restock Merch` & `Sunday Recon`, `Employees`, `Customers`, `My advances`, `Payslips`, `History`, `System & Data`) with `0` backend 4xx errors — verified live via `e2e-nav-walk.mjs`.
- [x] Live POS `Modify` & `Return to Queue` mutation (`QATEST9`): Branch Admin opened ticket with `Itemized Breakdown`, changed service via `Modify` to `Premium Drip Wash` (`bookings.final_price_minor = 30000`, `pos_handoffs.amount_minor = 30000`, `transactions.amount_minor = 30000`, `txCount = 1`, `0` duplicates), then clicked `Return to Queue` (`bookings.status = 'in_progress'`, `pos_handoffs.status = 'cancelled'`, `transactions.status = 'cancelled'`) — verified live via `e2e-live-mutations.mjs`.
- [x] Security boundaries preserved: cannot access `Data Center` (`allowRoute('data-center') === false`), delete customers, or bypass API auth (`npm run audit:api-auth` + unit/security suites).

## 4. Operations Lead (`operations_lead` — `opslead@hakumautocare.com`)
- [x] Lands on `/operations/queue`, reaches all `11` permitted routes (`Carwash Queue`, `Detailing`, `Team P`, `POS`, `Financials`, `Customers`, `My advances`, `Payslips`, `Month KPI`, `History`, `System & Data`) with `0` backend 4xx errors — verified live via `e2e-nav-walk.mjs`.
- [x] POS ticket view renders `Itemized Breakdown`, `Modify`, and `Return to Queue` cleanly (`opslead: { hasItemized: true, hasModify: true, hasReturn: true }`), and `send_queue_ticket_to_payment` live migration `20261128203000_ops_lead_for_payment_resync.sql` permits `operations_lead` to re-sync an existing `for_payment` booking on `Modify` without granting initial floor handoff — verified live via Chromium spot check + `tests/posModifySync.test.js` + live DB migration.

## 5. Investor (`investor` — `investor@hakumautocare.com`)
- [x] Lands on `/operations/finance`, reaches all `5` read-only routes (`Carwash Queue`, `Detailing`, `POS`, `Rewards`, `Financials`) with `0` backend 4xx findings — verified live via `e2e-nav-walk.mjs`.

## 6. Team Lead (`team_lead` — `teamlead@hakumautocare.com`)
- [x] Lands on `/operations/queue`, sees `Average Waiting Time` (`e2e-revision-qa.mjs`), and loads all `4` FloorAppShell dock routes (`Carwash Board`, `New`, `Attendance`, `Detailing Board`) with `0` backend 4xx errors — verified live via `e2e-nav-walk.mjs`.
- [x] Live full cycle E2E (`QATEST9`): Created ticket in `waiting` -> verified `Select crew above, then Start` button disabled before crew assignment -> ticked present Bacoor crew & `Save crew` -> verified live DB `in_progress` with `Start Service` hidden & `Final Checking` shown -> saved simple Customer Note -> transitioned to `final_checking` -> pushed `Send to payment` (`1` pending `pos_handoffs` + `1` `pending_payment` tx) -> after Branch Admin `Return to Queue`, changed service to `Express Package` -> `Final Checking` -> `Send to payment` -> verified `for_payment`, `amount = 50000`, `handoffs = 1`, `txs = 1`, **0 duplicates** — verified live via `e2e-live-mutations.mjs` (`19/19`).

## 7. Sales (`sales` — `sales@hakumautocare.com`)
- [x] Lands on `/operations/bookings` (Detailing Board), reaches all `5` permitted routes (`Detailing Board`, `Carwash Board`, `CRM`, `Planner`, `History`) with `0` backend 4xx errors — verified live via `e2e-nav-walk.mjs`.
- [x] Live catalog (`public.services`) & Detailing service picker verified to have `0` duplicate active coatings (`ceramic-coating` archived) and `Polish` active (`is_active = true, price_minor = 250000`).

## 8. Crew / Staff (`staff` — `staff2@hakumautocare.com`)
- [x] Lands on `/operations/attendance`, reaches all `4` permitted routes (`Attendance`, `Tasks`, `Forms`, `Advances`) with `0` backend 4xx errors — verified live via `e2e-nav-walk.mjs`.

## 9. Detailer (`detailer` — `detailer@hakumautocare.com`)
- [x] Lands on `/operations/bookings`, reaches all `4` permitted routes (`Detailing Board`, `Attendance`, `Tasks`, `Advances`) with `0` backend 4xx errors (`e2e-nav-walk.mjs`), and **zero dead `Payslips` link** in `More` drawer (`detailer: { hasPayslipsLink: false }` live Chromium spot check + `tests/sidebarAllRolesCompleteness.test.js`).

## 10. Marketing (`marketing` — `marketing@hakumautocare.com`)
- [x] Lands on `/operations/crm`, reaches all `4` permitted routes (`CRM`, `Detailing Board`, `Planner Board`, `Alerts`) with `0` backend 4xx errors (`e2e-nav-walk.mjs`); live Chromium check confirmed CRM loads with `hasFeedbackCategory: false` (no Like/Dislike dropdowns).

## 11. Video Editor (`video_editor` — `video@hakumautocare.com`)
- [x] Lands on `/operations/planning?tab=calendar`, reaches `Calendar` & `Tasks` routes with `0` backend 4xx errors — verified live via `e2e-nav-walk.mjs`.

## 12. Customer App & Public Domain Lock (`customer` — `demo.customer@hakumautocare.com`)
- [x] `https://www.hakumautocare.com/operations/login?qa=...` and `/signin?qa=...` render `0` demo chips and `POST /api/demo-login` returns `404` (`PROD_DOMAIN_LOCK: {"prodChips":0,"apiStatus":404}`, `prodCustChips: 0`) — verified live in Chromium.
- [x] `https://hakumauto.vercel.app/operations/login?qa=...` (`17` chips) and `/signin?qa=...` (`1` customer chip) allow one-click QA sign-in (`DEMO_LOGIN_ENABLED=true` on Vercel).
- [x] Customer portal routes `/account`, `/account/book`, `/account/queue`, and `/account/loyalty` all load cleanly after customer QA sign-in with `pageErrors: []` and zero 404s — verified live in Chromium + `npm run check:portal` & `npm run check:customer`.
