# Super Admin / Assistant Super Admin

**Home:** Super Admin `/operations/dashboard` (Floor Board). General Admin (Assistant Super Admin) `/operations/queue` — no Floor Board.  
**Shell:** CommandShell  
**Device:** Desktop-first  
**Contract:** `docs/OPS/RBAC-MATRIX.md`

## Nav

Floor Insight · Carwash Queue · Detailing Schedule · Team Planner · Point of Sales · Vouchers · Inventory · Financials · Monthly salaries · Approvals · Payslips · Attendance · Customers · Memberships · Inquiries · Branches · Services and Packages · Detailing Packages · Vehicle List · RBAC Delegation · Transfer car · Content · Settings · History · Notifications · Audit · Data Center

Retired from this nav: **Console** (off since the Floor Board became the landing surface) and **Payroll / Crew** (`canAccessConsole()` returns `false`; `crew` is denied).

## Daily flow

1. Floor Board / Queue as needed  
2. Finance (Daily sheets → approve / return). Daily Sheet expenses choose Cash vs GCash.  
3. Monthly salaries — post office/admin pay to account 14 with Cash or GCash (`/operations/monthly-payroll`).  
4. Vouchers — create promo codes (use limit, date window, wash/detailing/any, percent or free). Team Lead applies them on the queue; POS consumes a use on sale.  
5. Inventory — merch branch on-hand on each product row; Sunday recon for chemicals. SA can Lock / Unlock catalog + restock (audit + inbox).  
6. People + grants (SA)  
7. Settings → Account — save your own birthday (required; locks after first save). Attendance shows the month birthday board.  
8. Settings / Notifications

## ASA

Cannot exceed grants. `rbac_edit` required to edit other ASA grants.

Approving a Daily Sheet needs `finance_view`. Setting daily rates or editing Daily sheet rules needs `finance_write`. See `docs/OPS/MONEY-CONTRACT.md`.
