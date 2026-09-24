# Shop-day runbook (FLOPS)

**Purpose:** Principal QA / Branch Admin playbook for one Manila calendar day.  
**Contract:** [docs/OPS/MONEY-CONTRACT.md](../OPS/MONEY-CONTRACT.md) · [docs/user-stories/shop-day-flow.md](../user-stories/shop-day-flow.md)  
**Evidence command:** `BASE_URL=http://127.0.0.1:5174 npm run e2e:lifecycle-flops`  
**Evidence folder:** `e2e-evidence/lifecycle-flops/`

## Rules

1. Business date = Asia/Manila (`en-CA` YMD). Never use UTC `.slice(0, 10)` of ISO timestamps for shop day.
2. Paid POS is the money truth. Shift close is drawer attestation. They can differ until Finance accepts a matching close.
3. Floor payroll confirms from paid POS + attendance — not from the close pesos.
4. Do **not** re-run the mutating FLOPS script blindly on a day that already has a confirmed payroll for the same branch window unless you intend another paid sale.
5. Geofence: for QA, Super Admin may upsert `staff_attendance` present with notes `QA lifecycle override`. Live crew still clocks via Attendance.
6. Untitled / ₱1 catalog rows must stay inactive. FLOPS picks the highest-priced same-day wash sellable.

## Role path (click order)

| Step | Who | Route / action |
|------|-----|----------------|
| C1 | Customer / public | `/book` detailing SKU → `/api/public-book` |
| C1b | Team Lead | `/operations/bookings` → confirm pending |
| A1 | Crew | `/operations/attendance` time-in (or SA override) |
| W1 | Team Lead | `/operations/queue` waiting → Start → Final check |
| W1b | Branch Admin | Send to payment → `/operations/pos` pay cash |
| W2 | Team Lead | Cancel a waiting ticket (reason ≥ 3 chars) |
| W3 | Super Admin | Mark redo from final_checking → TL resume → cancel |
| E1 | Branch Admin | POS End of shift submit |
| F1 | Super Admin | Finance → Shift reviews → Accept (or Reopen if stale accepted) |
| P1 | Super Admin | Payroll → Floor confirm |
| Books | Super Admin / Investor | Finance overview Paid by kind for that day |

## QA plates (FLOPS)

Plates rotate by Manila date suffix so re-runs do not collide with yesterday’s tickets. Phone: `09189990923`. Notes contain `QA FLOPS`.

## Status matrix (wash)

`waiting` → `in_progress` → `final_checking` → Admin `send_queue_ticket_to_payment` → `for_payment` → POS `complete_pos_sale` → `completed`.

Cancel allowed through `for_releasing`. TL never sends to payment. Redo: SA marks → `redo` → `in_progress`.

## Safety

- Provision customer before payment handoff.
- Reopen is Super Admin only, accepted closes only, note ≥ 3 chars; locked stays locked.
- Never void a confirmed `payroll_runs` row to “fix” drawer drift — reopen and resubmit the close instead.
