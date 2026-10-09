# Super Admin / Assistant Super Admin

**Home:** `/operations/dashboard` (Floor Board)  
**Shell:** CommandShell  
**Device:** Desktop-first

## Nav

Floor Board · Queue · Bookings · Attendance · KPI · POS · Inventory · CRM · Reviews · Memberships · Finance · Planner · History · Notifications · People · Branches · Cars · Content · Audit · Data Center · Inquiries · Settings

Retired from this nav: **Console** (off since the Floor Board became the landing surface) and **Payroll / Crew** (`canAccessConsole()` returns `false`; `crew` is denied).

## Daily flow

1. Floor Board / Queue as needed  
2. Finance (Daily sheets → approve / return)  
3. People + grants (SA)  
4. Settings / Notifications

## ASA

Cannot exceed grants. `rbac_edit` required to edit other ASA grants.

Approving a Daily Sheet needs `finance_view`. Setting daily rates or editing Daily sheet rules needs `finance_write`. See `docs/OPS/MONEY-CONTRACT.md`.
