# Hakum Auto Care — revised request (aligned to the live system)

**Status: product brief is complete in code.**  
Sales role is **kept** as bookings-only (Part E option 1). Planner / POS / My Tasks share Hakum **bay-ticket** chrome (navy, paper, gold stub). POS dashboard and the Bacoor daily close now split merch into coffee / accessories / clothing / other. Live data seeding stays out of scope.

**Related plans (do not treat as unfinished work):**

| Document | What it is | Status |
|----------|------------|--------|
| `newrequest.md` | Parts 1–9: RBAC, POS shell, queue, crew, finance, planning settings, CRM, KPI, hardening | Marked complete in that file and in `SYSTEM_GAPS.md` |
| Planner rebuild (Aug 2026) | Tasks, categories, proof, Review, calendar, forms/events | Shipped |
| `SYSTEM_GAPS.md` | Production ops (SMTP, secrets, Playwright, rate limit, observability) | Outside this product brief |

**Finish line for this request:** every checkbox in [Remaining work](#remaining-work-plan) is `[x]`, and the matching unit tests pass. Populating live shop data is **not** part of that finish line unless Super Admin asks.

---

## How the live system works (source of truth)

### Roles

| Role key | Display | What they actually get |
|----------|---------|------------------------|
| `BossMich` | Super Admin | Full ops |
| `assistant_super_admin` | Assistant Super Admin (ASA) | Grants in `staff_profiles.permission_grants` (including `planning_edit`) |
| `admin` | Branch Admin | Assigned branches via `branch_slugs` / `staff_branch_assignments`. Floor, queues, POS, attendance, inventory, reviews, audit, **Planner**. |
| `team_lead` | Team Lead | Floor, queues, attendance, crew, KPI, Planner (assigned + fill allowed forms) |
| `staff` | Carwash crew | Attendance, My Tasks, Planner (assigned tasks; Forms tab is visible) |
| `detailer` | Detailer | My Detailing queue + attendance. Multi-branch. Not a Planner assignee in the task modal today. |
| `video_editor` | Video editor | Nav: Calendar + My Tasks. Planner tabs: **Tasks + Calendar only**. |
| `marketing` | Marketing | CRM, Bookings, Planner, Notifications, History |
| `investor` | Investor | Finance + Reports only, scoped to assigned branches |
| `sales` | Sales | Bookings + History. **Still in the app.** `newrequest.md` wanted this role removed; later work kept it for the detailing bookings board. |

Sales, Detailer, and Investor do **not** use Planner as a home.

### Planner (what shipped)

- Route: `/operations/planning`
- Tasks: `plan_cards` with optional `category_id` and `due_at` (not `due_date`)
- Categories: `plan_categories` (name, color, position). Boards stay a workspace filter (Planner / Equipment / Cash Advance). Complaint boards stay hidden.
- Assignees: `plan_card_assignees`. Statuses: `todo` → `in_progress` → `for_review` → `done`. Proof is optional (note and/or photo). Skip proof → `done`.
- Proof photos: private bucket `plan-proofs`, path `{uid}/{cardId}/file`
- Review tab: global inbox of `for_review` rows. Accept → `done`. Send back → `in_progress`.
- Calendar: tasks + bookings (`scheduled_start`) + published events. Form due dates use `calendar_at`.
- Forms: four fixed templates (equipment, cash advance, complaint, events RSVP). Not a freeform builder. Event page design stays in Content Admin.
- Editors: Super Admin, Branch Admin, ASA with `planning_edit`.

### Money and POS

- All paid work lands in POS (`pos_sales`). Detailing is not a second cash register.
- POS tabs: Checkout, Pending, Expenses, Cash Advance, Dashboard, Services, Merch.
- Expense kinds include carwash / detailer / tinter salary, daily, monthly, other-branch.
- Cash advance: staff submit the ops form; SA / ASA / Branch Admin approve or decline on the POS Cash Advance tab.
- Compensation defaults (Settings → Compensation): wash pool **35%**; ceramic shirt deduction ₱500; card fee **3.5%**; crew solo **20%**; crew+detailer **10% / 10%**. Checkout has toggles for free shirt, card, crew assisted, detailer assigned.
- Bacoor daily close: `src/lib/bacoorDailyReport.js` (queue/carwash, coating, PPF, tint, refreshments, accessories, clothing, salaries, approved CA).

### Detailing pipeline (bookings)

Maps to `booking_status`. Labels:

1. Booking Placeholder (`pending`)
2. Assign to branch (`confirmed`)
3. Vehicle intake (`waiting`)
4. In progress
5. Final checking
6. For releasing
7. For payment
8. Completed
9. Cancelled (not a board column; allowed status)

### People / attendance

People (`/operations/people`) is the unified account page. Create/edit includes role, branches, `attendance_enabled`, `geofence_enabled`, `employment_type` (`permanent` | `on_call`).

---

## Original request vs live system

Legend: **Done** = in code and covered by tests. **Partial** = exists but does not match the request. **Missing** = not built. **Ops** = not a code task.

### Floor board

- [x] Rename “crew on shift” → **Carwash crew on shift**
- [x] Administrative roster tiles (Marketing, Video editor, Branch Admin, ASA, Team Lead) with hover names
- [x] Detailing operations summary cards on the floor (separate from wash lanes)

### Accounts and attendance

- [x] Detailer role: assigned detailing queue, multi-branch, attendance + geofence toggles, permanent / on-call
- [x] Video editor and Marketing roles with the same People toggles
- [x] Attendance and geofence on/off per employee (crew, admin, ASA, and other clock roles)
- [ ] **Ops:** “populate real data” for those accounts — Super Admin creates people in People; this is not a code feature
- [x] Video editor Planner: **nav** is Calendar + My Tasks; Planner page tabs are Tasks + Calendar only
- [x] Branch Admin: Planner is in Command nav (`/operations/planning`)
- [x] Staff Planner nav opens Tasks (`/operations/planning`), not Forms
- [x] My Tasks (`/operations/my-tasks`) uploads a **photo** to `plan-proofs` (optional note + optional link fallback)

### Planner (board + calendar + proof)

- [x] Super Admin / ASA (`planning_edit`) / Branch Admin: create, edit, assign, categories, optional deadline, optional proof
- [x] Assign to crew, Team Lead, video editor, marketing (and admins). Detailer is **not** in the assignee picker
- [x] Assignee flow through **for review** with timestamps
- [x] Board view + calendar view
- [x] Review inbox (not Setup)
- [x] Staff / TL / marketing: assigned tasks only on the board; calendar shows assigned tasks + published events
- [x] Video editor: hide Forms / Events on the Planner page (nav already hides them)
- [x] Unify proof: photo upload on My Tasks, same as Planner (optional link fallback kept)
- [x] Visual redesign of Planner chrome (Forms/Events/Review/POS/My Tasks share bay-ticket styling: gold stub, navy pills, paper tickets)

### Finance and POS

- [x] Total sales = POS paid sales (including detailing, merch, coffee, sellables)
- [x] Queue app sales vs counter buckets (carwash / coating / tint / PPF / refreshments / accessories / clothing)
- [x] Payment methods: Cash, GCash, card
- [x] POS expenses (daily, salaries, monthly, other-branch) + Cash Advance approve/decline
- [x] Cash advance also appears in finance / Bacoor report
- [x] POS category stats on dashboard
- [x] Compensation engine + Settings customization + POS ceramic toggles
- [x] Bacoor daily sales report builder
- [x] Finance hover: charts show **₱ amount and % of total** (`shareOfTotal`)
- [x] POS merch/inventory: family filters (coffee / accessories / clothing / other), 2-col tickets, Inventory bay-ticket chrome
- [x] POS dashboard + Bacoor close: paid sales feed the report; merch splits into coffee / accessories / clothing / other (sellables stays the product rollup)
- [x] Cash advance daily close uses **approve day** (`resolved_at`), including overnight submit → next-day approve
- [x] POS family tiles wrap 2-col on phones / 4-col from 768px; Planner/POS pills wrap; 44px tap targets on POS tabs

### KPI and Failed QA

- [x] Cancelled jobs, avg in_progress → done, avg wait, Failed QA count
- [x] Team Lead **Failed QA** button (final checking → redo / in progress)
- [x] Customer SMS + push on redo (`booking.redo.customer`, editable in Notifications)
- [x] KPI hover: stats popover with sample size and share of range (`kpiStatHover`)
- [x] Default SMS/push is an apology (“we are sorry”). Copy remains editable in Notifications

### Detailing queue UI

- [x] Status names match Team Lead / Floor (placeholder → intake → … → completed)
- [x] Detailing queue UI: bay-ticket chrome (navy/gold stubs, same pipeline labels)

### Reviews and customer vehicles

- [x] After completed work, customer can rate overall / app / services / detailing
- [x] Reviews page for Super Admin, ASA, Branch Admin (`/operations/reviews`)
- [x] Customer can add a vehicle with photo (`vehicle-photos`) and format validation

### People, RBAC, investor, ASA/BA

- [x] Unified People page for employees and admins
- [x] Any employee can be assigned to one or many branches (role rules apply)
- [x] Investor: Finance + Reports only
- [x] ASA: audit + floor (via grants / admin roles)
- [x] Branch Admin: own assigned branches, including audit and floor
- [x] `sales` role kept as bookings-only (see Part E)

### CRM insights

- [x] Top 20 customers by spend + CSV export
- [x] Date + branch filters
- [x] Per branch and per service tables
- [x] Separate **top detailing** vs **top wash/packages**
- [x] Explicit **total booking sales** KPI (paid sales with `booking_id`) + CSV on the new tables

### Compensation (formula — already in code)

Wash / packages:

`pool = day_sales × wash_pool_pct` (default 35%)  
Split across on-shift crew + Team Lead by attendance weight (`present` = 1, `late` = 0.7).

Ceramic coating:

`net = sales − shirt(₱500 if toggled) − card_fee(3.5% if toggled)`  
- Detailer assigned: crew `ceramic_crew_split_pct` (10%), detailer `ceramic_detailer_split_pct` (10%)  
- No detailer, crew did the job: crew `ceramic_crew_solo_pct` (20%)

Super Admin edits these in Settings → Compensation. Team Lead can see crew compensation on Crew.

---

## Remaining work plan

Do these in order. One part per implementation pass. Do not start the next part until the gate for the current part is green.

### Part A — Planner access holes (small, high confusion)

**Done when:** each role’s Planner **nav and tabs** match the matrix below; My Tasks proof matches Planner photo proof.

| Role | Nav | Planner tabs |
|------|-----|----------------|
| Super Admin / ASA+`planning_edit` / Branch Admin | Planner | Tasks, Calendar, Forms, Events, Review |
| Team Lead / Marketing | Planner | Tasks, Calendar, Forms, Events (no Review) |
| Staff | My Tasks + Planner → **Tasks** | Tasks, Calendar, Forms, Events (no Review) |
| Video editor | Calendar + My Tasks | **Calendar + Tasks only** |
| Detailer / Sales / Investor | No Planner | — |

- [x] Add Planner to **Branch Admin** web nav
- [x] Staff Planner link opens Tasks (`/operations/planning`), not Forms
- [x] `plannerTabsForAccess` hides Forms + Events for `video_editor`
- [x] My Tasks proof: upload to `plan-proofs` (same as Task modal). Optional note + optional link fallback
- [x] Gate: extend `tests/plannerBoard.test.js` + `tests/permissions.test.js` + `tests/planningUi.test.js`

### Part B — CRM insights split

**Done when:** Insights shows (1) total booking sales, (2) top wash/packages, (3) top detailing, still with date/branch filters and CSV.

- [x] Split `aggregateLineItemsByFamily` by wash vs detailing
- [x] Add booking-sales total from paid sales that have `booking_id`
- [x] CSV includes the new tables, not only top 20 customers
- [x] Gate: `tests/crmPart7.test.js` + `tests/hakumRedesignLibs.test.js`

### Part C — Finance hover percentages

**Done when:** Finance overview tooltips show **₱ amount and % of the chart total**.

- [x] One helper (`shareOfTotal` on `financeData.js`) — do not duplicate formatter in JSX
- [x] Gate: `tests/financeData.test.js`

### Part D — Failed QA customer copy (optional, 10 minutes)

**Done when:** default `booking.redo.customer` SMS/push is an apology Super Admin can still edit.

- [x] Change default template text to an apology
- [x] Gate: `tests/notificationTemplates.test.js`

### Part E — Sales role decision (product, not code until decided)

**Decision: keep** `sales` as bookings-only (option 1). No migration.

- [x] Record the decision here, then implement only if option 2

### Explicitly not in this plan

| Item | Why |
|------|-----|
| Populate live employee/task/POS rows | Super Admin / shop ops |
| Planner or POS visual redesign from scratch | Bay-ticket chrome shipped for Planner, POS, KPI, detailing board, inventory |
| Second form builder | Four templates are the product |
| Drop `sales`/`cashier` Postgres enum labels | Zero rows; enum drop is painful (`SYSTEM_GAPS.md`) |
| SMTP, Playwright E2E, Redis rate limit, Sentry | `SYSTEM_GAPS.md` production ops |
| GraphQL / Xero sync | Rejected |

---

## TDD seams (confirm before writing new tests)

No new tests until these seams are agreed. Existing tests stay.

| Seam (public module) | Behavior to lock |
|----------------------|------------------|
| `src/lib/plannerBoard.js` → `plannerTabsForAccess` | Tabs by `{ canEdit, role }` |
| `src/auth/permissions.js` → `getOperationsNav` | Branch Admin includes Planner; staff Planner URL; video editor unchanged |
| `src/lib/crmInsights.js` / `crmInsightsExport.js` | Booking sales total; wash vs detailing split; CSV |
| `src/lib/financeData.js` | Hover payload: amount + percent |
| My Tasks proof helper (extract if needed) | Same proof fields as Planner (`proof_url` from storage path or signed upload) |

Reply **`continue part A`** (or B/C/D) after confirming those seams. Implementation will be red → green on that seam only.

---

## Verification (this implementation)

| Command | Result |
|---------|--------|
| `node --test tests/hakumRedesignLibs.test.js tests/clientOpsFixes.test.js` | **20 pass, 0 fail, exit 0** (red first: missing `approvedCaForCloseDay` / CSS wrap / migration) |
| `node --test tests/**/*.test.js` | **598 pass, 0 fail, exit 0** |
| `npm run build` | **exit 0**, Vite built in 24.15s |

## Completeness check

| Layer | Status |
|-------|--------|
| `request.md` product checkboxes | Done except **Ops:** Super Admin creates real people in People |
| Parts A–E | Done (Sales role kept) |
| Bay-ticket chrome (Planner / POS / KPI / detailing / inventory) | Done |
| POS dashboard merch buckets vs Bacoor | Done |
| Daily close uses today’s paid sales + **approve-day** cash advances | Done (`resolved_at`) |
| POS/Planner mobile wrap + 44px taps | Done |
| Trigger helpers not callable as anon RPCs | Done |
| Production ops (SMTP, Playwright, Redis rate limit, Sentry) | Out of this brief (`SYSTEM_GAPS.md`) |
| Live shop data | Super Admin / People — not a code feature |

---

## Appendix — original notes (unedited)

Floorboard revisions

crew on shift to carwash crew on shift
also for the roster,administrative crew marketing, video editor branch admin and ASA avaibales and crews , Team lead and when hovered will show the names.
below jobs on the floor , make a detailing operations summary cards.

Make a account for detailers, and they can see they assign detailing from bookings, and can be assigned to multiple branches, toggle also attendance, and geofencing, and also when creating toggle on call or permanent and make real data for this.

also add accounts video editors, marketing  and also mak sure they have toggle on and off for attendance and geofencing, for video editors only calendar they can see and planner (task assigned to them) and real populated data since planner is super admin can assign ASA to the employees like crew TL, video editor and marketing. For the statuses, only up until for review and proof of submition photo or link with complete time stamps and on planner task tab and make sure there is board view and calendar view and compelte system.
Make sure toggle on and off for crew/admin/ASA for the geofencing and also attendance is also toggle on and off for the attendance complete employee system.

for financial also when hovered show breakdown total and also percentage.Total sales = sales from POS, even detailing since detailing will come from POS anyway and also the merch and coffess and accesries and cleaning sellables from POS.
Queue app sales = Carwash sales only, counter/pos sales = make it detailing sales, add coffee sales(includes refreshments like soft drinks), merch/accessories, sellables.

POS should have submition of expenses(car wash salary, inter salary, detailier salary, others(like shipments and etc.) basically day to day expenses and monthly expenses basically make a whole system for this inside the POS. also seperate tab and properly designed and formatted also for cash advance, since employee can submit a form from cash advance make a full system for the cash advance and also would show a accept or decline in the POS for the cash advance tab. SA/ASA/Branch admin for their own branch. Make sure cash advance is also in the financeTotal sales
Car wash Sales
Nano Ceramic Tint Sales
Ceramic Coating Sales
Paint Protection Film (PPF) Sales
Coffee / Refreshment Sales
Accessories Sales
Hakum Clothing Sales
Cash Advance Request
Other Branch Expenses
Mode of payment:
Cash
Gcash
Credit / Debit Card

Also fix proper categories for POS, carwash services/packages, detailing, coffee and refrehments, merch and acccesories (sellables car freshener,car wash stuffs, cleaners ,shiners).

FOR KPI no. of canceled jobs, average time per service/packeges(inprogress to final checking), avg waiting service/packages. no of failed QA (when TL back to final checking  -> in progress). when hovered will show stats. There should be a button for TL for Failed QA(is only for the services and packages) when to bring back.  then notifiy the client that we are sorry. SMS and push notif. also take note message is editable in the notifications.


Also for account creation, basically any employee can be assigned to any branch, and FULLY RBAC can be changed.


FOr detailing queue, fix the UI and statuses make sure it matches the team lead(much correct) and also car wash queue and consistency with the naming. this is for detailing, Booking Placeholder, assign to branch, vehicle in take(means the car arrives is in the shop), In progress, final checking, for releasing, for payment, completed , cancelled.


When a car is completed will show a button in the client, rate our services overall experience with the app and services/packages, detailing and also make sure it's fully functional and make a new page for SA/ASA and branch admin reviws pages.


Also make a unified page for the SA for all the users, including the employee(crew, TL, marketing video editor,  and admins this is where  createion of accounts and RBAC and attendance is seperate

FOR Crew(can see time in and time out basically attendance in general daily, weekly and monthly filters. and number of workings hours and number of days late, total compensation based on the sales.BAsically services/packages they received 35% of the total sales of the day both crew and team lead will receive this is automatic in the POS. and if they are assigned also in detailing like ceramic coating portion So put a toggle in POS if it's for example detailing(Ceramic coating) toggle a 20% to the crew if they are assigned. and fully customaizable by the super ADMIN , Team lead part of the computation for the branch they are assigned for example in a day the whole branched totaled 20k for the services and packages SALARY AND COMPUTATION:  35% on total services and packages / Available team lead and carwash crew on that day and depends on the time in since basically if they are late to the service they will receive lower percentage and because let's say a the car arrived before you and you were not there but late but you will still work on that car. Same logic for the team lead, but in the view of the team lead can see the crew salaries on their account also since team lead gives the salary to them Detailing salary logic Total Ceramic coating sales - 500 pesos if with free shirt (when applicable)- 3.5% for credit card transaction (when applicable) = Remaining sales *.20%  There should be toggle if car wash crew will get 20% or 10%
- if there is a detailer assigned, the detailer gets 10% and car wash crew gets 10%
- if there is no detailer and car wash crew worked on the job 100%, carwash crew gets 20%
Make sure this whole system and in relation do this is fully customizable by the super admin and make sense and provide the complete detailed flowcahrt and formula and whole process in every scenario and correct and would reflect the data correctly and try to populate the data correctly.


Redesign the whole POS For easier user experience, and proper filters and proper tabs like for pending payments from the services/packages and detailings(bookings) and also and also proper per branch and also to POS for a particular branch for proper data handling and data proof. and proper dashboard and also bascially eevrything including the inventorymanagement , and also the merch and accesories POS. for Inventory not all of it sellables, basically make a full ccategory and properly populated also and a MAIN POS. Make a full POS System. complete and fully customzable.


Make sure to also make an investor account will only see financials and report and can see to branch they are assigned.

BACOOR SALES REPORT
‎AUGUST 11,2026
‎
‎━━━━━━━━━━━
‎Sales Report Summary
‎━━━━━━━━━━━
‎Square Sales: 11,620
‎Downpayments:
‎CA Collected:
‎Total Gcash: 3,560
‎Credit Card:
‎Total Expenses: 4,293
‎Total Cash Left: 3,767
‎
‎━━━━━━━━━━━
‎Daily Sales Income
‎━━━━━━━━━━━
‎Queue App Sales: 10,780
‎Car Wash Sales: 10,780
‎Ceramic Coating Sales:
‎PPF Sales:
‎Ceramic Tint Sales:
‎Refreshment Sales: 620
‎Car Accessories: 220
‎Hakum Clothing:
‎
‎━━━━━━━━━━━
‎Expense Enumeration
‎━━━━━━━━━━━
‎Carwash Salary: 3,773
‎Detailer Salary:
‎Tinter Salary:
‎
‎Approved CA:
‎Darel-500
‎
‎Daily Expenses:
‎ice-20
‎━━━━━━━━━━━
‎Cash Advance Payment
‎━━━━━━━━━━━

ASA has access on audit and also floor board, for branch admin only their branch admin.

 Marketing CRM, for add insigts top 20 customers, add total booking sales, top service/packages, top detailing, Sales per services/packages and detailing. also for the isignts full filters and date and export to csv.
‎
For customer app customer can add vehicle and also photo for customziability and also also input and error validation that it follows the format.
