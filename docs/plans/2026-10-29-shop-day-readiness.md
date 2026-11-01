# Shop-day readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prove one real branch day, from crew sign-in to Finance, so a branch can run wash, detailing, the register, and the Daily Sheet without a hidden break.

**Architecture:** Keep the money rules that already exist. `computeSheetTotals` in `src/lib/dailySheet.js` and `src/lib/sheetFormulas.js` stay the client arithmetic. The database twin is `daily_sheet_server_totals`. Do not call that function from the client, and do not name it inside a JavaScript block comment (the boundary test reads source and fails if it appears there). New proof is one sequenced script, `scripts/e2e-shop-day.mjs`, that signs in as each role and uses the same writes the pages use. Unit tests cover the pure rules with pesos worked out by hand. A failing step is fixed in the product, then the same test is run again. Do not add a second sheet calculator.

**Tech Stack:** Vite/React, Node test runner (`node --test`), Supabase anon sign-in, existing demo accounts in `src/lib/demoAccounts.js`, Puppeteer only for screens the API walk cannot see (`npm run e2e:money-path`, `npm run e2e:nav-walk`).

---

## What “ready for daily use” means

A day is ready when all of these are true on the same run:

1. `node --test tests/shopDayRules.test.js` exits 0.
2. `node scripts/e2e-shop-day.mjs` exits 0 and prints every step below as `ok`.
3. `npm test` exits 0 after the fixes that the new tests forced.
4. The role page matrix in Task 12 has no surprise: a page that `canAccess*` allows returns the app, and a page it refuses returns the access-denied path.

Customer reminder texts stay outbound only. BusyBee BrandTxt IP and Auth SMTP are host proof. They are not closed by this plan. There is no owner daily SMS. Do not put a password in git. Robert signs in only when `VITE_DEMO_PASSWORD_ROBERT` is set in the environment. Lucy is the existing Assistant Super Admin account `assistant@hakumautocare.com` (`id: 'asa'`).

## Seams under test

These are the public boundaries. Tests call them. They do not query private helpers.

| Seam | Public surface |
|---|---|
| Sign-in | `supabase.auth.signInWithPassword` for a demo account |
| Clock | Attendance page write: one `staff_attendance` row for that person and Manila date, status inside or outside the branch geofence |
| Ticket | Team Lead insert of a booking, plus `/api/provision-customer` when the person is new |
| Notes | `bookings.notes` returned on the staff queue select, and the card text in `src/components/ops/DaylightQueueCard.jsx` |
| Queue number | `formatQueueNumberForKind` on the staff card. Public queue, shop TV, and the customer visit do not render it |
| Status | `canTransitionQueueStatus` and `nextDetailingBoardStatus`. Payment is `sendTicketToPayment`, not a Team Lead jump |
| Customer book | Customer session creates a detailing booking |
| Register | `buildPosSalePayload` / the POS complete path. Branch Admin cart is merch and coffee drinks only |
| Voucher | Optional code on a ticket that already exists. A walk-in with no ticket is refused |
| Points | Paid service adds the catalog points. A merch claim deducts that branch’s stock and refuses at zero |
| Sheet | `computeSheetTotals` with the pesos in Task 8. Submit, then Finance shows the same centavos for that branch and Manila day |
| Gates | `canAccess*` in `src/auth/permissions.js` |

## Shop-day order

The script runs in this order. A later step uses the ids from an earlier step. Plates are new each run (`QA` + the last 5 digits of `Date.now()`), so a rerun does not collide with `scripts/e2e-lifecycle-day.mjs` plates `NKA9231`–`NKA9234`.

1. Crew signs in and clocks in inside the Bacoor fence. A point outside the fence is refused.
2. The attendance register can be filtered by role and can render `Crew N of M`.
3. Team Lead signs in and opens a same-day wash for an existing customer. Notes are on the ticket. The staff card shows the queue number, the name, and the notes. The public queue payload may still carry the number; the public page does not render it.
4. Team Lead opens a detailing job for a new person (account is created) and one for an existing person. Both show the customer name and the notes.
5. Statuses follow the real machines. A skipped status is refused.
6. The customer books detailing on `/account/book`.
7. The ticket reaches payment. Branch Admin adds coffee and merch. Branch Admin cannot add a service, a package, or detailing. Team Lead cannot open POS.
8. Voucher: valid code on that ticket changes the total. Used, expired, and empty-ticket codes do not.
9. Points land on the paid service. A merch claim with stock succeeds and lowers the count. A claim at zero stock is refused.
10. Tenders: cash, GCash, and a split that adds up. A split that does not add up is refused. Card stays out of cash left and GCash left.
11. Daily Sheet: add a manual expense, edit it, record a cash advance given and a partial payback. Totals match the hand-worked pesos. Approve does not post the cash advance to Finance.
12. Branch Admin submits the sheet. Super Admin can see it. Lucy can process it when her grants include finance write. Robert can process it the same way when his password env is set. Finance filtered to that branch and that day shows the same sales, expenses, and cash left.
13. Every role opens the pages they are allowed and is refused the pages they are not.
14. Paths nobody named in the request, listed in Task 13, are included in the same script.

## Rules that stay

Do not “fix” these. A test that expects the opposite is a wrong test.

- Oldest waiting car is next. A new ticket goes to the bottom.
- Unpaid cash advances on Floor Insight are for the owner. Branch Admin and Assistant Super Admin use the POS Cash advances tab and the Daily Sheet.
- Robert is a General Admin, same grants as Lucy. He does not approve restock. Only Super Admin approves restock.
- A coffee drink does not deduct cups or grams.
- A visit reward is shown and texted. It is not a free line on the sale.
- Crew are not on office payroll. Office pay is the 14-day block from Monday 2026-01-05.
- No morning float. Cash left is the day’s cash.

## Hand-worked sheet (the only expected pesos)

Use these centavos. Do not recompute the expected value by calling `computeSheetTotals` inside the assertion.

| Input | Centavos |
|---|---|
| Paid wash, cash | 100000 |
| Paid coffee, GCash | 50000 |
| Paid ceramic, card | 200000 |
| Cash advance given, cash | 20000 |
| Cash advance paid back, cash | 5000 |
| Manual expense, cash, category set | 10000 |
| Salary | 0 |

Independent results:

- Total sales = 350000 − 20000 = **330000**
- Total expenses = 10000
- Net profit = 330000 − 10000 = **320000**
- Cash left = 100000 + 5000 − 10000 − 20000 = **75000**
- GCash left = **50000**
- Credit/debit = **200000**, and it is not inside cash left or GCash left

After the expense is edited from 10000 to 15000 cash, cash left becomes **70000** and net profit becomes **315000**. Total sales stays **330000**.

---

### Task 1: Shop-day rule file that fails before the script exists

**Files:**
- Create: `tests/shopDayRules.test.js`
- Test: `tests/shopDayRules.test.js`

**Step 1: Write the failing test**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

test('shop day script exists and walks clock-in through finance', () => {
  const src = readFileSync(new URL('../scripts/e2e-shop-day.mjs', import.meta.url), 'utf8')
  for (const step of [
    'crew clock in',
    'clock outside fence refused',
    'existing customer wash',
    'new customer detailing',
    'notes on staff card',
    'queue number hidden on public page',
    'customer books detailing',
    'branch admin merch only',
    'voucher refused without ticket',
    'points claim at zero stock refused',
    'split tender refused',
    'sheet expense edited',
    'finance matches sheet',
  ]) {
    assert.match(src, new RegExp(step))
  }
})
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/shopDayRules.test.js`

Expected: FAIL with `ENOENT` for `scripts/e2e-shop-day.mjs`.

**Step 3: Write minimal implementation**

Create `scripts/e2e-shop-day.mjs` that only prints those step names and exits 0. No live writes yet. The string list above must appear as comments or as `pass('crew clock in')` calls so the test matches them.

**Step 4: Run test to verify it passes**

Run: `node --test tests/shopDayRules.test.js`

Expected: PASS, 1 test.

**Step 5: Commit**

```bash
git add tests/shopDayRules.test.js scripts/e2e-shop-day.mjs
git commit -m "Add the shop-day script skeleton from clock-in to finance."
```

On this machine, pass the message with a PowerShell here-string, not a bash heredoc.

---

### Task 2: Crew sign-in and the geofence

**Files:**
- Modify: `scripts/e2e-shop-day.mjs`
- Modify: `tests/shopDayRules.test.js`
- Existing helper: `src/lib/attendanceGeo.js` (`isInsideGeofence`)
- Existing smoke (do not replace): `scripts/e2e-attendance.mjs` uses the service role. This task uses the crew password.

**Step 1: Write the failing test**

Add to `tests/shopDayRules.test.js`:

```js
import { isInsideGeofence } from '../src/lib/attendanceGeo.js'

test('a clock inside the fence is accepted and a far clock is refused', () => {
  const inside = isInsideGeofence({
    userLat: 14.459, userLng: 120.929, branchLat: 14.459, branchLng: 120.929, radiusM: 150,
  })
  const outside = isInsideGeofence({
    userLat: 14.50, userLng: 121.00, branchLat: 14.459, branchLng: 120.929, radiusM: 150,
  })
  assert.equal(inside.ok, true)
  assert.equal(outside.ok, false)
})
```

Run it. It should already pass if `isInsideGeofence` is unchanged. That is the rule test. The script step is the one that must fail until wired:

In `e2e-shop-day.mjs`, the step `crew clock in` must sign in as `crew1` (`staff1@hakumautocare.com` via `OPS_DEMO_ACCOUNTS`) and upsert today’s `staff_attendance` for Bacoor with `source: 'self'` only when `isInsideGeofence` is ok. `clock outside fence refused` must attempt the same upsert with coordinates that fail the fence and assert the write is rejected or not stored as a successful self clock.

**Step 2: Run the script**

Run: `node scripts/e2e-shop-day.mjs`

Expected before the wire-up: the step throws `crew1 login` or `clock outside fence refused`.

**Step 3: Implement**

Reuse the sign-in shape from `scripts/e2e-lifecycle-day.mjs` (`asUser`). Read the Bacoor `latitude`, `longitude`, and `geofence_radius_m`. Write the inside clock. For the outside clock, call the same insert the Attendance page uses; assert the error or that the stored row is still the inside clock. Do not leave the crew stuck clocked out: the inside row remains.

**Step 4: Re-run**

Run: `node scripts/e2e-shop-day.mjs`

Expected: `crew clock in` and `clock outside fence refused` print ok. Exit 0 for those steps. Later steps may still be stubs.

**Step 5: Commit**

```bash
git add scripts/e2e-shop-day.mjs tests/shopDayRules.test.js
git commit -m "Prove crew clock-in inside the branch fence and refuse a far clock."
```

---

### Task 3: Attendance headcount

**Files:**
- Modify: `scripts/e2e-shop-day.mjs`
- Test: `tests/shopDayRules.test.js`
- Read: the attendance register formatter used by `AttendancePage` (search `Crew` and `of` in `src/pages` after the clock step is green)

**Step 1: Write the failing test**

Assert the register line builder, once you have its export, with a fixed roster:

```js
test('attendance line counts who clocked in against the roster', () => {
  const line = formatAttendanceHeadcount({
    branch: 'Bacoor',
    counts: { staff: { in: 8, roster: 10 }, team_lead: { in: 2, roster: 2 }, admin: { in: 1, roster: 2 } },
  })
  assert.equal(line, 'Bacoor · Crew 8 of 10 · Team Lead 2 of 2 · Admin 1 of 2')
})
```

If that function is not exported, export the existing formatter. Do not write a second one.

**Step 2: Run**

Run: `node --test tests/shopDayRules.test.js`

Expected: FAIL until the export and the assertion match the real string. If the live string uses `·` and the words above, keep that. If the live string differs, change the assertion to the string the screen already shows, then assert the script finds that substring for Bacoor after the crew clock.

**Step 3: Script step**

Sign in as `admin` (Branch Admin). Read today’s register. Assert the crew count increased by the clock in Task 2, and that a role filter for Team Lead does not include the crew row.

**Step 4: Re-run both commands. Expected: PASS.**

**Step 5: Commit** `Prove the attendance register counts crew against the roster.`

---

### Task 4: Team Lead wash for an existing customer, notes, and queue number

**Files:**
- Modify: `scripts/e2e-shop-day.mjs`
- Modify: `tests/shopDayRules.test.js`
- UI: `src/components/ops/DaylightQueueCard.jsx`
- Public: `src/pages/PublicQueuePage.jsx` must not render the queue number

**Step 1: Write the failing test**

```js
test('staff card shows the number, the name, and the notes', () => {
  const card = readFileSync(new URL('../src/components/ops/DaylightQueueCard.jsx', import.meta.url), 'utf8')
  assert.match(card, /formatQueueNumberForKind/)
  assert.match(card, /customer_name/)
  assert.match(card, /No notes/)
})

test('public queue page does not render the ticket number', () => {
  const page = readFileSync(new URL('../src/pages/PublicQueuePage.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(page, /lq-ticket-num/)
  assert.doesNotMatch(page, /\{item\.queueNumber\}/)
})
```

**Step 2: Run** `node --test tests/shopDayRules.test.js`

Expected: PASS if the current UI is unchanged. If it fails, restore the staff number and remove the public render. Do not invent a new card.

**Step 3: Script**

Sign in as `tl`. Pick an existing Bacoor customer who already has a profile. Create a same-day wash (`isSameDayQueueKind`) with notes `Check the cup holder`. Assert:

- `customer_name` is the existing name, not a blank
- `notes` is `Check the cup holder`
- `queue_number` is a number
- selecting the staff queue returns that notes string
- `fifoNextTicketId` still returns the oldest waiting id, not this new ticket, when an older waiting ticket exists

**Step 4: Re-run the script. Expected: `existing customer wash` and `notes on staff card` and `queue number hidden on public page` ok.**

**Step 5: Commit** `Show wash notes and the queue number to staff only.`

---

### Task 5: Detailing for a new customer and an existing customer

**Files:**
- Modify: `scripts/e2e-shop-day.mjs`
- Read: `isBookingBoardService` in `src/lib/serviceKinds.js`
- Status labels: `src/lib/detailingBoardStatuses.js`

**Step 1: Failing script assertion**

`new customer detailing` calls `POST {BASE_URL}/api/provision-customer` the same way `scripts/e2e-lifecycle-day.mjs` does (`allow_walk_in_name: true`). Then the Team Lead inserts a ceramic / tint / PPF row (`isBookingBoardService` is true) with notes `Existing scratch on the hood`.

Assert:

- the provision response created or matched one customer id
- the booking `customer_id` is that id
- the booking `customer_name` is the name that was sent
- a second detailing row for the existing customer from Task 4 reuses that customer id and does not create a second auth user
- both rows are on the bookings board pipeline, not the same-day wash lane

**Step 2: Run** `node scripts/e2e-shop-day.mjs`

Expected: FAIL until the provision call and the two inserts exist.

**Step 3: Implement only those two inserts.** Start the new-customer row at `pending`. Start the existing-customer row at `pending`. Do not skip to payment.

**Step 4: Re-run. Expected: `new customer detailing` ok.**

**Step 5: Commit** `Open detailing for a new customer and an existing customer.`

---

### Task 6: Statuses, including the refused skip

**Files:**
- Modify: `tests/shopDayRules.test.js`
- Modify: `scripts/e2e-shop-day.mjs`
- Rules: `canTransitionQueueStatus` in `src/queue/queueLogic.js`, `nextDetailingBoardStatus` in `src/lib/detailingBoardStatuses.js`

**Step 1: Write the failing test**

```js
import { canTransitionQueueStatus } from '../src/queue/queueLogic.js'
import { nextDetailingBoardStatus } from '../src/lib/detailingBoardStatuses.js'

test('a wash cannot jump from waiting to completed', () => {
  assert.equal(canTransitionQueueStatus('waiting', 'completed'), false)
  assert.equal(canTransitionQueueStatus('waiting', 'in_progress'), true)
  assert.equal(canTransitionQueueStatus('in_progress', 'final_checking'), true)
  assert.equal(canTransitionQueueStatus('final_checking', 'for_payment'), false)
})

test('detailing advances one board step at a time', () => {
  assert.equal(nextDetailingBoardStatus('pending'), 'confirmed')
  assert.equal(nextDetailingBoardStatus('confirmed'), 'waiting')
  assert.equal(nextDetailingBoardStatus('waiting'), 'in_progress')
  assert.equal(nextDetailingBoardStatus('for_payment'), 'completed')
  assert.equal(nextDetailingBoardStatus('completed'), null)
})
```

`for_payment` is not a Team Lead transition. The comment in `queueLogic.js` says Admin/POS uses `sendTicketToPayment`.

**Step 2: Run** `node --test tests/shopDayRules.test.js`

Expected: PASS against current rules. If a line fails, the test is wrong or the machine changed. Read the constants before editing the machine.

**Step 3: Script**

On the wash from Task 4: `waiting` → `in_progress` → `final_checking`. Assert a direct update to `completed` leaves the status at `final_checking` or returns an error. Then the role that is allowed to send to payment does that. Assert status `for_payment`.

On the new detailing row: `pending` → `confirmed` → `waiting` → `in_progress` → `final_checking` → `for_payment`. Assert a jump from `pending` to `for_payment` does not stick.

Cancel one extra wash in the same script and assert `cancelled` has no next status.

**Step 4: Re-run unit test and script. Expected: both green for these steps.**

**Step 5: Commit** `Refuse a skipped queue status and walk the legal detailing steps.`

---

### Task 7: Customer books detailing

**Files:**
- Modify: `scripts/e2e-shop-day.mjs`
- Page: `src/pages/CustomerBookPage.jsx`

**Step 1: Script assertion that fails first**

Sign in as `CUSTOMER_DEMO_ACCOUNT`. Create a detailing booking through the same insert or API the book page uses (read `CustomerBookPage` and copy that call, do not invent a new endpoint). Assert:

- the row `customer_id` is the demo customer
- `isBookingBoardService` is true for the chosen service
- the customer visit payload does not include a rendered queue number (the page source check belongs in the unit file: `CustomerVisitPage.jsx` and `CustomerQueuePage.jsx` do not render `queue_label`)

**Step 2: Run the script. Expected: FAIL until the customer insert exists.**

**Step 3: Add the insert. Leave it at `pending`.**

**Step 4: Re-run. Expected: `customer books detailing` ok.**

**Step 5: Commit** `Let the customer book detailing on their own account.`

---

### Task 8: POS sellables, coffee, merch, and the Branch Admin limit

**Files:**
- Modify: `scripts/e2e-shop-day.mjs`
- Modify: `tests/shopDayRules.test.js`
- Rules: `assertBranchAdminCart` (find the export; the handoff names it), `filterPosBayCatalog`, `filterPosDetailingCatalog` in `src/lib/serviceKinds.js`

**Step 1: Write the failing test**

```js
test('branch admin cart rejects a service and accepts merch', () => {
  assert.throws(() => assertBranchAdminCart([{ kind: 'service' }]))
  assert.doesNotThrow(() => assertBranchAdminCart([{ kind: 'merchandise' }, { kind: 'coffee_menu' }]))
})
```

Use the real function’s argument shape after you open it. The assertion is the behavior: a service line throws, a merch line and a coffee drink do not.

**Step 2: Run the unit test. Expected: FAIL if the import or the shape is wrong, then PASS once the call matches the function.**

**Step 3: Script**

Sign in as `admin`. On the wash that is `for_payment`:

- adding a detailing or package line fails
- adding a coffee drink and a merch item with stock succeeds
- the ticket service lines the Team Lead wrote are unchanged

Sign in as `tl` and assert `canAccessPos` is false for that profile (unit test) and that a POS sale insert is rejected.

**Step 4: Re-run. Expected: `branch admin merch only` ok.**

**Step 5: Commit** `Keep Branch Admin on merch and coffee drinks at payment.`

---

### Task 9: Voucher happy path and failures

**Files:**
- Modify: `scripts/e2e-shop-day.mjs`
- Modify: `tests/shopDayRules.test.js`
- Rules: `src/lib/promoVoucher.js`

**Step 1: Write the failing test**

Use a fixed voucher row object, not the database:

```js
test('a voucher needs a ticket and a live code', () => {
  assert.equal(voucherRejectReason({ code: 'SAVE10', ticketId: null }), 'no-ticket')
  assert.equal(voucherRejectReason({ code: 'SAVE10', ticketId: 't1', status: 'used' }), 'used')
  assert.equal(voucherRejectReason({ code: 'SAVE10', ticketId: 't1', status: 'expired' }), 'expired')
  assert.equal(voucherRejectReason({ code: 'SAVE10', ticketId: 't1', status: 'active', discountMinor: 5000, totalMinor: 100000 }), null)
})
```

If `voucherRejectReason` does not exist, add it next to the existing voucher helper and have the POS check call it. One function, not a new module.

**Step 2: Run** `node --test tests/shopDayRules.test.js`

Expected: FAIL with `voucherRejectReason is not defined`, then PASS after the function exists.

**Step 3: Script**

Create one active code, apply it on the payment ticket, assert the sale total dropped by the code amount. Apply the same code again and assert refusal. Apply a code with no ticket id and assert refusal.

**Step 4: Re-run unit test and script.**

**Step 5: Commit** `Refuse a voucher that has no ticket, is used, or is expired.`

---

### Task 10: Points and a merch claim

**Files:**
- Modify: `scripts/e2e-shop-day.mjs`
- Modify: `tests/shopDayRules.test.js`
- Catalog: `src/lib/rewardsCatalog.js`

**Step 1: Write the failing test**

```js
test('a paid carwash awards 1 point and a claim at zero stock is refused', () => {
  assert.equal(pointsForServiceName('Carwash'), 1)
  assert.equal(canClaimMerch({ points: 50, cost: 50, stock: 1 }), true)
  assert.equal(canClaimMerch({ points: 50, cost: 50, stock: 0 }), false)
  assert.equal(canClaimMerch({ points: 10, cost: 50, stock: 5 }), false)
})
```

Wire `pointsForServiceName` to the existing catalog table. Parent names that are not a live service stay on the rewards table only. Do not delete Ceramic Coating or PPF names.

**Step 2: Run the unit test. Expected: FAIL until the two functions read the catalog.**

**Step 3: Script**

Pay the wash. Read the customer’s points and assert they increased by the catalog amount for that service. Claim a merch item at a branch with stock and assert stock dropped by 1 and points dropped by the item cost. Repeat at stock 0 and assert the claim is refused and points are unchanged.

**Step 4: Re-run.**

**Step 5: Commit** `Award catalog points and refuse a merch claim when the branch is out.`

---

### Task 11: Tenders and the sheet pesos

**Files:**
- Modify: `tests/shopDayRules.test.js`
- Modify: `scripts/e2e-shop-day.mjs`
- Math: `computeSheetTotals` in `src/lib/dailySheet.js`
- Existing tests to keep green: `tests/dailySheet.test.js`, `tests/sheetFormulas.test.js`

**Step 1: Write the failing test**

Build the input rows for the hand-worked table in this plan. Assert:

```js
assert.equal(totals.totalSalesMinor, 330000)
assert.equal(totals.totalExpensesMinor, 10000)
assert.equal(totals.netProfitMinor, 320000)
assert.equal(totals.expectedCashMinor, 75000)
assert.equal(totals.gcashLeftMinor, 50000)
assert.equal(totals.creditDebitMinor, 200000)
```

Use the real field names from `computeSheetTotals`. If a name differs, assert the value the screen shows for that concept. Expected numbers stay the literals above.

Also assert a split whose cash portion plus GCash portion is not the ticket total is rejected by the existing split check (`sales_cash_gcash_split` / the payload builder).

**Step 2: Run** `node --test tests/shopDayRules.test.js tests/dailySheet.test.js tests/sheetFormulas.test.js`

Expected: the new literals PASS if the formula is already correct. If they fail, fix `computeSheetTotals` or the test’s row shape. Do not change the literals to match a bug. Salary must be subtracted once, inside the channel. A cash advance is not an expense.

**Step 3: Script steps** `split tender refused` and `sheet expense edited`

On a fresh QA sheet for today and Bacoor (or a dedicated QA branch if the script already isolates one): post the rows in the table, save, read the sheet, assert the literals. Edit the manual expense from 10000 to 15000. Assert cash left **70000** and net profit **315000**. Assert the cash advance is absent from Finance expenses.

**Step 4: Re-run the three test files and the script.**

**Step 5: Commit** `Lock the daily sheet pesos and refuse a split that does not add up.`

---

### Task 12: Who may see and process the sheet

**Files:**
- Modify: `scripts/e2e-shop-day.mjs`
- Modify: `tests/shopDayRules.test.js`
- Gates: `canAccessFinance`, `canWriteFinance`, `canEditFinanceBooks`, `canAccessPos`, `canAccessFloorBoard`, `canAccessAttendance`, `canAccessQueuePage` in `src/auth/permissions.js`

**Step 1: Write the failing test**

A table of profiles. Build plain profile objects `{ role, grants }` the way the permission tests already do (read `tests/authzMoneyGates.test.js` for the fixture shape). Assert:

| Person | POS | Finance view | Finance books | Floor Insight | Queue edit | Attendance clock |
|---|---|---|---|---|---|---|
| Super Admin `boss` | yes | yes | yes | yes | yes | no (not in the clock role list) |
| Lucy `asa` with `finance_view`, `finance_write`, `pos`, `queue_all` | yes | yes | yes | no | yes | no |
| Robert, same grants as Lucy | yes | yes | yes | no | yes | no |
| Branch Admin `admin` | yes | yes | no | no | no | yes |
| Team Lead | no | no | no | no | yes | yes |
| Crew `staff` | no | no | no | yes | no | yes |
| Investor | no | yes, and `canWriteFinance` is false | no | no | no | no |

`canAccessFloorBoard` is Super Admin and crew only. Do not grant Floor Insight to Lucy, Robert, or Branch Admin in this test.

**Step 2: Run** `node --test tests/shopDayRules.test.js tests/authzMoneyGates.test.js`

Expected: PASS against current gates. A failure means the fixture does not match `permissions.js`. Fix the fixture, not the gate, unless the product denies a person this table allows.

**Step 3: Script** `finance matches sheet`

Submit the sheet as Branch Admin. Sign in as `boss` and read it. Sign in as `asa` and read the same centavos. If `VITE_DEMO_PASSWORD_ROBERT` is set, sign in as `robert@hakumautocare.com` and read the same centavos. If it is unset, print `robert skipped` and continue. Do not embed a password.

Finance list filtered by Bacoor and today’s Manila date includes this sheet and excludes a different branch. The sales, expense, and cash-left figures equal the sheet after the edit in Task 11.

**Step 4: Re-run.**

**Step 5: Commit** `Show the same sheet pesos to the owner, Lucy, and Finance filters.`

---

### Task 13: Paths that were not named, still part of the day

**Files:**
- Modify: `scripts/e2e-shop-day.mjs`

Add one assertion each. Reuse the ticket and sheet from earlier tasks. Do not open a second product path.

| Step name | Assert |
|---|---|
| `redo returns to in progress` | From `final_checking`, a failed QA the Team Lead is allowed to mark becomes `redo`, then `in_progress`. Crew cannot mark failed QA. |
| `cancel has no next step` | `canTransitionQueueStatus('cancelled', 'waiting')` is false, and the cancelled row stays cancelled. |
| `cash advance ask` | Crew inserts an ask on My advances. Super Admin approves. The Daily Sheet shows the remaining balance for that person. The amount is not an expense line. |
| `partial payback` | A payback smaller than the balance leaves a remainder. A payback larger than the balance is refused. |
| `restock` | Branch Admin requests a restock and cannot set the count directly. Super Admin approval changes the count and does not create a bill. Lucy’s session is refused on the approve action. |
| `empty expense` | Submit with a draft expense that has no category is refused. |
| `second submit` | Submitting the same branch-day sheet again does not create a second sheet. |

**Step 1: Add the assertions so the script fails on the first missing one.**

**Step 2: Run** `node scripts/e2e-shop-day.mjs`

**Step 3: Wire each assertion to the existing page call. Stop at the first real product bug, fix that bug with the smallest change, re-run, continue.**

**Step 4: Expected: every step name prints ok.**

**Step 5: Commit** `Cover redo, cash advance, restock, and a second sheet submit.`

---

### Task 14: Page matrix for every signed-in role

**Files:**
- Create: `tests/rolePageMatrix.test.js`
- Source of truth: the `canAccess*` functions and the routes in `src/App.jsx` under `/operations` and `/account`

**Step 1: Write the failing test**

Import the gate functions. For each role fixture from Task 12, plus `sales`, `marketing`, `detailer`, `video`, `opslead`, and the demo customer, assert the route is allowed or denied:

- Operations routes: `dashboard`, `queue`, `attendance`, `my-advances`, `kpi`, `pos`, `inventory`, `approvals`, `finance`, `monthly-payroll`, `payslips`, `crm`, `bookings`, `planning`, `settings`, `audit`, `vouchers`, `memberships`, `reports`, `notifications`
- Customer routes are allowed only for the customer fixture: `/account`, `/account/book`, `/account/queue`, `/account/loyalty`, `/account/vouchers`, `/account/visit`
- `/operations/my-pay` is a redirect to `/operations` for everyone
- Public `/queue/:branch` is allowed without a session, and the page test from Task 4 still hides the number

Map each route to the gate that `App.jsx` already uses (`gate('pos', …)`). Do not duplicate the gate logic inside the test. Call the same function.

**Step 2: Run** `node --test tests/rolePageMatrix.test.js`

Expected: FAIL where a route and a gate disagree. Fix the route or the gate, whichever is the bug. A denied role must not gain a page in order to make the test pass.

**Step 3: No new pages.**

**Step 4: Re-run. Expected: PASS.**

**Step 5: Commit** `Check every role against the page they are allowed to open.`

---

### Task 15: Best-practices gate

**Files:**
- None, unless `npm audit` shows a fix that is a lockfile bump you choose to apply in a follow-up. Do not upgrade the framework inside this task.

**Step 1: Run**

```bash
npm audit --json
```

Record the counts. A critical advisory in a runtime dependency is a stop. A dev-only advisory is written into the readiness note and does not block the shop day.

**Step 2: Confirm the new script**

- reads passwords only from `demoPassword` / `process.env`
- does not print session tokens
- does not commit `.env`

**Step 3: Run** `npm test`

Expected: exit 0. If it fails, fix the failure before Task 16. Do not delete a failing test to go green.

**Step 4: Commit only if audit or test fixes changed files.** Message: `Keep the shop-day script free of secrets and the unit suite green.`

---

### Task 16: One full day, then the readiness note

**Files:**
- Modify: `docs/plans/2026-10-29-shop-day-readiness.md` (append a Results section only after the commands below)
- Do not rewrite `docs/plans/2026-10-26-new-changes-handoff.md` except to add one line pointing at this plan after the script is green

**Step 1: Run, in order**

```bash
node --test tests/shopDayRules.test.js tests/rolePageMatrix.test.js tests/dailySheet.test.js tests/sheetFormulas.test.js tests/queueLogic.test.js tests/authzMoneyGates.test.js
node scripts/e2e-shop-day.mjs
npm test
```

**Step 2: Read the output.** Exit code 0 on each. Count pass and fail.

**Step 3: Append Results** with the date, the commit, the three exit codes, and any step that was skipped because `VITE_DEMO_PASSWORD_ROBERT` was unset. State that BrandTxt IP and Auth SMTP were not proven.

**Step 4: Screens.** `npm run e2e:money-path` when the app is already on `http://127.0.0.1:5174`. If that command is not run, the Results section says the money screens were not clicked. Do not write that they were.

**Step 5: Commit** `Record the shop-day run that is safe for a branch to use.`

---

## Out of scope

- Rewriting `scripts/e2e-lifecycle-day.mjs` or the September seed.
- A second payroll calendar. Office pay stays the 14-day block already on `main`.
- Sending a real SMS, or treating owner SMS as a launch gate.
- Putting Robert’s password, demo passwords, or service-role keys in the repo.
- Committing `graphify-out/`, `.codex/`, `.gemini/`, `.grok/`, `.impeccable/`, SMS csv files, `e2e-evidence/**/*.png`, or `e2e-evidence/**/*.mp3`.
