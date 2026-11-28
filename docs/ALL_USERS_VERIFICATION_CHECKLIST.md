# Hakum Auto Care — All-Users Strict E2E Verification Checklist

Every item below must be verified by fresh command output, automated tests, and live browser/DB execution against `https://hakumauto.vercel.app` (and `https://www.hakumautocare.com` for public/domain-lock checks) before marking `[x]`.

---

## 1. Super Admin (`BossMich`)
- [ ] Sidebar shows all permitted Command modules (`Floor Insight`, `Carwash Queue`, `Detailing`, `Team P`, `POS`, `Catalog & Inventory` incl. `Vehicle List`, `Financials`, `Payslips`, `Employees`, `Customers`, `Rewards`, `Branches`, `Content`, `Settings`, `History`, `Notifications`, `System & Data`).
- [ ] Carwash Queue shows `Average Waiting Time`, `Failed QA` lane, `Mark Redo` (not `Failed QA`) action button, and `Modify assigned service`.
- [ ] Live Queue mutation: Start blocked without crew -> assign crew -> `In Progress` hides `Start Service` -> `Mark Redo` moves car into `Failed QA` -> returns from `redo` to `Final Checking` -> `Send to payment`.
- [ ] POS shows all 4+ synchronized `For Payment` handoffs across branches (`All branches`), full `Itemized Breakdown`, `Modify` (updating service + `pos_handoffs.amount_minor` + `transactions.amount_minor` with 0 duplicates), and `Return to Queue`.
- [ ] Customer Notes panel displays simple `Notes` without `Like`, `Dislike`, `General`, or feedback category dropdowns, and saves notes cleanly to `customer_notes`.
- [ ] Detailing service picker renders zero duplicate coating options and displays `Polish` with valid pricing.

## 2. Assistant Super Admin (`assistant_super_admin`)
- [ ] Opens `/operations/queue` home cleanly and reaches granted Command sidebar modules without 4xx errors.
- [ ] Can `Modify` service/price in POS, inspect `Itemized Breakdown`, and use `Return to Queue` without creating duplicate transactions.

## 3. Branch Admin (`admin`)
- [ ] Lands on `/operations/pos`, sees scoped `Carwash Queue`, `Detailing`, `Team P`, `POS`, `Financials`, `Catalog & Inventory` (`Restock Merch`, `Sunday Recon`), `Employees`, `Customers`, `My advances`, `Payslips`, `History`, `System & Data`.
- [ ] RBAC: Can click `Modify` and `Return to Queue` on branch POS tickets (`canModifyBookingServicePrice === true`, `canOverrideQueueStatus === true`).
- [ ] Security boundaries preserved: cannot delete customers, edit/delete expenses, write client `transactions`, or access `Data Center` (`allowRoute('data-center') === false`).

## 4. Operations Lead (`operations_lead`)
- [ ] Lands on `/operations/queue`, sees `Carwash Queue`, `Detailing`, `Team P`, `POS`, `Financials`, `Customers`, `My advances`, `Payslips`, `Month KPI`, `History`, `System & Data` (no Floor Board / Data Center).
- [ ] Can `Modify` service/price in POS (re-syncs `pos_handoffs`/`transactions` via `send_queue_ticket_to_payment` when `status = 'for_payment'`) and `Return to Queue`.

## 5. Investor (`investor`)
- [ ] Lands on `/operations/finance`, sees read-only `Carwash Queue`, `Detailing`, `POS`, `Rewards`, `Financials` (zero 4xx/5xx, no mutation controls).

## 6. Team Lead (`team_lead`)
- [ ] Lands on `/operations/queue`, sees `Average Waiting Time`, `FloorAppShell` dock (`Carwash Board`, `New`, `Attendance`, `Detailing Board` + `More`).
- [ ] Live Floor flow: Creates ticket -> cannot Start without crew -> assigns present crew -> `In Progress` hides `Start Service` and promotes `Final Checking` -> `Send to payment` creates/reuses single `pos_handoffs` + `transactions` row (0 duplicates after POS `Return to Queue` correction!).

## 7. Sales (`sales`)
- [ ] Lands on `/operations/bookings` (Detailing Board), sees `Detailing Board`, `Carwash Board`, `CRM`, `Planner`, `History`, `More: Payslips`; zero duplicate coatings and `Polish` available in service picker.

## 8. Crew / Staff (`staff`)
- [ ] Lands on `/operations/attendance`, sees `Attendance`, `Tasks`, `Forms`, `Advances`, `More: Floor` with zero 4xx errors.

## 9. Detailer (`detailer`)
- [ ] Lands on `/operations/bookings`, sees `Detailing Board`, `Attendance`, `Tasks`, `Advances` — **no dead `Payslips` link** in `More` (paid on Daily Sheet).

## 10. Marketing (`marketing`)
- [ ] Lands on `/operations/crm`, sees `CRM`, `Detailing Board`, `Planner Board`, `Alerts`, `More: Content, History, Payslips`; Customer Notes uses simple `Notes` without category dropdowns.

## 11. Video Editor (`video_editor`)
- [ ] Lands on `/operations/planning?tab=calendar`, sees `Calendar`, `Tasks`, `More: Attendance, Payslips` with zero 4xx errors.

## 12. Customer App & Public Domain Lock (`customer`)
- [ ] `https://www.hakumautocare.com/operations/login?qa=...` hides easy-login chips and `POST /api/demo-login` returns `404`.
- [ ] `https://hakumauto.vercel.app/operations/login?qa=...` renders easy-login chips and allows one-click QA sign-in.
- [ ] Customer account portal (`/account`, `/account/book`, `/account/queue`, `/account/loyalty`) and public pages load cleanly (`0` console/page errors, `check:portal` 12/12 + `check:customer` ok).
