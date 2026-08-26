# 07 — Role workflows (SA / ASA / BA / TL)

Plain-language day paths as **implemented**. Change only after owner questionnaire.

## Team Lead (TL)

1. Creates / runs **Queue** tickets (wash / packages).
2. Assigns crew; advances statuses toward final check.
3. Does **not** own the register; typically does **not** send to payment (admin gate).
4. Does **not** open POS as primary tool.
5. Clocks attendance (feeds later floor payroll weight).

## Branch Admin (BA)

1. Lands on **POS**.
2. **Sell:** merch only (tagged sellables).
3. **Pay queue:** take payment for handoffs (services come from ticket `service_id`).
4. May add merch onto an open handoff.
5. **Expenses:** draft day expenses (finance write allowed for BA).
6. **End of shift:** attest baseline; submit for Finance.
7. Does **not** run Payroll; does **not** open Finance (route matrix).
8. Cash advances: feels them in close totals after Payroll approval — does not approve on POS.

## Assistant Super Admin (ASA)

1. Needs `permission_grants.pos` for POS; `finance_view` / `finance_write` for Finance/Payroll slices.
2. With POS: full catalog sell (bay / detailing / merch) like SA.
3. May review closes / run payroll only if grants allow.
4. Expense reports path is separate from POS day drafts.

## Super Admin (SA / BossMich)

1. Full POS catalog + Inventory management link.
2. Finance: accept/reject/lock End of shift.
3. Payroll: pending floor reminder → Run floor / fixed → confirm.
4. Settings: POS lists + shift-close fields; Payroll policy columns.
5. Data Center / Reports for broader visibility.

## Interaction matrix (money)

| Action | TL | BA | ASA | SA |
|--------|----|----|-----|-----|
| Create queue ticket | Yes | View-limited | If granted | Yes |
| Send to payment | No* | Yes | If pos/admin | Yes |
| Sell merch on POS | No | Yes | If pos | Yes |
| Sell bay/detailing walk-in | No | No | If pos | Yes |
| Submit End of shift | No | Yes | Yes | Yes |
| Accept close (Finance) | No | No | If finance | Yes |
| Run floor payroll | No | No | If payroll | Yes |

\*Unless owner changes product standard.

## Ease of use (honest)

- **BA path** is straightforward **if** training matches merch + Pay queue + EoS.
- Confusion spikes when BA expects walk-in services, or when SA treats close ₱ as payroll.
- SA/ASA full catalog is powerful but denser (membership, ceramic, loyalty).
