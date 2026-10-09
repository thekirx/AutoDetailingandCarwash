# Shop-day runbook (Daily Sheet)

**Purpose:** Principal QA / Branch Admin playbook for one Manila calendar day.  
**Contract:** [docs/OPS/MONEY-CONTRACT.md](../OPS/MONEY-CONTRACT.md) · [docs/user-stories/shop-day-flow.md](../user-stories/shop-day-flow.md) · [docs/daily-sheet/README.md](../daily-sheet/README.md)  
**Money evidence:** `npm run e2e:daily-sheet-money` (sandbox day, wiped)  
**Push rules:** [PUSH-CHECKLIST.md](./PUSH-CHECKLIST.md) · **SMS:** do not test until BrandTxt IP is whitelisted  

> Historical FLOPS (`e2e:lifecycle-flops`) still drives retired End-of-shift / payroll RPCs — do **not** use it as the soft-launch money proof.

## Rules

1. Business date = Asia/Manila (`en-CA` YMD).
2. Paid POS is the money truth. The Daily Sheet attests drawer + expenses + pay against that day.
3. Crew are paid only after SA/ASA **approve** the sheet.
4. Do not re-run mutating money e2e on a live production day you intend to keep.
5. Geofence: for QA, Super Admin may upsert attendance with notes `QA lifecycle override`. Live crew clocks via Attendance.
6. **No owner daily SMS.** Sheet submit/approve use **web push** (staff must Enable alerts on their phone).

## Role path (click order)

| Step | Who | Route / action |
|------|-----|----------------|
| C1 | Customer / public | `/book` or walk-in → queue |
| C1b | Team Lead | `/operations/bookings` → confirm pending detailing |
| C1c | Team Lead / BA | `/operations/bookings?stage=maintenance` → **Car arrived · Start intake** (paint maintenance → Vehicle intake; sends client a status SMS) |
| A1 | Crew | `/operations/attendance` time-in |
| W1 | Team Lead | `/operations/queue` waiting → Start → Final check |
| W1b | Team Lead / BA | Send to payment → `/operations/pos` pay |
| W2 | Team Lead | Cancel waiting ticket (reason ≥ 3 chars) when needed |
| D1 | Branch Admin | POS → **Daily sheet** → fill → Submit |
| D2 | Super Admin / ASA | Finance → **Daily sheets** → Approve or Return |
| Books | SA / ASA / Investor | Finance P&L / Floor Board for that day |

## Status matrix (wash)

`waiting` → `in_progress` → `final_checking` → send to payment → `for_payment` → POS pay → `completed`.

Cancel allowed up to `for_payment`. Redo (Failed QA): mark → `redo` → `in_progress`. Failed QA and the redo pass (`in_progress` / `final_checking` while `redo_at` is set) send no customer SMS and no ops push; `for_payment` and `completed` still notify.

Detailing: `final_checking` → Send to payment (Sales / Admin / SA) → `for_payment`. There is no separate "For releasing" step.

## Safety

- Provision / identify customer before payment handoff when required.
- BA cannot approve their own sheet; ASA/SA can.
- Never wipe September seed or production sheets without an owner decision.
