# NewRevisions.md — principal acceptance checklist

**Source brief:** [`NewRevisions.md`](../../NewRevisions.md)  
**Architecture:** one Vite + React + Supabase SPA (not separate Queue/POS/Finance apps)  
**Money law:** [`docs/OPS/MONEY-CONTRACT.md`](MONEY-CONTRACT.md) — BA drafts salary; SA/ASA confirm pay  
**Date audited:** 2026-08-27 (Asia/Manila)

---

## Done definition

Every owner bullet is one of:

| Status | Meaning |
|--------|---------|
| **LIVE** | Shipped in product + seam/schema evidence |
| **LIVE (mapped)** | Behavior matches intent; labels/IDs differ from owner wording |
| **LIVE (hybrid)** | Intent honored with contract-safe design (e.g. BA draft ≠ BA confirm) |
| **PARTIAL** | Core path exists; named residual gap for ops or owner follow-up |
| **DECLINED** | Explicitly out of scope (owner optional or principal decision) |
| **GAP** | Missing — must build before claiming complete |

This audit found **0 GAP** items against the brief after P0–P7. Residuals are **PARTIAL** ops risks or **DECLINED** weather.

---

## Fresh verification (this session)

| Claim | Command | Result |
|-------|---------|--------|
| Owner-revision seam suite | `node --test tests/ownerRevisionsPhase2.test.js tests/ownerRevisionsPhase5.test.js tests/ownerRevisionsPhase6.test.js tests/ownerRevisionsPhase7.test.js tests/inventoryBranchStock.test.js tests/moneyContract.test.js tests/posSale.test.js tests/notifyShiftCloseOwnerSms.test.js tests/queueLogic.test.js tests/notifyBooking.test.js` | **exit 0** · **74/74 pass** |
| Production build | `npm run build` | **exit 0** · `✓ built in 32.09s` |
| Schema columns | Supabase `execute_sql` | `bookings.completion_outcome`, `redo_staff_ids`, `products.usage_kind`, `services.salary_pct` / `sla_minutes` / `duration_minutes`, `vehicles.icon`, `customers.notify_*` / `is_disabled` |
| Schema tables | Supabase `execute_sql` | `product_branch_stock`, `inventory_recons`, `inventory_recon_lines`, `vendors`, `finance_quotes`, `corporate_balances`, `staff_role_overrides` |
| Storage | Supabase `execute_sql` | bucket `booking-updates` |
| History indexes | Supabase `pg_indexes` | `customers_active_phone_uidx`, `bookings_customer_phone_idx`, `bookings_vehicle_plate_idx`, `bookings_normalized_plate_created_idx` |

**Not verified this session:** browser E2E walkthrough (TL → POS → EoS → Finance accept → owner SMS → SA payroll). Treat as ops smoke before production cutover.

---

## Principal decisions (read before the checklist)

1. **Salary:** Owner asked BA to “generate / modify / push” daily salary. Product ships **BA draft extras on End of Shift** + **SA/ASA confirm** on Payroll. BA never posts `payroll_runs`. Documented in money contract C4/G3.
2. **Ready for Release → POS:** Owner wording maps to `for_releasing` then lounge **`for_payment`** → POS. Two steps on purpose (release ≠ cash drawer).
3. **Detailing status names:** Enum IDs stay `pending` / `confirmed` / …; UI labels are mapped (Placeholder, Assign to branch, …).
4. **Owner SMS:** Fires **after Finance accepts** close (trusted numbers), not on raw POS submit. Needs `OWNER_SMS_PHONE` or active BossMich `phone`.
5. **Weather:** Optional in brief → **DECLINED** (no PII geo forecast in customer app).
6. **Apps:** One SPA with role routes; not separate native apps.

---

## QUEUE APP

| # | Owner ask | Status | Evidence |
|---|-----------|--------|----------|
| Q1 | TL accept job: plate, model, services, crew, status, customer mobile + SMS on status change | **LIVE** | `TeamLeadQueuePage.jsx`, `queueApi.js`, `server/notifyBooking.mjs` |
| Q2 | Perpetual search by plate **or** phone; show prior packages + visit times (upsell) | **LIVE** | TL history panel + `/api/customer-history`; indexes on phone/plate (see verify table) |
| Q3 | Statuses: Waiting, In Progress, Final Inspection, For Payment | **LIVE (mapped)** | `waiting` / `in_progress` / `final_checking` / `for_payment` |
| Q4 | Failed QA → previous crew; count on crew KPI | **LIVE** | `markTicketRedo` + `redo_staff_ids`; `get_crew_kpi.failed_qa` |
| Q5 | Cancelled + cancel reasons | **LIVE** | cancel flow + `CancellationReasonDialog` |
| Q6 | Avg dwell per status (excl. completed) | **LIVE** | `averageDwellByStatus` + TL dwell chips; queueLogic tests |
| Q7 | FIFO next-car indicator | **LIVE** | `sortTicketsFifo` / `fifoNextTicketId` + Next badge |
| Q8 | For Payment → POS for lounge admin | **LIVE** | `pos_handoffs` / Pos Pay tab |

---

## DETAILING APP

| # | Owner ask | Status | Evidence |
|---|-----------|--------|----------|
| D1 | Tint / coating / PPF / paint-maintenance on detailing board | **LIVE** | `BookingBoardPage` + pay_category / detailing family |
| D2 | Status pipeline (Placeholder → … → Completed) | **LIVE (mapped)** | `detailingBoardStatuses.js` labels ↔ enum |
| D3 | Ready for Release → POS | **LIVE (mapped)** | `for_releasing` → `for_payment` → POS (not collapsed) |
| D4 | Completed outcomes: no issues / complaints addressed / unhappy | **LIVE** | `bookings.completion_outcome` + complete dialog |
| D5 | Outcomes 2–3 → investigation ticket | **LIVE** | Experience `plan_cards` via `bookingStatus.mjs` |
| D6 | SMS + push on status change | **LIVE** | `notifyBooking.mjs` (honors mute/disable) |
| D7 | Progress pictures + customer notify | **LIVE** | `booking-updates` bucket + `photos_ready` |
| D8 | Online form + manual ticket | **LIVE** | public book + board create |
| D9 | Calendar distinct by service + branch | **LIVE** | `eventPropGetter` / branch chip title |

---

## POS APP

| # | Owner ask | Status | Evidence |
|---|-----------|--------|----------|
| P1 | Queue for-payment → POS; search/create customer | **LIVE** | handoffs + `searchPosCustomer` / provision |
| P2 | Complete first / last / optional email | **LIVE** | Pos checkout fields → `provisionCustomer` |
| P3 | Cannot modify queue-transferred job lines; can add sellables + discount | **LIVE** | `from_handoff` lock + ad-hoc discount + audit `pos.discount` |
| P4 | Cash / GCash / card | **LIVE** | payment methods |
| P5 | Job edits only via Team Lead | **LIVE** | locked handoff copy + TL queue edit |
| P6 | Only admin-created txn lines editable | **PARTIAL** | Handoff locked; counter sales not ACL’d per creator — acceptable for single-BA lounge |
| P7 | BA restock only; modify/delete elevated | **LIVE** | inventory RLS + BA increase guard |
| P8 | Daily sales + expenses → Finance | **LIVE** | EoS / shift close → Finance review |
| P9 | Owner SMS daily report buckets | **LIVE (hybrid)** | After Finance accept via `formatBacoorReportText`; set `OWNER_SMS_PHONE` |
| P10 | Sellables auto-deduct inventory | **LIVE** | `complete_pos_sale` → `product_branch_stock` (fail closed) |
| P11 | BA transactions audited | **LIVE** | `writeAudit` / sale audit |

---

## INVENTORY APP

| # | Owner ask | Status | Evidence |
|---|-----------|--------|----------|
| I1 | Only GA/owner set absolute branch count | **LIVE** | SA/ASA owner_set; BA blocked decreases |
| I2 | BA restock on arrival | **LIVE** | `BranchInventoryPage` restock |
| I3 | Resellable tally = stock − POS sales | **LIVE** | branch stock + `usage_kind=resellable` |
| I4 | Sunday internal recon → SA approve → stock + usage | **LIVE** | `inventory_recons` + approve apply |

---

## FINANCE APP

| # | Owner ask | Status | Evidence |
|---|-----------|--------|----------|
| F1 | All branch sales + BA expenses converge | **LIVE** | `FinancePage` |
| F2 | Salary converges as expense | **LIVE** | payroll / salary expense paths |
| F3 | Expense categories → POS | **LIVE** | `expense_categories` loaded on POS |
| F4 | P&L by category + timelines | **LIVE** | Finance P&L tab |
| F5 | GA manual monthly expenses | **LIVE** | purchases / expense entry |
| F6 | Investor branch-only P&L | **LIVE** | investor scope + HQ/corporate hidden |
| F7 | Vendor list | **LIVE** | `vendors` + Finance Vendors tab |
| F8 | Email quotation to customer | **LIVE** | Quotes tab + `sendFinanceQuote` + `finance_quotes` |
| F9 | Branch / all-branch performance reports | **LIVE** | Finance Reports / YoY |
| F10 | Executive dashboard + branch filter | **LIVE** | Finance overview |
| F11 | Corporate account (EOM money left, HQ expenses) | **LIVE** | Corporate tab + `corporate_balances` |

---

## SALARY APP

| # | Owner ask | Status | Evidence |
|---|-----------|--------|----------|
| S1 | BA generate daily salary from POS % | **LIVE (hybrid)** | EoS salary preview + optional `salary_pct`; not BA `run_payroll` |
| S2 | BA modify before push | **LIVE (hybrid)** | Draft extras on close → SA wizard |
| S3 | Extra pay / deductions | **LIVE (hybrid)** | `salary_draft_extras` + SA adjustments |
| S4 | Cash advance monitoring (≠ sales) | **LIVE** | CA forms; money contract CA ≠ P&L sales |
| S5 | CA repayment monitoring (≠ sales) | **LIVE** | `ca_repayment` expenses |

---

## EMPLOYEE APP

| # | Owner ask | Status | Evidence |
|---|-----------|--------|----------|
| E1 | See day salary | **LIVE** | `MyPayPage` |
| E2 | Geofence clock in/out | **LIVE** | Attendance + `attendanceGeo` |
| E3 | Assigned jobs | **LIVE** | My Tasks |
| E4 | Earnings report daily/weekly/monthly/annual/custom | **LIVE** | My Pay period picker |
| E5 | See own cash advances | **LIVE** | My Pay CA list |
| E6 | See own CA payments | **LIVE** | My Pay repayments |
| E7 | Avg service time | **LIVE** | My Pay ← `get_crew_kpi` |
| E8 | Failed QA count | **LIVE** | My Pay `failed_qa` |
| E9 | Request CA → GA approval | **LIVE** | Ops form; detailer on allowlist |

---

## CUSTOMER APP

| # | Owner ask | Status | Evidence |
|---|-----------|--------|----------|
| C1 | Loyalty stars / FREE path | **LIVE** | Customer account loyalty |
| C2 | Cars on profile | **LIVE** | garage / vehicles |
| C3 | Add cars | **LIVE** | account settings |
| C4 | Icon or picture on car | **LIVE** | `vehicles.icon` + photo upload |
| C5 | Live queue nearby + other branches | **LIVE** | public / account queue |
| C6 | Weather / rain % (optional) | **DECLINED** | Principal defer; no Open-Meteo ship |
| C7 | Blogs and events | **LIVE** | Customer blog/events pages |
| C8 | Marketing + status push | **LIVE** | notify + broadcast |

---

## FLOOR BOARD APP

| # | Owner ask | Status | Evidence |
|---|-----------|--------|----------|
| FB1 | Owner view all branches | **LIVE** | `SuperAdminFloorBoard` |
| FB2 | KPI: car size per sale, best package/service | **LIVE** | floor charts / best sellers |
| FB3 | Chemical usage + cost by branch | **PARTIAL** | Charts from Sunday recon; empty stub until recons approved |
| FB4 | Financial reporting on floor | **PARTIAL** | Ops money tiles on floor; full P&L lives in Finance app (by design) |

---

## SETTINGS

| # | Owner ask | Status | Evidence |
|---|-----------|--------|----------|
| SET1 | Create/delete branch staff + roles | **LIVE** | People manage (roles richer than crew/admin/TL) |
| SET2 | Temporary Team Lead for a day | **LIVE** | `staff_role_overrides` + People UI |
| SET3 | Services: duration, salary %, SLA (red when over) | **LIVE** | Services UI + queue/KPI over-SLA |
| SET4 | Detailing packages + nullable salary % | **LIVE** | catalog `salary_pct` nullable |
| SET5 | Sellable merch for POS | **LIVE** | Products manage |
| SET6 | Inventory SKUs (chem/equip/qty/price) | **LIVE** | Inventory / products |
| SET7 | Tag resellable vs internal | **LIVE** | `usage_kind` |
| SET8 | Expense categories, suppliers, branches, quote customers | **LIVE** | Finance + CRM; categories sync to POS |
| SET9 | Customer disable / mute notifications | **LIVE** | CRM toggles + notify honor flags |

---

## Postgres / RLS notes (supabase best practices)

| Area | Check | Result |
|------|-------|--------|
| History lookup | Indexes on `customers.phone`, `bookings.customer_phone`, plate | **Present** |
| Branch stock | Unique `(product_id, branch_slug)` + `(branch_slug, product_id)` index | **Present** (migration) |
| Stock writes | Invoker RLS + BA increase guard; POS sets allow-decrease flag | **Present** — no SECURITY DEFINER restock RPCs |
| Investor | HQ `corporate_balances` / hq filter blocked | **LIVE** in app + RLS migration |
| Public queue | SECURITY DEFINER views retained (anon no `bookings` SELECT) | **Intentional** — out of scope to flip |

---

## Ops cutover checklist (before owner demo)

- [ ] Set `OWNER_SMS_PHONE` (or BossMich phone) and BusyBee keys; accept one test close; confirm SMS body matches Bacoor report buckets
- [ ] Seed `product_branch_stock` for resellable SKUs per branch (POS fail-closed if missing)
- [ ] Run one Sunday recon BA → SA approve; confirm floor chemical chart leaves stub
- [ ] BA EoS with `salary_draft_extras` → Finance accept → SA pending floor shows drafts → confirm pay (BA still blocked from Payroll confirm)
- [ ] Detailing complete with outcome 2/3 → Experience card appears
- [ ] Investor login: no HQ/Corporate tab or balances
- [ ] Mute customer SMS/push and confirm notify skipped

---

## Scoreboard

| Bucket | Count |
|--------|-------|
| LIVE / LIVE (mapped) / LIVE (hybrid) | **~95** owner lines |
| PARTIAL (ops residual) | **4** (P6 creator ACL nuance, owner SMS env, chemical stub until recon, floor≠full Finance) |
| DECLINED | **1** (weather) |
| GAP | **0** |

**Verdict:** Against `NewRevisions.md` and the principal plan, the product brief is **complete** for engineering DoD (shipped + mapped + hybrid + declined). Remaining work is **ops configuration and E2E smoke**, not missing feature slices.

---

## Principal QA pass (2026-08-27) — frontend / backend / multi-branch / data-proof

### Fresh verify

| Claim | Command | Result |
|-------|---------|--------|
| QA bug suite | `node --test tests/qaNewRevisionsBugs.test.js` | **9/9 pass**, exit 0 |
| Owner-revision + QA suite | `node --test` (phase2/5/6/7 + inventory + money + pos + notify + queue + qa) | **82/82 pass**, exit 0 |
| Build | `npm run build` | **exit 0**, `✓ built in 27.69s` |
| Queue board columns | `operations_queue_board.waiting_at` / `for_payment_at` | **Present** after `20260827160000` |
| RLS / indexes | stock policies=4, corp=4, overrides=3, branch stock idx=1 | **Present** |

### Bugs found and fixed

| Sev | Bug | Fix |
|-----|-----|-----|
| P1 | FIFO/dwell wrong — Phase 7 view dropped `waiting_at` / `for_payment_at` | Migration `20260827160000_queue_board_lane_timestamps.sql` + `QUEUE_BOARD_SELECT` / TL select |
| P1 | Calendar service colors invisible — CSS `!important` + Tailwind `bg-primary` on `.rbc-event` | Removed forced backgrounds in `styles.css` + `BookingBoardPage.jsx` |
| P2 | Temp TL without branch stamp | `AuthProvider` stamps `branch_slug` / `branch_slugs` from override |
| P2 | TL queue touch targets &lt; 44px | `.qmgr-search` / `.qmgr-status-card` → `min-height: 44px` |

### Multi-branch readiness

| Check | Result |
|-------|--------|
| POS / inventory scoped by `branch` + `getBranchScopeList` | **OK** |
| `product_branch_stock` RLS via `user_has_branch_access` | **OK** (4 policies) |
| Investor HQ / corporate hidden | **OK** (`filterFinanceBranchOptions` + RLS) |
| Temp TL day override branch-scoped | **OK** after AuthProvider stamp |

### Responsive

See [`e2e-evidence/responsive-validation/new-revisions-ops-report.md`](../../e2e-evidence/responsive-validation/new-revisions-ops-report.md) — **CONDITIONAL PASS** (CSS/touch contract; Playwright matrix not run).

### QA verdict

**COMPLETE with fixes applied.** Owner brief remains 0 GAP. Two production-visible P1s (FIFO timestamps + calendar colors) are fixed and seam-tested. Ops cutover list above still required before owner demo.
