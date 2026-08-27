# Shop-day money path (locked)

End-to-end bay day: clock-in → wash queue → detailing booking → POS → end of shift → Finance accept → floor payroll → books.

Amounts are **minor units (centavos)**. Expected pesos in seam tests are **literals**, not recomputed from the engine.

```
Crew clock (geo)     TL wash tickets      Sales detailing board
        \                    |                      /
         \                   v                     /
          \ ---------->  POS paid tickets  <------/
                              |
                     End of shift (BA attest)
                              |
                     Finance accept / lock
                              |
                     Pending floor (attested ₱ | POS proof ₱)
                              |
                     SA/ASA floor confirm
                              |
                     Finance P&L (paid POS, not close fiction)
```

## Roles

| Step | Who | Route / RPC |
|------|-----|-------------|
| Clock in | Crew, Team Lead | Attendance; Super Admin does **not** floor-clock |
| Wash tickets | Team Lead | `/operations/queue` (wash only) |
| Detailing jobs | Sales | Bookings board; assign staff |
| Checkout | Branch Admin | POS; cash / GCash / card |
| Close | Branch Admin | End of shift wizard |
| Accept close | SA / ASA | Finance Shift Close · `review_shift_close` |
| Floor pay | SA / ASA finance grant | Payroll · `run_payroll` |
| Books | SA / ASA / Investor | Finance P&L |

## Money rules (this slice)

1. **Wash pool** = wash-eligible paid POS × `wash_pool_pct` (default 35%) × attendance weight. **Bay crew only** — not detailer, team lead, admin, or sales.
2. **Late** with clock + shift window = remaining shift / scheduled (9:00 on 8:00–16:00 → **0.875**). Status `late` without a clock still uses **0.7**.
3. **Absent** = weight 0, not assignable, no pool share, no detailing commission (`missing_assignee` holds the line; confirm blocked).
4. **Detailing commission** pays the assigned staff on booking **and** walk-in POS (`assigned_staff_id` / `detailer_staff_id` / expense `assignedDetailerId`). Stays on the job’s branch.
5. **Carwash salary cell** on the Bacoor/EoS report = **wash pool only**. Ceramic crew share is a detailing split on payroll lines, not extra carwash salary.
6. **Cash advance** is a labeled payroll deduct (`approved` / `accepted` / `paid` only). Never sales. Never auto-applied in preview (contract B4).
7. **Pending floor** lists accepted branch-days with close attested ₱ beside POS proof ₱. `pending_floor_optional = false` hard-blocks confirm until an accepted/locked close exists.
8. **P&L income** = paid POS. Close overrides do not invent revenue.

## Worked example (seam literals)

Same calendar day, two branches. Shirt deduct ₱500 on a ₱10,000 coating.

| Fact | Minor | ₱ |
|------|------:|--:|
| Bacoor wash sales | 200_000 | 2,000 |
| Bacoor wash pool 35% | 70_000 | 700 |
| On-time vs 60 min late (8h) | 37_333 / 32_667 | 373.33 / 326.67 |
| Imus wash sales | 100_000 | 1,000 |
| Imus wash pool (crew only) | 35_000 | 350 |
| Coating ₱10,000 − ₱500 shirt | 950_000 remaining | 9,500 |
| Crew 10% + assigned detailer 10% | 95_000 each | 950 each |
| Approved CA ₱200 off ₱700 wash | net 50_000 | 500 |

Bacoor EoS **carwash salary** = **70_000**, not 70_000 + ceramic crew.

## Public seams

| Seam | Module |
|------|--------|
| `attendanceWeight`, `hhmmToMinutes`, `splitWashPool`, `buildCeramicCompensationExpenses` | `src/lib/compensation.js` |
| `buildPayrollPreview`, `applyCashAdvanceDeductions`, `buildPendingFloorPayrollQueue`, `floorConfirmBlockedByPendingCloses`, `applyFloorPreviewToBacoorReport`, `buildRunPayrollPayload` | `src/lib/payroll.js` |
| `buildShopDaySettlementReport`, `shopDayShouldClose` | `src/lib/shopDaySettlement.js` |
| `classifySaleBucket` | `src/lib/bacoorDailyReport.js` |
| `classifyFloorSaleBucket` | `src/lib/paymentMethods.js` |
| `isAssignableAttendanceStatus` | `src/queue/queueLogic.js` |
| `allowRoute` | `src/auth/permissions.js` |
| `rollupPl` | `src/lib/financeData.js` |

## Tests that lock this path

- `tests/dailyOpsNetwork.test.js` — two branches, late/absent, CA, assigned detailer
- `tests/dailyOpsWorkflow.test.js` — one branch through close → payroll → P&L
- `tests/moneyContract.test.js` — B4, D2, D3, C1
- `tests/payrollSeam.test.js` — ceramic assignee gate, floor vs fixed
- `tests/hakumRedesignLibs.test.js` — floor bucket `detailing` vs merch
- `tests/shopDaySettlement.test.js` — report salary from preview

## Related role epics

Non-money pages (People, Planner, CRM, Customer portal, etc.) live beside this path in [`README.md`](./README.md). Shop-day acceptance boxes are fully checked; overlap/double-pay naming is covered in `tests/payrollFullStack.test.js`.
