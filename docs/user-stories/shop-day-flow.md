# Shop-day money path (locked)

> **Canonical since 2026-10-01.** End of shift → Finance accept → floor payroll was replaced by the **Daily Sheet**.  
> Owner guide: [`docs/daily-sheet/README.md`](../daily-sheet/README.md) · Contract notes: [`docs/OPS/MONEY-CONTRACT.md`](../OPS/MONEY-CONTRACT.md)

End-to-end bay day: clock-in → wash queue / detailing bookings → POS paid tickets → Branch Admin Daily Sheet → SA/ASA approve → books (posted expenses + salaries) → Floor Board / P&L.

Amounts are **minor units (centavos)** unless shown as ₱.

```
Crew clock (geo)     TL wash tickets      Sales / detailing board
        \                    |                      /
         \                   v                     /
          \ ---------->  POS paid tickets  <------/
                              |
                     Daily Sheet (BA submit)
                              |
                     SA / ASA approve or return
                              |
                     Posted expenses + crew pay
                              |
                     Finance P&L + Floor Board (paid POS truth)
```

## Roles

| Step | Who | Route / RPC |
|------|-----|-------------|
| Clock in | Crew, Team Lead | `/operations/attendance` |
| Wash tickets | Team Lead | `/operations/queue` |
| Detailing jobs | Detailer / Sales / TL | `/operations/bookings` |
| Checkout | Branch Admin | `/operations/pos` |
| Close day | Branch Admin | POS → **Daily sheet** · `submit_daily_sheet` |
| Approve / return | SA / ASA (`finance_view`) | Finance → **Daily sheets** · `review_daily_sheet` |
| Books | SA / ASA / Investor | Finance P&L · Floor Board money |

## Money rules (this slice)

1. **Paid POS** is income truth (wash, detailing, merch; cash / GCash / card). CA repayments are not sales.
2. **Daily Sheet** pulls money-in from paid tickets; BA enters expenses, crew pay (with reasons on overrides), float, and counted cash.
3. **Approve once** posts salary + expense lines as paid `expenses`. Reopen voids those posts and returns the sheet.
4. **P&L / Floor Board** read `finance_daily_pl` and paid sales — not fiction typed on the sheet.
5. **Cash advances** release on the Daily Sheet; SA/ASA approve them with the sheet (not a separate payroll wizard).
6. **Notify:** sheet submit → web push to SA/ASA; approve/return → web push to submitting BA. **No owner SMS.**

## Evidence

| Check | Result |
|-------|--------|
| `e2e:daily-sheet-money` | 38/38 |
| Role probe (TL→BA→ASA→SA) | 20/20 rollback |
| September seed verify | 23/23 |
| Recipient rules | `tests/notificationRecipients.test.js` |

## Related

Persona epics: [`README.md`](./README.md) · Architecture: [`docs/architecture/daily-sheet.workflow.html`](../architecture/daily-sheet.workflow.html)
