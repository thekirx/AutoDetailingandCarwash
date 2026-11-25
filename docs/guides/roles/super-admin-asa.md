# Super Admin / Assistant Super Admin

**Home:** Super Admin `/operations/dashboard` (Floor Board). General Admin (Assistant Super Admin) `/operations/queue` — no Floor Board.  
**Shell:** CommandShell  
**Device:** Desktop-first  
**Contract:** `docs/OPS/RBAC-MATRIX.md`

## Nav

Floor Insight · Carwash Queue · Detailing Schedule · Team Planner · Point of Sales · Catalog & Inventory · Financials · Payslips · Employees · Customers · Rewards · Branches · Content · Settings · History · Notifications · System & Data

Retired from this nav: **Console** (off since the Floor Board became the landing surface) and **Payroll / Crew** (`canAccessConsole()` returns `false`; `crew` is denied).

## Daily flow

1. Floor Board / Queue as needed  
2. Financials (`/operations/finance`: Overview & Books → Daily sheets approve/return; **Monthly salaries** `?tab=salaries`; **Approvals** `?tab=approvals`; **Reports** `?tab=reports`). Daily Sheet expenses choose Cash vs GCash.  
3. Rewards (`/operations/rewards`) — expandable dropdown for **Memberships & Loyalty**, **Vouchers** (create promo codes with use limit, date window, wash/detailing/service scope, percent/fixed/free; Team Lead applies them on the queue and POS consumes a use on sale), **Sellables for Points**, and **Referrals & Bonuses**.  
4. Catalog & Inventory (`/operations/inventory`) — expandable dropdown for **Services & Packages**, **Detailing Packages**, **Merch & Sellables** (with branch on-hand per row), **Vehicle List** (master make/model sizes), and **Sunday Recon** for chemicals. SA can Lock / Unlock catalog + restock (audit + inbox).  
5. System & Data (`/operations/system`) — **Audit log** and **Data Center** (SA).  
6. Employees (`/operations/employees`) — expandable dropdown for **Attendance**, **Register**, **Employee list**, **RBAC & roles**, and **Settings**.  
7. Customers (`/operations/crm`) — expandable dropdown for **Directory**, **Transfer car**, **Inquiries**, and **SMS**.  
8. Settings (`/operations/settings`) — Owner (`BossMich`) can toggle the **Hakum Concierge Chatbot** ON or OFF globally across public and customer app pages and customize its greeting, accent preset, Facebook/Messenger human handoff URLs (`https://www.facebook.com/profile.php?id=61573318005308`), non-invasive featured product spotlight, and suggested prompts at `/operations/settings/chatbot` (`app_settings.chatbot_widget`), manage **Tint Finder** (`/operations/settings/tint-finder`), save birthday once under Account, and set Daily Sheet / POS / Attendance rules.  
9. Notifications (`/operations/notifications`)

## ASA

Cannot exceed grants. `rbac_edit` required to edit other ASA grants.

Approving a Daily Sheet needs `finance_view`. Setting daily rates or editing Daily sheet rules needs `finance_write`. See `docs/OPS/MONEY-CONTRACT.md`.

## Merch shop
Manage app-only points items, real photos, descriptions, sizes, points, visibility, and branch stock using the usual stock controls. Requires the services_merch grant. Waiting pickups show masked codes: ask the customer for their code, enter it, then Hand over. This never creates a sale. Holds expire after ten days and return stock and points automatically; customers cannot cancel.
