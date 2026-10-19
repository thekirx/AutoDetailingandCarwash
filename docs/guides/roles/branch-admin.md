# Branch Admin

**Home:** `/operations/pos`  
**Shell:** CommandShell (branch-scoped)  
**Device:** Desktop / laptop; tablet OK

## Nav (sidebar)

Carwash Queue (read) · Detailing Schedule (read) · Team Planner (no Cash advance board) · Point of Sales · Financials · Inventory · Attendance · Customers (create / modify) · My advances · History · Audit · Transfer car  

No Floor Board. Contract: `docs/OPS/RBAC-MATRIX.md`.

## Daily flow

1. POS open — ring wash / merch / packages. A birthday free line needs the customer’s code typed in. The counter does not display the code. A ticket that already has a promo voucher keeps the discounted amount; the sale consumes one voucher use.  
2. Bookings — detailing pipeline is read-only (no new job, no stage move). Queue is read-only. Customers can be created and modified.  
3. Inventory — restock arrivals and Sunday recon (blocked when SA locks inventory)  

4. Attendance exceptions  
5. **POS → Daily sheet** — expenses, crew pay, float, counted cash → Submit  
6. After SA/ASA approve — release cash pay to crew  

## Must never see

All-branch finance write, SA people RBAC for other branches, Data Center (SA), Queue edit (denied by design).

## Notify

- Cash advance requested, then the approval code → your phone (Enable alerts). Type that code on the Daily Sheet before giving cash.  
- Sheet approved / returned → your phone  
See [docs/qa/PUSH-CHECKLIST.md](../../qa/PUSH-CHECKLIST.md).
