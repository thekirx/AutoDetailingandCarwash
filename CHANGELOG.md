# Changelog

## 2026-10-09 - Finance categories and vendors: full edit for SA and ASA, and add them from New bill

- **Categories tab is full CRUD:** Add, **Edit** (code, name, kind, needs approval), **Archive / Restore** and Delete, for Super Admin and ASA with Finance write (the same rule as the `expense_categories` RLS). It shows each category's code and status. Before, it could only add and delete, could not set a code, and deleting a category that bills used failed with a raw foreign-key error even though the dialog said "Existing bills keep their category".
- **Archive instead of delete:** new `expense_categories.is_archived`. Deleting a category that is on bills or expense reports now says why and offers Archive. Archived categories stay on old bills and the P&L but leave the New bill, expense report and POS sheet pickers (`activeAccounts`), except on a line that already uses one.
- **Account 14 is protected:** shift-close review posts salaries to code 14 (`review_daily_sheet`) and `run_payroll` falls back to the first Payroll account, so a trigger refuses recoding, re-kinding, archiving or deleting it (renaming is fine). Category codes are now unique. Migration `20261009180000_expense_categories_crud.sql`, applied; checked by impersonating ASA in a rolled-back SQL block (create, edit, archive, delete unused all work; duplicate code, account 14 changes and deleting a used category are refused). No new security advisor findings.
- **Add from the New bill form:** From ends with **+ New vendor…** and each Account list with **+ New category…**. Each opens the shared form (`FinanceVendorDialog`, `FinanceAccountDialog`), saves, and selects the new entry on that bill line. "No vendors yet. Add one in Finance › Vendors first" is now a button that adds the first vendor.
- **Vendors tab:** **Edit** added (name, contact, notes), plus plain error messages (`catalogWriteError`); the delete confirm says old bills will lose the vendor name and suggests Deactivate.
- Proof: `npm test` (1726 pass, 0 fail, 2 skipped; `tests/financeCategories.test.js`); `npm run build`; eslint on touched files; Impeccable detector clean; `node scripts/check-finance-categories.mjs` (32/32 as Super Admin and ASA, each step read back from the database: add, edit, duplicate code refused, used category delete refused with Archive, account 14 locked, archive hides it from the bill picker, + New vendor and + New category on a bill and the bill saved with them, restore, delete, vendor edit, phone width, no errors; every QA row removed; screenshots in `e2e-evidence/finance-categories/`).

## 2026-10-09 - CRM Insights: Most profitable days, and Days / Date / Branch filters

- **Three filters drive the whole Insights tab:** Days (Mon to Sun toggles, Every day / Weekdays / Weekends), Date (Today through This year, Last month, Last 3 months, or a custom range) and Branches (multi-select chips; branch-scoped roles pick within their own). A summary line reads the choice back, with **Reset filters**. Stats, Sales by hour, the service rollup, top customers, the per-branch table and CSV exports all follow them. The Date select now shows its label ("This month") instead of the raw value.
- **Most profitable days:** a **Best day** tile and a card ranking weekdays by average paid revenue per day (revenue divided by how many of that weekday fall in the range, up to today), the 5 best dates with the branch that led each, and a **By branch** weekday table shaded against each branch's best day. Revenue only (paid POS sales), so no cost or profit data reaches CRM roles. Helpers in `src/lib/crmInsights.js` (`insightsDateRange`, `aggregateSalesByWeekday`, `bestWeekday`, `weekdayBranchBreakdown`, `topSalesDates`).
- Proof: `npm test` (1722 pass, 0 fail, 2 skipped; `tests/crmInsightsDays.test.js`); `npm run build`; eslint on touched files; Impeccable detector clean; `node scripts/check-crm-insights-days.mjs` (26/26 as Super Admin and Marketing: September revenue ₱1,618,627, Weekends ₱518,779 and Weekends + Batangas ₱199,594 match the database; Best day Saturday; By branch lists exactly the branches that sold; Reset; phone width without sideways scroll; no errors; screenshots in `e2e-evidence/crm-insights-days/`).

## 2026-10-09 - Ops Lead: Queue home and view-only CRM; Team Lead ticket notes in every CRM profile

- **No Floor Board for Operations Lead:** the Floor link is gone, `/operations/dashboard` is refused (`canAccessFloorBoard` now excludes Ops Lead like Team Lead), and the role lands on the Queue (`redirectForRole`). Old Ops Lab links fall back to the Queue too.
- **CRM view only for Operations Lead:** CRM joins the Ops Lead nav (`canAccessCrm`), with the same read-only shell as Sales (`canEditCrm` excludes both): Directory, Smart groups, Insights, no SMS tab, no Edit profile / Message / Add vehicle / Register account. RLS gives Ops Lead read access to `customers`, `sales`, `loyalty_ledger` and `customer_memberships` only; a customer update as Ops Lead affects 0 rows.
- **Team Lead ticket notes in the CRM profile:** the Notes field on the Team Lead New ticket form saves to `bookings.notes`, but the CRM profile only read guest notes, so those notes never showed. The profile now loads `bookings.notes` and the Notes tab lists **Ticket notes** (one per visit, with the Team Lead's name, date, branch, queue number, plate and services) above guest notes (`ticketNotesFromBookings`). The New ticket form says the note shows on the customer's CRM profile.
- **Guest notes readable by every CRM role:** `customer_notes` select was limited to `is_staff()`, which leaves out Super Admin, ASA, Sales and Ops Lead (Super Admin and ASA could add a note and then not see it). It now covers every CRM reader plus ASA with `queue_all`. The Add note form shows only for CRM editors (Super Admin, ASA, Marketing). `staff_display_names` also answers for Ops Lead (network-wide, no branch assignments) so the note author resolves. Migration `20261009170000_crm_readers_ops_lead_and_notes.sql`, applied; checked by impersonating Ops Lead, Sales, Marketing, Super Admin and ASA in a rolled-back SQL transaction; no new security advisor findings.
- Proof: `npm test` (1716 pass, 0 fail, 2 skipped; `tests/operationsLead.test.js`, `tests/crmSmartGroups.test.js`); `npm run build`; eslint on touched files; `node scripts/check-opslead-crm-notes.mjs` (35/35: Ops Lead lands on Queue with no Floor link and `/operations/dashboard` refused; Ops Lead, Super Admin, ASA, Marketing and Sales each open the same customer from Directory View and see the Team Lead's ticket note with the author's name; Add note only for editors; no errors; screenshots in `e2e-evidence/opslead-crm-notes/`).

## 2026-10-09 - Sales gets the Queue (all branches) and a view-only CRM

- **Queue for Sales:** Queue and CRM join the Sales nav and dock (Bookings stays home). `/operations/queue` shows every branch with the branch filter, wash and detailing together (lanes: Assigned, Waiting, In progress, Final check). Wash tickets are plain view-only cards and rows; detailing tickets show "Open booking" and open the Bookings editor (`/operations/bookings?open=<id>&from=queue`: status, service, price), and closing the editor returns to the Queue. No New ticket; `/operations/queue/new`, Floor Board and KPI stay refused. Gates: `canViewQueueBoard`, `canEditQueueTicket` (`permissions.js`).
- **Detailing-only writes at every layer:** `/api/booking-status` refuses Sales on non-detailing bookings (`isBookingBoardRow` in `server/bookingStatusAccess.mjs`), and `bookings` insert/update RLS now lets Sales write only detailing-board services (migration `20261009160000_sales_detailing_only_writes.sql`, applied). Checked by impersonating Sales in a rolled-back SQL transaction: wash update 0 rows and wash insert refused; detailing update and insert allowed.
- **CRM view only for Sales:** Directory, Smart groups and Insights; no SMS tab (`?tab=sms` falls back to Directory), no Edit customer / Add vehicle / Message in the profile modal, no Register account (`canEditCrm`; `canAccessMarketing` now follows it). Sales keeps its existing customers / vehicles RLS writes because the invoker trigger `link_booking_to_masterlist` needs them to save a booking.
- **Queue lanes no longer squeeze cards:** a full lane let compact cards shrink until their text overlapped (all roles on the board). `.queue-lane-board-fit .floor-lane-body` now sizes rows to each card, like the Team Lead list.
- Proof: `npm test` (1713 pass, 0 fail, 2 skipped); `npm run build`; eslint on touched files; `node scripts/check-sales-queue-crm.mjs` (23/23 as Sales: nav, all-branch Queue, branch filter, wash view only vs detailing editable checked against the database, editor round trip, refused routes, CRM view only, no errors; screenshots in `e2e-evidence/sales-queue-crm/`).

## 2026-10-09 - Planner tabs fixed, Ops Lab retired

- **Calendar was blacked out:** a CSS rule merged by an earlier rebase gave `.planner-cal-toolbar` and `.planner-cal-dow` the task-modal scrim style (fixed, full screen, 48% navy), so a dark layer covered the Calendar tab for every role and swallowed clicks. They now style normally; `tests/planningUi.test.js` fails if a calendar part ever shares a fixed overlay rule again.
- **Calendar bookings:** the calendar read every non-archived booking (walk-in wash tickets included) in one capped request and ignored errors. It now pages, skips cancelled rows and shows only Bookings-board appointments: September is 45 chips, matching the database, instead of 1,178. A booking chip opens `/operations/bookings?tab=table&date=…` on that day (the old `?id=` link went nowhere); Bookings reads `?date=` into its custom range.
- **No silent load failures:** Planner board, categories, staff, templates, review and calendar errors now show a toast. Table rows open from the keyboard (the task title is a button with a focus ring).
- **Database matches the app** (migration `20261009150000_planner_rls_match_app.sql`, applied): `can_edit_planning()` now includes Ops Lead, whose Planner loaded empty before. New `can_submit_ops_form(kind)` mirrors `canSubmitOpsFormKind`, so crew, Team Leads, Marketing and Video now see the forms they may submit and can submit them (status `new`, as themselves, only published forms). Before, the Forms tab was empty for them and no staff submission had ever been saved. Investors still see and submit nothing. Checked by impersonating each role in a rolled-back SQL transaction.
- **Ops Lab retired:** `/operations/roadmap`, its nav links (SA, ASA, Branch Admin, Ops Lead, Branch Admin "More"), `/api/notify-ops-lab`, `server/notifyOpsRoadmap*.mjs` and `src/lib/opsRoadmap.js` are removed. Old links redirect to the role home. Ops Lead now lands on the Floor Board. The 16 unread `ops_lab.*` inbox rows were deleted (migration `20261009140000_retire_ops_lab_notifications.sql`); `ops_roadmap_*` / `ops_lab_*` tables are kept as history.
- Proof: `npm test` (1712 pass, 0 fail, 2 skipped; Ops Lab seams in `tests/operationsLead.test.js`); `npm run build`; `node scripts/check-planner-tabs.mjs` (SA, ASA, Branch Admin, Ops Lead, Team Lead, crew, Marketing, Video: every tab with no page errors, failed requests or error toasts; every Forms Preview / Results / Edit opens; calendar visible and clickable; screenshots in `e2e-evidence/planner-tabs/`).

## 2026-10-09 - CRM Smart groups filter builder and customer profile modal

- **Custom filters:** Smart groups now build any audience: who (visited, first visit / new customers, last visit, signed up, never visited) × when (last N days / weeks / months, more than N ago, between dates, month range, any time) plus min / max visits, min spend, branch and SMS-reachable. Presets include "New customers (30 days)" and "Lapsed 90+ days". Saved groups store the full filter (old `{mode, days}` groups still load). Sort, paging and CSV export.
- **Visit counts fixed:** a visit is now a completed booking dated by `completed_at`, one per visit group. Before, any non-archived booking counted, and the single capped request could drop rows; visits now load paged and branch-scoped. Bacoor "Visited in the last 30 days" goes from 448 to 424.
- **Customer profile modal:** View opens full history for marketing: KPIs (visits, lifetime value, average per visit, days since last, cadence, loyalty), usual branch, top services, every visit, POS purchases, vehicles, loyalty ledger and notes. It replaces the inline detail card; Directory View opens the same modal.
- Proof: `tests/crmSmartGroups.test.js`; `npm test` (1717 pass, 0 fail, 2 skipped); `npm run build`; `node scripts/check-crm-smart-groups.mjs` (18/18 against DB-computed counts as Marketing, screenshots in `e2e-evidence/crm-smart-groups/`).

## 2026-10-09 - Silent Failed QA, no "For releasing" step, read-only Investor

- **Failed QA is silent:** marking a ticket Failed QA (`redo`) and the redo pass (`in_progress` / `final_checking` while `redo_at` is set) send no customer SMS, inbox or push and no ops fan-out. One rule, `isSilentRedoNotify` in `server/notifyBooking.mjs`, guards the shared sender, so every caller is covered. `for_payment` and `completed` still notify after a redo. The `booking.redo.*` and `booking.for_releasing.*` templates are removed (migration `20261009130000_retire_redo_releasing_templates.sql`, applied).
- **"For releasing" removed from detailing:** the pipeline is now Booked → Intake → In progress → Final checking → For payment → Done. The Releasing lane, metric card and visit step are gone. Legacy `for_releasing` rows (0 live in prod) still render as "Releasing" and can only be completed or cancelled. Team Leads still stop at Final checking; Sales / Admin / SA send to payment.
- **Investor is read-only and branch-scoped:** nav is Floor Board, POS and Finance (plus Reports inside Finance). Floor Board hides the crew panel and has no links into Queue / Bookings. POS shows a view-only **Today** + **Sheet history** (`PosReadOnlyView`); an opened sheet has no Approve / Return. Finance shows "View only". People can assign investors to one or more branches. Staff names on sheets resolve through `staff_display_names` when the profile join is hidden by RLS.
- Test accounts: `investor@hakumautocare.com` (Bacoor) and `investor2@hakumautocare.com` (Batangas), password `HakumInvest2026!`.
- Proof: `npm test` (1709 pass, 0 fail, 2 skipped); RLS read scope and write denial checked by impersonating the investor in SQL; `node scripts/check-investor-readonly.mjs` (44/44, both accounts, screenshots in `e2e-evidence/investor-readonly/`).

## 2026-10-09 — POS Sheet history tab; Daily Sheet submit-any-time and optional cash advances

- **POS › Sheet history** (new tab beside Daily sheet, same roles): this branch's Daily Sheets as Weekly (Mon–Sun) / Monthly / Daily tables with per-period totals (net sales, expenses, salaries, net profit, drawer over/short, sheets waiting). From–To dates, quick presets (this week / month, last 30 / 90 days), status filter, search by date (`2026-10-09`, `Oct 9`, `Friday`), name or note, CSV export. Clicking a date opens it on the Daily sheet tab. Pure helpers `groupSheetsByPeriod`, `sheetHistoryRange`, `weekStart`, `sheetPeriodLabel` in `dailySheet.js`; `filterSheets` now also matches spoken dates (Finance gets it too). RLS already scopes `daily_sheets` reads to the branch, so no migration.
- **Submit any time:** the database and UI never had a shop-closed gate — rehearsed in a rolled-back transaction as a Branch Admin at 11:18 AM with no cash advances (status → submitted). The old copy "Submit when the shop is closed" now says it can be sent any time and that later sales are not on the sheet.
- **Cash advances are optional:** the section is labelled so and an empty list reads "You can leave this empty". A half-filled advance line (no staff / amount) still blocks submit; opening float and counted cash stay required. Expected cash = float + cash sales + advances paid back − expenses − salaries − advances given out.
- **Approval push:** unchanged and verified in code — `sheet_submitted` goes to Super Admin and every ASA with `finance_view` (inbox row + web push, tap → `/operations/finance?tab=sheets&sheet=…`). Ops note: no staff device has enabled push yet (only customer subscriptions exist), so until SA / ASA turn notifications on they get the in-app inbox row only.
- Proof: `tests/dailySheetHistory.test.js`, `node scripts/check-pos-sheet-history.mjs` (Branch Admin, real DB, read-only; screenshots in `e2e-evidence/pos-sheet-history/`).

## 2026-10-09 — Branch Admin captures the customer at POS (Team Lead no longer does)

- **Team Lead new ticket** is now three steps — vehicle, services, review. No name, phone or email. A known plate still brings its customer; otherwise the ticket is `Walk-in · PLATE` with no customer until payment. `validateQueueTicketIdentity` needs only plate + service.
- **POS order panel** has a **Customer** card on any ticket with no real customer (or a legacy `Walk-in` placeholder): mobile, email, first, last. Phone and email are the unique identifiers — typing either looks the customer up (`POST /api/provision-customer` with `lookup_only`) and fills the form; a new number creates one account (Auth + `customers`, set-password invite only when the account is new). Phone of one customer + email of another is refused (409), never merged. Blank = guest sale. Charge saves the customer first and stops on a conflict.
- **DB** (migration `20261009040000_pos_assigns_ticket_customer.sql`, applied): `send_queue_ticket_to_payment` no longer requires a customer; new RPC `assign_queue_ticket_customer(booking, customer)` (Admin / Super Admin / ASA with `pos`, branch-scoped) moves the whole visit group, the handoff, the pending transaction and the vehicle onto one customer and writes an audit row; the completion-SMS trigger ignores blank phones.
- **One customer at a time:** add-ons ring up on the open ticket and post in the same sale (same `booking_id` / `customer_id`, so they show in that customer's history). Opening a different ticket while add-ons are in the order now asks first instead of silently moving them.
- Provisioning no longer overwrites a real email with the synthetic phone-login address, no longer re-sends the invite SMS for an existing customer, and stores phones in canonical `09…` form.
- Proof: `tests/posTicketCustomer.test.js`, `tests/provisionIdentity.test.js`, `node scripts/e2e-pos-ticket-customer.mjs` (real DB, cleans up after itself, posts no sale). Not changed: status SMS before payment needs a phone, so tickets without one get no mid-wash SMS until the customer is saved.

## 2026-10-06 — Spoofed-location time-in blocked + CRUD create forms in dialogs

- **Geo time-in** now goes through RPC `geo_clock_in` (migration `20261006120000_attendance_geo_spoof_alerts.sql`). Faked or tampered fixes are blocked: automation, stale fix, no accuracy, typed coordinates, pasted branch pin, replayed coordinates. Each block writes `attendance_location_alerts` plus an inbox row for SA / ASA / the branch BA. Web push goes out via `notify-ops-event` `attendance_location_alert`, once per alert. The trigger rejects direct `source='geo'` writes. The Attendance page shows the error inline, and SA / ASA / BA see a Location alerts list.
- Honest limit: a web PWA cannot read Android Developer options or the mock-location flag. Realistic spoofed coordinates still pass.
- **Branches:** New branch is a dialog; the list has search and status chips with counts. The same button + dialog pattern now covers Products, Cars, SMS templates, Memberships (tier / stamp threshold / assign), Planning events, Services, Finance (vendors, categories, corporate, quotes, expense reports), People (custom role, temp TL), and Notifications (reminder rule, broadcast kind). Seam: `tests/crudCreateModals.test.js`.
- Touch / phone polish: `NamedSelect` is 44px tall below `xl`; selects use a 16px font on phones; finance toolbar selects are 44px; `.planner-v2` no longer overflows on phones.
- **Production DB:** `attendance_geo_spoof_alerts` applied. E2E leftovers with no money attached (10 bookings, 3 `E2E Customer …` rows) archived by `20261006130000_archive_e2e_leftovers.sql`; `TestName` / `test run` stay live because they carry a sale / transaction.
- Button handlers that `await fetch` without a `catch` no longer fail silently offline: one `unhandledrejection` listener in `src/main.jsx` shows a "Network error" toast.
- Docs: `docs/OPS/MONEY-CONTRACT.md` binding sections rewritten for the Daily Sheet (IDs kept, retired ones marked). Role epics and guides no longer describe My Pay / Payroll register / `canViewOwnPay` as current.

## 2026-10-06 — TL/BA Bookings floor board + maintenance check-in

- TL and Branch Admin Bookings use a Queue-style board: stage status cards (incl. Maintenance due count) + expandable car cards; TL never advances into Payment from the board.
- **Car arrived · Start intake** turns a maintenance schedule into a Paint Maintenance booking at Vehicle intake (`POST /api/maintenance-schedules` `action: 'arrive'`, size-priced, duplicate plate → 409). BA can now send reminders (branch-scoped).
- TL shell touch targets ≥44px (tabs, breadcrumb, bell, filters) and 16px phone form fonts. `scripts/_tl-responsive-validation.mjs`: 54/54 page × viewport checks pass (baseline 21/54).
- Docs: Team Lead / Branch Admin role guides, Bookings + Queue page guides, shop-day runbook (C1c), BusyBee code paths.
- Known gap: `/api/booking-status` has no transition check (TL could move Payment → Done outside the board UI).

## 2026-10-05 — Branch Admin POS counter hardened

- BA counter: merch/coffee only; queue ticket lines stay locked; pay queue + sell stay on one Checkout page.
- Client `sanitizeBranchAdminCart` / `assertBranchAdminCart`; RPC `assert_branch_admin_pos_cart` blocks BA walk-in bay services and BA discounts.
- Docs: `docs/guides/pages/pos.md` + POS checkout/gaps updated for Daily Sheet + combined counter.

## 2026-10-05 — Owner pack + FLOPS Daily Sheet cutover

- Regenerated [`docs/user-stories/USER-STORIES-OWNER.html`](docs/user-stories/USER-STORIES-OWNER.html) / `.pdf` from Daily Sheet night path (submit → Finance approve → books).
- `scripts/e2e-lifecycle-flops.mjs` waits on Daily Sheet UI (read-only today sheet); money writes stay on `e2e:daily-sheet-money`.
- Seam: `tests/e2eUiMoneyContract.test.js` asserts FLOPS is not still driving End of shift.

## 2026-10-05 — Daily Sheet doc cutover + push honesty

- Shop-day user stories, runbook, MONEY-CONTRACT triangle, Branch Admin guide, and role matrix now teach **Daily Sheet** (not End of shift / My Pay / floor payroll).
- Added [`docs/qa/ROLE-STORY-EVIDENCE.md`](docs/qa/ROLE-STORY-EVIDENCE.md). Push checklist: routing proven; **0 staff** devices subscribed. SMS not tested.
- `US-CLOSE-01` seam → `daily_sheets` unique `(branch, business_date)`; sheet_reviewed notifies only the submitting BA.

## 2026-10-05 — Future-branch + People RBAC readiness

- Dasmariñas production slug is now `dasmarinas` (coming soon); remapped orphan rows off `aud-xmyz95` and archived CRUD-test / probe branches.
- Staff can be hired onto coming-soon branches; Detailer / Video Editor get a branch picker; validation allows every role `provisionStaff` can create.
- Seam: `tests/futureBranchReady.test.js` + `isStaffAssignableBranch`.

## 2026-10-05 — Principal remaining-work audit (docs)

- Added [`docs/qa/REMAINING-WORK-2026-10.md`](docs/qa/REMAINING-WORK-2026-10.md): honest checked vs unchecked matrix (roles, stories, ops blockers, doc debt).
- BUG-048 marked **closed live** (public inquiry 405, Data Center 401). Fresh `npm test` 1465/1465, lint 0, build 0.
- Clarified September seed: CRM customers yes, customer portal auth no. Updated `PROJECT_STATUS.md` / `SYSTEM_AUDIT.md` — continue on doc cutover + ops proofs; soft-launch code still READY_WITH_OPS_BLOCKERS.

## 2026-10-04 — September 2026 test month, Team Lead final check fix, faster dashboards

- September 2026 test data for Bacoor + Batangas in production: 1,221 bookings (1,141 completed cars), 1,288 sales, maintenance schedules, crew attendance and 60 Daily Sheets reviewed by SA / ASA (approved, returned, reopened). Tagged and removable — see `docs/qa/SEPTEMBER-2026-SEED.md`. `scripts/verify-september-2026.mjs` checks queue, POS, sheets, P&L and Floor Board agree (23/23).
- Fixed: Team Leads and admins without a customer record could not move a car to Final check (foreign key pointed at customers); send to payment now stamps who sent it.
- Fixed: Floor Board returned an error for ASA on mobile and money dashboards took seconds — sales, bookings and queue history checks now run once per page load instead of once per row (same access for every role).
- New read-only role probe (`supabase/tests/daily_flow_role_probe.sql`, 20 checks) and read-access fingerprint (`supabase/tests/rls_read_fingerprint.sql`).

## 2026-10-04 — Dashboards: full money breakdown

- Floor Board › Sales and profit (SA / ASA finance view) follows the Timeline filter instead of only today: gross, net, transactions, average and posted net profit with % change vs the prior period (Today compares with yesterday up to the same time), net sales by hour, by-payment-method and by-service bars, deductions and costs, and a per-branch table (net, transactions, average, expenses, net profit, change) with a total row. Replaces the flat ₱ tiles for money viewers.
- POS Today (Branch Admin) adds discounts, refunds, money spent so far from the daily sheet, and top services.
- The money panel no longer reloads twice per timeline change.
- `_ops-pages-shots.mjs` waits for the page heading and `aria-busy`, and adds a Floor Board "3 months" shot with real sales.

## 2026-10-04 — Daily Sheet re-verification, names not codes, dashboard polish

- Branch names replace branch codes ("bacoor") on the close-of-day slip, Daily sheet header, sidebar / top bar scope, Branch Admin Queue View, Finance Home lists and the Floor Board branch label.
- Finance header net profit now shows its date window.
- Floor Board money and POS Today headline amounts sit under their labels (were pushed right).
- `e2e:role-qa` and `e2e:ui-money` match the product again (Queue is SA / ASA / TL / Ops Lead; Daily sheet replaces End of shift).
- New read-only `scripts/_ops-pages-shots.mjs`: full-page money dashboards at 375 / 768 / 1440.

## 2026-10-02 — Daily sheets: slip, filters, exports

- Close-of-day slip (Print / PDF, CSV, Excel) on POS › Daily sheet and the Finance review drawer.
- Finance › Daily sheets: search, submitted by, net profit range, quick dates, Excel and Print alongside CSV.
- Fixed every PDF export showing "Pop-up blocked".

## 2026-10-01 — Daily Sheet replaces End of shift, Payroll and My pay

- One sheet per branch per day: sales, expenses, salaries, cash advances, drawer count; submit → approve posts to the books once. See `docs/daily-sheet/README.md`.

## 2026-09-15 — Car size chart accuracy + bay size pricing

- Cars catalog sizes follow body footprint: **Small** = sedans/hatchbacks · **Medium** = crossovers · **Large** = SUVs/pickups/larger MPVs · **Extra Large** = full-size vans/people movers (e.g. Raize/Q2 medium, Civic/Corolla small, Tucson/Sportage large).
- Live `vehicle_catalog.size_slug` resynced for all 492 rows; inference + Cars UI copy match the chart.
- Wash, packages, and bay services now have S/M/L/XL `service_size_prices` (same 0.85 / 1 / 1.2 / 1.4 ratios as detailing). Inventory create defaults size pricing on for all four tiers.
- Legacy `sedan` maps to small for price lookup.
- DB advisors: covering FK indexes, RLS `auth.uid()` initplan fixes, revoke Ops Lab trigger RPCs from anon/authenticated.

## 2026-09-15 — Wash vs detailing catalog split hardened

- Online `/book` and `/api/public-book` accept detailing SKUs only (Ceramic / Tint / PPF / Paint Maintenance). Same-day wash and packages stay on the shop queue.
- Queue create and visit upsell reject detailing; ticket editor add-service lists bay Services & Packages only.
- Bookings board no longer treats legacy `pay_category=ppf` package rows as multi-day detailing. Live PPF film remains `pay_category=detailing`.
- Database CHECK constrains `services.pay_category` to the known catalog families.

## 2026-09-15 — PH car size on catalog, tickets, bookings

- Super Admin Cars stores `vehicle_catalog.size_slug` (Small / Medium / Large / Extra Large). Live Hakum rows are backfilled from the PH bay chart (Vios/City small, Civic/Xpander medium, Fortuner/Hilux large, Alphard/Hiace extra large).
- Picking make + model auto-selects that size on TL queue, bookings, public/account book, CRM, and garage. Staff and customers can override; service and package prices follow `bookings.vehicle_type`.
- Legacy garage values (`sedan` / `suv`) still map to pricing slugs. Seed upserts `size_slug`.

## 2026-09-14 — Floor, maintenance, people, BA view-only

- Floor Board shows Services & Packages and Detailing Services as separate lane strips. Branch-scoped Floor has the same split.
- Maintenance tab lists overdue/due-soon and un-notified plates. Notify client sends SMS/push to book paint maintenance. Set date marks the visit done and hides the plate until the next cycle. Search finds already-notified upcoming cars. TL can ticket a paint-maintenance booking.
- People: Crew / Team Leads / Admins / Office tabs, Create account modal, directory search/filter, attendance dashboard, Super Admin supervisor tag and reports-to.
- `/operations/crew` redirects to Attendance for every role. Branch Admin can open Queue and Bookings as view-only (no ticket/status writes).

## 2026-09-14 — Finance books honesty

- Default reporting window is last 30 days. An empty window names the last paid POS day and can jump to it. Custom ranges reject end-before-start and do not query inverted dates.
- Reports retention follows last paid in the same window; crew KPI is labeled as the current roster. Five primary tabs plus More; period/branch stay in the URL. Vendors no longer hang on a loading skeleton.
- Unposted crew pay and missing shift closes are cues that open Payroll / POS. Categories “Payroll / salary” is a P&L bucket, not commission %.
- Sales, bills, P&L, and Reports export CSV. Dashboard still offers CSV, Excel, and PDF. Quotes reject ₱0. The Finance guide Payroll step is a real link.
- Deferred: brand pass, Xero clone. Quotes and Corporate stay under More.

## 2026-09-14 — Payroll register honesty

- Wash pool drops merch/product/coffee lines. POS proof shows theoretical pool vs allocated and names missing attendance. Wizard and Rules amounts are pesos; owner % clamps to 0–100.
- Every period is date-checked. Settings → Payroll writes require Super Admin or ASA finance write. Inventory salary % copy matches the engine (paid on confirm).
- Deferred: server recompute of `run_payroll` amounts, pending-floor RPC gate, hybrid/custom salary math, brand pass.

## 2026-09-14 — POS money integrity

- Loyalty awards require a linked customer with an earned milestone; the RPC consumes stamps. Catalog prices are re-checked server-side; GCash/card need a payment reference.
- Branch Admin no longer sees POS Settings (SA / ASA `finance_write` only). Phone tab strip starts left so Sell is reachable. Cart drafts persist in session storage.
- Deferred: receipt/print, void/refund, add/remove payment-method rows, RPC payment-method allowlist.
