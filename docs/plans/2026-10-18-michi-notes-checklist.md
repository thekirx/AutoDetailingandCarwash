# Sir Michi notes — cross-check and build plan

Checked 18 Oct 2026 against the live app (not against the notes alone).
Source notes: `my notes.md`.
Last checklist pass: **19 Oct 2026** (C25 title is the heading and the browser tab).

Status key: **Done** · **Partial** · **Missing**

Do not rebuild a row marked Done. Partial means the seam exists and the requested behavior does not.

---

## A. Already done — do not rebuild

| # | Note | Evidence |
|---|---|---|
| A1 | Phone is required for customer sign-up | Onboarding and signup store `phone` before the account exists |
| A2 | Thumbs up opens that branch’s Google review | `CustomerAccountPage` + `google_review_url` |
| A3 | Expense account categories can be added, edited, archived | Finance → Categories (`expense_categories`) |
| A4 | Wash-pool % and detailing splits are settings | Settings → Daily sheet rules |
| A5 | Inventory sells from branch on-hand at POS | `redeem` and POS deduct `product_branch_stock` |
| A6 | Services, packages, and detailing prices are editable by SA/ASA | Services manage + size prices |
| A7 | Crew can clock in and clock out | Attendance (`checked_in_at`, `checked_out_at`) |
| A8 | Crew can open Planner and My Tasks | Crew nav |
| A9 | Cash-advance form and equipment-repair form exist | `opsForms.js` kinds `cash_advance`, `equipment_repair` |
| A10 | Cash advance moves drawer cash and is not profit | Daily Sheet `ca_release` / `ca_repay` |
| A11 | Birthday greeting SMS + push on the customer’s birthday | `birthdayGreetings.mjs` |
| A12 | One free birthday service per year, applied at POS | `customer_birthday_perks` + `is_birthday_award` |
| A13 | Friend code on detailing, points to the booker, discount from settings | Referral program (defaults 50 points / 3%, not a fixed 5%) |
| A14 | Detailing booking SMS differs for customer vs staff book | Detailing acknowledgement templates |
| A15 | Car-wash and detailing status SMS exist | Queue and booking status notices |
| A16 | Failed-QA jobs are excluded from some customer status texts | Notify path skips failed QA where coded |
| A17 | Tint Finder page exists | `/tint-finder`. The heading is Settings → Tint Finder → Page title (`config.pageTitle`). Blank stays **Tint Finder**. |

---

## B. Sir Michi — 18 Oct evening (build these)

### Crew app

- [x] **B1 Done** — Attendance day card shows **Sheet salaries** = sum of typed `salary` lines on today’s branch Daily Sheet via `crew_day_card_snapshot` (crew cannot SELECT sheets directly). Wash pool estimate stays as the unpaid live estimate.
- [x] **B2 Done** — Time in and time out.
- [x] **B3 Done** — Day card **Current car** from the signed-in user’s active/pending `queue_assignments` (plate · service · queue #). My Tasks still lists all assignments.
- [x] **B4 Done** — Day card **Failed QA** = distinct visits with `redo_at` today for the branch (same visit-dedupe idea as Floor Board).

### Planner

- [x] **B5 Done** — Thumbs down asks for a category and what happened, then files the published `customer-complaints` form (`submit_public_ops_form`). Thumbs up still opens the branch Google review.
- [x] **B6 Done** — That submission is a row on Planner → Forms (Customer Complaints). Staff push goes to `/operations/planning?tab=forms`. The old Complaints specialty board stays archived.
- [x] **B7 Done** — Cash advance form → planner. Super Admin or Assistant Super Admin taps Approve on the form results. `approve_cash_advance` mints a `CA` + 4 code and pushes it to the Branch Admin. Decline archives the request.
- [x] **B8 Done** — *Given out* on the Daily Sheet requires that code, and the amount must match the approved request. Paid back does not. The line is `ca_release` (drawer cash), not a P&L expense. A code already used on another sheet is refused.
- [x] **B9 Done** — Equipment repair stays planner Forms results (not its own board). Submit is **staff only** in `canSubmitOpsFormKind` + DB `can_submit_ops_form` (`equipment_repair` → `staff`). Verified in `tests/myCashAdvances.test.js`.
- [x] **B10 Done** — Ops Settings → Account saves staff `date_of_birth` via `save_own_staff_birthday` (locks after first save). Attendance nudges when missing. Includes admins.
- [x] **B11 Done** — Attendance **Birthdays this month** from `staff_birthdays_month` (branch roster). Today’s names get a banner.

### Birthday, queue, vouchers

- [x] **B12 Done** — After the Team Lead starts a car, the queue shows “Happy birthday — ask for their code” when that customer’s birthday is today. The code is not on the card. The customer gets an inbox notice, a push, and an SMS (`birthday_queue_start`).
- [x] **B13 Done** — New birthday codes last 7 days (`birthdayPerkExpiresAt`). Format `BD` + 4. Once a year stays on `perk_year`. Existing rows keep their old expiry; a missing code is filled in.
- [x] **B14 Done** — POS asks for the code and calls `birthday_code_matches` before the sale. `claim_birthday_perk` refuses a missing or wrong code. Staff cannot select the `code` column.
- [x] **B15 Done** — Once a year stays. The birthdate locks after the first save (portal check and `customers_lock_birthday`).
- [x] **B16 Done** — Voucher board at `/operations/vouchers` (SA/ASA). `promo_vouchers` + `promo_voucher_redemptions`. TL applies via `apply_booking_promo_voucher` (queue + detailing edit). POS calls `consume_booking_promo_voucher` after sale. Open tickets hold uses. Migration `20261019110000_promo_vouchers` (tables via MCP `promo_vouchers_tables`; RPCs applied live).

### Nav (18 Oct 10:11–10:35)

- [x] **B17 Done** — Month KPI (`/operations/kpi`) is `canAccessKpi`: Operations Lead (nav **Month KPI**) + Super Admin (route/deep-link; not on SA command menu — Floor Board keeps live wait/service/failed QA). Crew, TL, BA, ASA are denied. Month crew/compare/complaints stay on the KPI page (not mixed onto the live floor).
- [x] **B18 Done** — Reviews is off the menu. `/operations/reviews` redirects to Planner → Forms. Thumbs up opens Google. Thumbs down files the complaint form.
- [x] **B19 Done** — Audit sits in the Operations Insight group on the command sidebar.
- [x] **B20 Done** — Command sidebar groups are Floor Insight, Human Resource, Customers, Configuration, Operations Insight. **Vouchers** under Floor Insight for SA/ASA. KPI nuance closed in B17. Phone docks keep short labels.

**Floor Insight:** Carwash Queue · Detailing Schedule · Team Planner · Point of Sales · Vouchers · Financials · Human Resource · Customers · Configuration

**Configuration:** Branches · Services and Packages · Vehicle List (add models) · Detailing Packages · RBAC Delegation

**Vouchers:** SA/ASA board at `/operations/vouchers` (step 5 Done 19 Oct).

Command sidebar groups shipped 18 Oct (`permissions.js`). Reviews off menus. Audit under Operations Insight. Month KPI for Ops Lead (+ SA deep-link). `/operations/reviews` redirects to Planner → Forms.

---

## C. Earlier notes in the same file — still open

- [x] **C1 Done** — Request + SA/ASA approve + Daily Sheet code path already shipped. **My advances** at `/operations/my-advances` lists the signed-in user’s `cash_advance` submissions (waiting / approved / declined). Dock/nav for staff, detailer, BA, TL More, Ops Lead. Not a P&L expense.
- [x] **C2 Done** — Daily Sheet expense lines have **Paid from** Cash (drawer) or GCash (`paid_from`). GCash still counts in expense totals / P&L on approve; only cash-paid expenses reduce expected drawer cash. Migration `20261019140000_expense_paid_from`.
- [x] **C3 Done** — Settings → Daily sheet rules already label Detailing splits; `compensation.js` documents ceramic_* keys as legacy DB names. Product service names (Ceramic Coating SKU) stay.
- [x] **C4 Done** — Detailing board no longer has a List tab. Board, Table, Calendar, and Maintenance stay. Search and filters stay on Table.
- [x] **C5 Done** — POS size buttons use S / M / L / XL so four sizes fit the tile. The price line still says Small, Medium, Large, or Extra Large. Each button’s accessible name is the full size.
- [x] **C6 Done** — `/operations/monthly-payroll` (legacy `/operations/payroll` redirects here). SA/ASA with finance write post paid `salary_monthly` expenses to account 14 with Cash or GCash. Day crew pay stays on the Daily Sheet.
- [x] **C7 Done** — Branch stock tab removed. Merch product table shows **Branch on-hand**; edit dialog Assign / Set / Restock per branch. Sunday recon stays its own tab (`BranchInventoryPage`). BA-only still gets the full restock + recon board. Legacy `?tab=stock` → merch.
- [x] **C8 Done** — SA Lock / Unlock on Inventory (`app_settings.inventory_crud_lock`). Audit + inbox to every Super Admin. DB trigger `guard_inventory_crud_lock` blocks catalog / restock / recon for non-SA when locked; POS decrease (`hakum.allow_stock_decrease`) still runs. Migration `20261019150000_inventory_crud_lock`.
- [x] **C9 Done** — A task can link one form (`plan_cards.form_id`). The card shows the form name. Open results goes to Planner → Forms for that form, which already draws each answer as a card. Migration `20261019190000_plan_card_form_link`.
- [x] **C10 Done** — Attendance shows a day-of birthday banner for branch staff (including admins). No owner SMS. Push/inbox cron for staff not added (banner is the shop announcement).
- [x] **C11 Done** — Crew weekly attendance on the register + day-card sheet salary (B1). Planner for `staff` is Forms + Tasks only (`plannerTabsForAccess`); assigned cards only on the board (not full edit/configure).
- [x] **C12 Done** — Customers edit birthday + phone in Settings. Staff save birthday (B10) and **phone** via `save_own_staff_phone` on Account. Managers can still edit phone on People.
- [x] **C13 Done** — SA/ASA Configure categories with role checkboxes (`visible_roles`). Empty = all roles. Board filters + TaskModal use `filterCategoriesForRole`. Migration `20261019170000_plan_category_visible_roles` (applied). Tests: `tests/planCategoryRoles.test.js`.
- [x] **C14 Done** — Plate lookup already fills make/model. Queue / CRM guest notes show **author · date** via `staff_display_names` + `formatNoteAuthorDate` (`CustomerNotesPanel`).
- [x] **C15 Done** — Feedback, cash advance, equipment repair, and the detailing inquiry are editable published forms. Feedback is the existing `complaint` kind (`customer-complaints`); the planner kind label is Feedback. Thumbs down still files that form. Detailing jobs stay on the detailing board. The detailing inquiry form stays the booking form in Planner → Forms.
- [x] **C16 Done** — Promo voucher: only Team Lead applies on queue / detailing edit (`apply_booking_promo_voucher`). Birthday code stays POS-typed per B14 / C23 (not printed on the queue card).
- [x] **C17 Done** — Customer portal `vouchers.active` + `vouchers.history`; `CustomerVouchersPage` shows rules and history.
- [x] **C18 Done** — SA/ASA set max uses, date window, applies_to, percent or free on `VouchersPage`.
- [x] **C19 Done** — CRM `CustomerProfileDialog` is the admin customer file: personal details (incl. birthday), points/stamps, visits, purchases, vehicles, loyalty ledger, **Vouchers** tab (promo redemptions + birthday perks), and notes.
- [x] **C20 Done** — `REVIEW_DELAY_MS` = 15 minutes on the account rate card. Booking-reminders cron also runs `runRateVisitReminders` → BusyBee `lifecycle.rate_visit` (idempotent `rate_visit_<bookingId>`, 6h window). Diagram `docs/architecture/rate-visit-sms.workflow.html`: showcase deliver 9/9, visual-check pass (1440×900 through 2048×1320; perceptual review still pending). Tests: `tests/visitReviewDelay.test.js`, `tests/rateVisitReminders.test.js`.
- [x] **C21 Done** — Friend points and detailing discount % are `app_settings` via `referral_program_settings()`. Settings and Inventory show `ReferralProgramCard` (0–100% and points). Sir saves the number he wants. Starting default stays 50 points / 3%. Nothing hardcodes 5%.
- [x] **C22 Done** — Customer birthday locks after the first save. Staff birthdays shipped step 7.
- [x] **C25 Done** — Tint Finder heading is `config.pageTitle` on Settings → Tint Finder. Blank keeps **Tint Finder**. The public page, the step label, and the `/tint-finder` browser tab use that title. Settings → View Tint Finder opens that page. Points, free rewards, and visit rules are already Memberships settings; Sir types the numbers there.
- [x] **C24 Done** — Coffee, shirts, and other sellables can have optional sizes on create and edit. Each size is a name plus its own price (12 oz, M, XL). No sizes means the single price. POS shows those names on the tile and charges the picked size. On-hand stock stays one count per product, not per size. Migration `20261019200000_product_size_options`. Tests: `tests/productSizes.test.js`.
- [x] **C23 Done — RBAC matrix.** The 19 Oct sheet is `docs/OPS/RBAC-MATRIX.md` and `tests/rbacMatrix.test.js`. Owner and Super Admin are `BossMich` (full, including Floor Board). General Admin is `assistant_super_admin` (no Floor Board). Team Lead / Branch Admin / Marketing / Customer Rep (`sales`) use planner except a Cash advance board. Branch Admin queue + detailing are read-only; POS, finance, HR, and customer create/modify are on. Marketing is all-branches, queue/detailing/customers read-only, no HR. Customer Rep is all-branches, detailing read-only, CRM create/modify. Investor is read-only queue, detailing, POS, vouchers, finance — no floor, planner, HR, or customers. Crew is not on the sheet and keeps the crew dock. **People** (`/operations/people`) uses the sheet names (Owner / Super Admin, General Admin, Branch Admin, Customer Rep) and shows that role’s access under the picker. Marketing and Customer Rep are all-branches (no branch picker). A new General Admin saves Finance write and Planning edit on. Database write locks are migration `20261019180000_rbac_sheet_write_locks` (Branch Admin and Customer Rep cannot write bookings; Marketing cannot write customers). Points amounts and tint-finder title stay Sir’s settings screens.

---

## D. Build order

1. **Nav** — Done 19 Oct. B17–B20. Month KPI stays for Ops Lead (+ SA deep-link); live floor metrics stay on Floor Board.
2. **Thumbs down** — Done 19 Oct. B5, B6, B18. Reuses `customer-complaints`. No new table. Diagram `docs/architecture/thumb-down-complaint.workflow.html`: showcase deliver 9/9, visual-check pass (1440×900 through 2048×1320). The arrow from `submit_public_ops_form` to Planner forms has no extra label because that insert is the form row.
3. **Cash advance code** — Done 19 Oct. B7, B8. Crew list is C1 (`/operations/my-advances`). Diagram `docs/architecture/cash-advance-code.workflow.html`: showcase deliver 9/9, visual-check pass. Migration `20261019090000_cash_advance_approval_code` applied. Lucy is whoever holds Assistant Super Admin; no named account.
4. **Birthday code** — Done 19 Oct for the customer code. B12–B15, C22. Staff birthdays are step 7. Diagram `docs/architecture/birthday-code.workflow.html`: showcase deliver 9/9, visual-check pass (1440×900 through 2048×1320). Migration `20261019100000_birthday_perk_code` applied.
5. **Voucher board** — Done 19 Oct. B16, B20 Vouchers item, C16–C18, C23 voucher rules. Diagram `docs/architecture/promo-voucher.workflow.html`: showcase deliver 9/9, visual-check pass (1440×900 through 2048×1320; perceptual review still pending). Migration `20261019110000_promo_vouchers` + live RPCs. Tests: `tests/promoVoucher.test.js`.
6. **Crew day card** — Done 19 Oct. B1, B3, B4 on Attendance clock (`crew_day_card_snapshot`, `tests/crewDayCard.test.js`). Weekly dots already on the clock. No separate Archify (Attendance refinement, not a new money path).
7. **Staff birthdays** — Done 19 Oct. B10, B11, C10. Migration `20261019130000_staff_birthday`. Tests: `tests/staffBirthday.test.js`.
8. **Money leftovers** — Done 19 Oct. C2, C3, C6. Migration `20261019140000_expense_paid_from` + live RPCs. Tests: `tests/moneyLeftovers.test.js`, `tests/dailySheet.test.js` (GCash expected-cash). No new Archify (extends Daily Sheet / Finance bills).
9. **Inventory** — Done 19 Oct. C7 merch branch on-hand (no Branch stock tab), C8 SA lock + audit/inbox + DB guard. Tests: `tests/inventoryCrudLock.test.js`. Docs: `docs/guides/pages/inventory.md`. No new Archify (catalog UX, not a money-path).
10. **Customer file** — Done 19 Oct. C14 author·date on guest notes; C19 CRM profile = points + vouchers + notes + transactions + personal details. Tests: `tests/customerFile.test.js`. No new Archify.

11. **My advances + equipment repair** — Done 19 Oct. C1 `/operations/my-advances`; B9 staff-only equipment repair (already in RLS). Tests: `tests/myCashAdvances.test.js`.
12. **Staff phone** — Done 19 Oct. C12 `save_own_staff_phone` + Account UI. Tests: `tests/staffPhone.test.js`. Migration `20261019160000_save_own_staff_phone`.
13. **Crew planner + KPI + categories + rate SMS** — Done 19 Oct. C11 staff Forms+Tasks; B17/B20 `canAccessKpi`; C13 `visible_roles`; C20 15m UI + SMS. Tests: `planCategoryRoles`, `rateVisitReminders`, `visitReviewDelay`, scope matrices. Archify: `rate-visit-sms.workflow.html`.

14. **Referral + RBAC sheet** — Done 19 Oct. C21 settings card. C23 `docs/OPS/RBAC-MATRIX.md`. Tests: `tests/rbacMatrix.test.js`, `tests/salesRole.test.js`. No new Archify (a role table, not a flow).
15. **People labels + write locks** — Done 19 Oct. People shows the sheet names and the access line. Migration `20261019180000_rbac_sheet_write_locks` applied. Customer Rep can register a customer. Campaign SMS is Owner / Super Admin, General Admin, and Branch Admin.
16. **Detailing list, POS sizes, form link** — Done 19 Oct. C4 List tab removed. C5 S/M/L/XL on POS tiles. C9 `plan_cards.form_id`. C15 Feedback label on the complaint form. Tests: `tests/bookingTable.test.js`, `tests/plannerFormLink.test.js`. No new Archify (tab and label changes, not a new flow).
17. **Sellable sizes** — Done 19 Oct. C24 `products.size_options`. Optional, named, priced per size. POS `size_label`. No new Archify (catalog field, not a new money path).
18. **Tint Finder title** — Done 19 Oct. C25. Settings field `pageTitle`. Tests: `tests/tintFinder.test.js`. Points, free rewards, and visit rules stay on Memberships (`loyalty_program_settings`); Sir types those numbers. No new Archify.

People still matches the 19 Oct sheet (`src/auth/internalRoles.js`): sheet names, access line under the picker, Marketing and Customer Rep have no branch picker, a new General Admin stores Finance write and Planning edit on.

Each step needs one failing test before the change, then the same test green. Do not start step 5 until step 4’s code rules are written down (C23).

---

## E. Out of scope until Sir says otherwise

- Changing the saved friend discount. Sir sets it on Settings → Friend referral (default 3% until he saves another number).
- Per-branch point prices (already decided catalog-wide).
- Owner daily SMS (policy: no).
