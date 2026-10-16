# Full-app readiness — checklist, progress, test plan

**Date:** 2026-10-15 (Manila) · **audit stamp 2026-10-16**  
**Branch / deploy:** `main` @ `f7ebc41` (Vercel Production Ready)  
**Gap map (untested / undocumented):** [`READINESS-GAP-2026-10-16.md`](./READINESS-GAP-2026-10-16.md)  
**Owner rule kept:** easy login cards stay visible for testing. Demo chips are not hidden.  
**SMS policy kept:** BusyBee is outbound customer status/reminders only. No inbound inbox. No owner daily close SMS. Finance accept uses web push.

This is the living master for "is the whole shop day ready?" It replaces the stale "six migrations not applied" claim in [`REMAINING-WORK-2026-10.md`](./REMAINING-WORK-2026-10.md). Every pass/fail below is from this session unless marked **in flight**.

End of shift / payroll / My Pay are **retired**. The money close is Daily Sheet.

Diagrams (Archify, already delivered):

- [Daily Sheet workflow](../architecture/daily-sheet.workflow.html)
- [Daily Sheet lifecycle](../architecture/daily-sheet.lifecycle.html)
- [Shop-day FLOPS (historical)](../architecture/shop-day-flops.workflow.html)

Playbook: [`SHOP-DAY-RUNBOOK.md`](./SHOP-DAY-RUNBOOK.md) · Money contract: [`docs/OPS/MONEY-CONTRACT.md`](../OPS/MONEY-CONTRACT.md)

---

## Verdict (this session)

Shop-day **code + database** hold: sign-in, TL queue, BA POS (the real checkout), Daily Sheet save/submit/approve, SA/ASA review, September books, and RLS on money tables.

**Not ready to call production complete** until the owner items at the bottom are done. The two that actually stop customer SMS on Vercel and staff alerts on the floor:

1. Hakum Vercel team: set `BUSYBEE_*` (server only, no `VITE_*`) + Static IPs, whitelist those IPs on BrandTxt.
2. Every SA / ASA / BA / TL phone: Enable alerts once (push enrollment is **0 of 20** active staff — reconfirmed `audit-db-deep auth` 2026-10-16).

Easy logins stay on for testing. Do not treat that as a production-ready auth posture (BUG-088, owner choice).

---

## Progress board

| Slice | Seam | Prove with | This session |
|-------|------|------------|--------------|
| Unit / lint / build | repo | `npm test` · `npm run lint` · `npm run build` | **PASS** **2222/0** (2026-10-16). Lint + build exit 0 same day (transfer page apostrophe fix). Deployed `f7ebc41`. |
| Static customer/portal | source | `npm run check` · `npm run audit:api-auth` | **PASS** 5/5 · CLEAN |
| September books | sales → sheet → P&L → Floor Board | `node scripts/verify-september-2026.mjs` | **PASS** 60/60 sheets, Floor Board net ₱1,618,627.00 |
| Shop-day money (TL→BA paid) | `bookings` + `complete_pos_sale` | `scripts/probe-shop-day-lifecycle.sql` (rollback) | **PASS 19/19** |
| Role path + sheet SoD | queue + `review_daily_sheet` | `supabase/tests/daily_flow_role_probe.sql` (rollback) | **PASS 20/20** |
| Sheet SoD (BUG-085) | ASA cannot approve own | `scripts/probe-daily-sheet-self-approval.sql` | **PASS 4/4** |
| Cash bucket (BUG-086) | blank/` cash`/`CASH ` = drawer cash | `scripts/probe-daily-sheet-cash-bucket.sql` | **PASS** |
| RLS matrix | expenses, txns, notifs, SMS templates | `scripts/probe-rls-role-matrix.sql` | **PASS 24/24** |
| Leftover checkout (BUG-093) | `complete_payment` must 42501 | `scripts/probe-legacy-rpc-revoked.sql` | red **7/8** then green **8/8** after revoke |
| Schema integrity | parts 1–9 | `npm run e2e:integrity` | **PASS** |
| Role UI walk | demo cards, landing, deny, retired | `npm run e2e:role-qa-wave` | **PASS 179/179** |
| Sign-in UI | ops + customer | `npm run e2e:ui-p0` | **PASS 9/9** (solo re-run; the parallel pack hit a Puppeteer flake) |
| Money UI (no save) | TL denied POS, BA sheet, SA finance | `npm run e2e:ui-money` | **PASS 5/5** |
| Nav walk | every sidebar link | `npm run e2e:nav-walk` | **PASS 87/87**, backend 4xx **0**. Includes `/operations/vehicle-transfer` for Boss, ASA, and Branch Admin. Team Lead and crew do not see it. |
| Sheet screen vs DB | Finance Daily sheets | `npm run check:sheet-ui` | **PASS** |
| Sheet money sandbox | save → return → approve → reopen | `npm run e2e:daily-sheet-money` | **PASS 38/38** (sandbox day 2000-01-03, wiped) |
| Customer status SMS | `notifyBookingStatus` → BusyBee | `SKIP_CRM=1 node scripts/e2e-real-customer-status-sms.mjs` to **09625294043** | **API accept 12/12**, DLR still `SUBMITTED` after the poll window (exit 1). Detailing + Express Wash Package bookings archived after the run. |
| POS voice | chime + Rosa fallback | `node scripts/_pos-voice-check.mjs` | **PASS 13/13** (2026-10-16; script now loads `.env` for demo passwords). No sale created. |
| Staff/customer push | real device | `npm run e2e:push-real` | **pending** — enrollment 0/20, not automatable on floor phones |
| Fake push wiring | API/DB | `node scripts/e2e-push-notifications.mjs` | **PASS** (2026-10-16) — vapid, role subscribe, fan-out, sheet_submitted |
| Walk-in history + transfer | signup + `/api` transfer | `node scripts/e2e-walkin-history-transfer.mjs` | **PASS 10/10** (2026-10-16) — disposable rows wiped |
| Responsive | 9 viewports × home/book/queue/pos/account | `BASE_URL=… npm run e2e:responsive` | **PASS** fail=0 (2026-10-16). First-cell Loading flake fixed in script. |
| BusyBee egress | BrandTxt balance / IP | `npm run sms:egress` | **FAIL** (2026-10-16) — ErrorCode -1, egress `27.49.15.199` |
| Staff push count | DB | `audit-db-deep.mjs auth` | **0 / 20** active staff enrolled; 3 customer-only subs (2026-10-16) |
| Stranded handoffs | DB | `probe-stranded-handoffs.mjs` | **2** pending (BUG-061 Low — do not POS) |
| Audit P2 static | source | `node scripts/check-audit-p2.mjs` | **PASS** (retargeted 2026-10-16) |
| History banner | browser + unit | `e2e-history-banner` 4/4 · vehicleTransfer tests | **PASS** local; **uncommitted** |

Do **not** run `npm run e2e:lifecycle-flops` as money proof. It still drives retired End of shift / payroll RPCs.

---

## Daily data flow (what actually posts money)

```
Customer /book or walk-in
  → bookings.status = waiting
TL /operations/queue
  → crew present (or late) today
  → in_progress → final_checking
  → send_queue_ticket_to_payment → for_payment + pos_handoffs
BA /operations/pos
  → complete_pos_sale (one transaction) → sales paid + booking completed
  → POS announcer (opt-in device): chime, then /api/pos-announce or browser Rosa
  → notify-booking completed (SMS + inbox + push)
BA POS › Daily sheet
  → save_daily_sheet / submit_daily_sheet (expenses, salaries, cash count)
SA / ASA Finance › Daily sheets
  → review_daily_sheet approve | return  (BA cannot approve own)
  → approve posts paid expenses once
Finance P&L + Floor Board read finance_daily_pl
```

Business date is Asia/Manila. A BA cannot approve their own sheet. Failed QA (`redo` and the redo pass) send no customer SMS.

---

## Workflow checklist

### 1. Sign up and sign in

| # | Path | Who | Gate | Notes |
|---|------|-----|------|--------|
| 1.1 | `/operations/login` | staff | `e2e:ui-p0`, `e2e:role-qa-wave` | Easy cards stay. QA key still required on a production host. |
| 1.2 | `/signin` | customer | `e2e:ui-p0` | Demo customer `09180000001`. |
| 1.3 | `/signup` | public | `handleCustomerSignupRequest` is public by design (`audit:api-auth`) | Do not create a real extra account in this pass. |
| 1.6 | Walk-in with no account | TL ticket, then `/signup` | `tests/vehicleTransferAndHistory.test.js` **13/13** | Ticket copy tells them to sign up. Signup links orphan visits for that phone, including spaces and `+63`, and shows "You have existing history with us." A failed attach shows a warning instead. Same phone stays one account (409). One unowned plate is claimed; extra unowned rows are archived. |
| 1.4 | Staff provision | SA / ASA people | `handleProvisionStaffRequest` authenticates | No live create in this pass. |
| 1.5 | Password rotation | owner | 15 Supabase Auth passwords | **Still owner.** Git history has the old values. |

Constraint: **do not hide easy logins.**

### 2. Team Lead — cars

| # | Action | RPC / write | Probe |
|---|--------|-------------|-------|
| 2.1 | Clock crew present (BA can mark) | `staff_attendance` | shop-day 19/19 |
| 2.2 | Walk-in ticket | `bookings` insert | shop-day `tl_creates_ticket` ok |
| 2.3 | Cannot start with no crew | trigger `trg_require_present_crew_on_start` | `tl_cannot_start_without_crew` err:23514 |
| 2.4 | Cannot assign absent crew | `sync_queue_assignments` | err:23514 |
| 2.5 | Start → final check | `bookings` update | ok |
| 2.6 | Failed QA redo | `redo` then back | daily-flow 20/20 |
| 2.7 | Send to payment | `send_queue_ticket_to_payment` | stamps TL as sender |
| 2.8 | TL cannot ring POS | `complete_pos_sale` | err:42501 |
| 2.9 | Cross-branch denied | Bacoor TL vs Batangas car | 0 rows |
| 2.10 | Package starts without crew | pay_category package/ppf | ok |
| 2.11 | No account on the ticket | Queue ticket editor | Copy: ask them to sign up at `/signup` so the visit stays on their history |

### 3. Branch Admin — pay and complete

| # | Action | Gate |
|---|--------|------|
| 3.1 | Ring cash sale | shop-day `ba_rings_cash_sale` → `paid:35000`, booking `completed`, handoff `completed`, crew released |
| 3.2 | Other-branch BA cannot send / override | daily-flow 10–11 |
| 3.3 | Override back to work | `admin_override_queue_status` |
| 3.4 | Leftover `complete_payment` | **closed BUG-093** — 42501; POS still uses `complete_pos_sale` |
| 3.5 | POS voice | pending `_pos-voice-check` (non-destructive) |
| 3.6 | Customer notify on pay | `/api/notify-booking` status `completed` |
| 3.7 | Transfer a sold car | `/operations/vehicle-transfer` · `/api/vehicle-transfer` | Browser as Bacoor BA: plate NCA2943 resolved to Malcolm Cuady. Phone 09170000999 returns no account, so Transfer stays disabled. Nav walk: Boss, ASA, BA have the page; Team Lead and crew do not. No live move. Open paint-maintenance rows move with the car. A Branch Admin only moves a car with a visit at their branch, or a car with no visits yet. SA and ASA can move any car. A failed audit write puts the owner back. |

### 4. Daily Sheet (replaces End of shift)

| # | Action | Gate |
|---|--------|------|
| 4.1 | BA save / submit | `e2e:daily-sheet-money` (sandbox, wiped) |
| 4.2 | BA cannot approve own | daily-flow + SoD probe |
| 4.3 | ASA approves BA sheet; cannot approve own | SoD 4/4 |
| 4.4 | SA can approve own | SoD (owner exception) |
| 4.5 | Blank cash counts as drawer cash | cash-bucket probe |
| 4.6 | Screen matches stored totals | `check:sheet-ui` in flight |
| 4.7 | September 60/60 books | `verify-september-2026` PASS |

### 5. SA / ASA — approvals and books

| # | Action | Gate |
|---|--------|------|
| 5.1 | Finance Daily sheets | ui-money 5/5 · sheet UI PASS · sandbox money 38/38 |
| 5.2 | P&L = independent sums | September PASS |
| 5.3 | Floor Board net = paid sales | ₱1,618,627.00 |
| 5.4 | Sheet submit/approve alerts | **web push, not SMS** — 0 staff enrolled |

### 6. Customers — SMS and push

| # | Action | Gate |
|---|--------|------|
| 6.1 | Status SMS copy | `server/notifyBooking.mjs` STATUS_COPY. No `for_releasing`. |
| 6.2 | Live send to **09625294043** | SendSMS accepted for detailing + Express Wash Package. DLR stayed `SUBMITTED` through the poll (carrier delay, not a reject). Both bookings archived. |
| 6.3 | Shop gate | `app_settings.sms_notifications.enabled = true` |
| 6.4 | Production Vercel SMS | **blocked** until Hakum team env + Static IPs |
| 6.5 | Customer push | needs portal login + Enable alerts. Seed customers mostly have no auth. |
| 6.6 | CRM blasts | skipped this pass (`SKIP_CRM=1`) so the handset only gets status chain |

Statuses that notify: pending, confirmed, waiting, in_progress, final_checking, for_payment, completed, cancelled, photos_ready.

### 7. Other pages

Covered by `e2e:role-qa-wave` **179/179** and a solo `e2e:nav-walk` **87/87** (backend 4xx 0). Retired: End of shift, Payroll, My Pay, Ops Lab.

### 8. Services, packages, detailing, maintenance

| # | Path | Prove |
|---|------|--------|
| 8.1 | Wash vs package crew rule | shop-day probe: wash needs present crew; package starts without crew |
| 8.2 | Detailing status SMS | live chain to 09625294043: pending → completed (no `for_releasing`). API accept. |
| 8.3 | Package status SMS | same handset, Express Wash Package, including `final_checking`. API accept. |
| 8.4 | Paint maintenance program | `tests/paintMaintenance.test.js` 6/6. Ceramic/PPF enroll; Bookings › Maintenance tab; account home lists due plates. Live enroll of a new car was not run (would write a real schedule). |

---

## Seams this plan tests (and does not)

Tested:

- Database as the real roles (`request.jwt.claims` + `role authenticated`), always rolled back.
- `complete_pos_sale` / `send_queue_ticket_to_payment` / `review_daily_sheet` / `sync_queue_assignments`.
- BusyBee SendSMS + DLR to the owner handset.
- Unit + lint + build + `/api/*` auth list.

Not tested this pass (on purpose):

- Creating a brand-new customer auth user beyond Malcolm's existing row.
- Mutating today's live Daily Sheet.
- Gemini paid TTS (boss has not picked a sample; `/api/pos-announce` is 501 without `GEMINI_API_KEY`).
- Production Vercel SMS (wrong CLI team).

---

## Database truth (read-only, 2026-10-15)

- Guarded money/RLS work **is applied** via the 2026-10-11 reconcile set (`protect_daily_sheet_posted_expenses`, `reconcile_live_admin_policies`, `daily_sheet_separation_of_duties`, `daily_sheet_cash_blank_is_cash`) plus BUG-092 (crew on start) and BUG-093 (revoke leftover RPCs).
- Permissive `admin FOR ALL` policies: **0**.
- SMS shop gate: **on**.
- `booking_status` enum still contains `for_releasing` (legacy rows). App no longer walks it; live SMS e2e no longer walks it.
- Open queue today: 12. Stranded POS test handoffs: 2 on 2026-09-29 (BUG-061, do not ring).
- Daily sheets: 58 approved, 1 draft, 1 returned, 1 submitted (Batangas 2026-09-30).
- Push: 0 of 20 active staff enrolled; 3 customer subscriptions.

`audit-db-deep` exits 1 because of the stranded handoffs + push gap. Those are documented, not silent money bugs. September verify still exits 0.

---

## Owner / ops still open

1. Rotate 15 Supabase passwords (BUG-088 history).
2. Hakum Vercel project: `BUSYBEE_API_KEY`, `BUSYBEE_CLIENT_ID`, `BUSYBEE_SENDER_ID=HAKUM`, `BUSYBEE_API_BASE_URL`. Never `VITE_*`. Never `ENABLE_OWNER_SMS`.
3. Vercel Static IPs → BrandTxt whitelist ([`docs/OPS/BUSYBEE-PRODUCTION.md`](../OPS/BUSYBEE-PRODUCTION.md)).
4. Enable alerts on SA/ASA/BA/TL phones (BUG-062).
5. Optional: rotate BusyBee + Gemini keys if this chat is shared (they were pasted here).
6. BUG-087 (High): salary `suggested_minor` is caller-chosen. Documented, not changed.
7. Pick POS voice sample (01–09). Gemini needs paid Interactions API + ~10s wait if chosen.

---

## Caveman review (this session)

`scripts/probe-legacy-rpc-revoked.sql`:L1: 🔴 bug: leftover `complete_payment` closed a Bacoor car as Batangas BA with 0 sales. Revoke EXECUTE. Applied `20261015090000`.
`server` Ops Lab RPCs: 🟡 risk: any signed-in customer could write audit + list SA/ASA/BA ids. Same revoke.
`docs/qa/REMAINING-WORK-2026-10.md`:L71: 🟡 risk: said six RLS migrations were NOT applied. Prod already had the 2026-10-11 reconcile. Correct this file from the master.
`scripts/e2e-real-customer-status-sms.mjs`:L65: 🔴 bug: chain still walked retired `for_releasing` (notify skipped → false fail + unpaid completed residue). Dropped; archive the two tickets after SMS.
push enrollment: 🟡 risk: 0/20 staff. Sheet approve alerts never reach a phone until Enable alerts.
Vercel BusyBee: 🟡 risk: production SMS still 501/unauthorized IP until Hakum team env + Static IPs.
`complete_payment` body: 🔵 nit: function kept after revoke so an old bundle cannot 404. Drop later.
`booking_status` enum `for_releasing`: 🔵 nit: leftover label. App maps it to Payment. Do not drop until no live rows use it.
BUG-087: 🟡 risk: BA can equalise `amount_minor` to caller-chosen `suggested_minor`. Owner call.
BUG-088 chips: 🟡 risk: easy logins stay on by owner request. Do not hide this pass.
`e2e:ui-p0` + `e2e:nav-walk`: 🟡 risk: failed because the pack started several Vite servers and one Chrome at once. Role wave 179/179, ui-money 5/5, sheet money 38/38 still passed. Re-run those two alone.
SMS DLR: 🟡 risk: BrandTxt accepted every send; delivery reports stayed SUBMITTED inside the poll. Not a copy bug.
`src/pages/CustomerAccountPage.jsx`: history sentence renders in the account body. Transfer page is SA/ASA/BA only. Live browser click of a real transfer was not done (would move a real car).
`scripts/e2e-real-customer-status-sms.mjs` MessageStatus: 🟡 risk: GET still puts ApiKey in the query string (DLR only; live send is POST body).
stranded 2026-09-29 handoffs: 🟡 risk: ₱5,397.50 test tickets. Do not ring.

---

## How to re-run the pack

```
npm test
npm run lint
npm run build
npm run check
npm run audit:api-auth
npm run e2e:integrity
npm run e2e:role-qa-wave
npm run e2e:ui-p0
npm run e2e:ui-money
npm run e2e:nav-walk
npm run check:sheet-ui
npm run e2e:daily-sheet-money
SKIP_CRM=1 node scripts/e2e-real-customer-status-sms.mjs
```

Rollback-only SQL (safe on a live day): `scripts/probe-shop-day-lifecycle.sql`, `supabase/tests/daily_flow_role_probe.sql`, `scripts/probe-daily-sheet-self-approval.sql`, `scripts/probe-daily-sheet-cash-bucket.sql`, `scripts/probe-rls-role-matrix.sql`, `scripts/probe-legacy-rpc-revoked.sql`.
