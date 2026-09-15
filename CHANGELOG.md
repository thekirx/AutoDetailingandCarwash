# Changelog

## 2026-09-15 — Car size chart accuracy + bay size pricing

- Cars catalog sizes follow body footprint: **Small** = sedans/hatchbacks · **Medium** = crossovers · **Large** = SUVs/pickups/larger MPVs · **Extra Large** = full-size vans/people movers (e.g. Raize/Q2 medium, Civic/Corolla small, Tucson/Sportage large).
- Live `vehicle_catalog.size_slug` resynced for all 492 rows; inference + Cars UI copy match the chart.
- Wash, packages, and bay services now have S/M/L/XL `service_size_prices` (same 0.85 / 1 / 1.2 / 1.4 ratios as detailing). Inventory create defaults size pricing on for all four tiers.
- Legacy `sedan` maps to small for price lookup.
- DB advisors: covering FK indexes, RLS `auth.uid()` initplan fixes, revoke Ops Lab trigger RPCs from anon/authenticated.

## 2026-09-15 — Wash vs detailing catalog split hardened

- Online `/book` and `/api/public-book` accept detailing SKUs only (Ceramic / Tint / PPF / Paint Maintenance). Same-day wash and packages stay on the shop queue.
- Queue create and visit upsell reject detailing; ticket editor add-service lists bay Services & Packages only.
- Bookings board no longer treats legacy `pay_category=ppf` package rows as multi-day detailing. Live PPF film remains `pay_category=detailing`.
- Database CHECK constrains `services.pay_category` to the known catalog families.

## 2026-09-15 — PH car size on catalog, tickets, bookings

- Super Admin Cars stores `vehicle_catalog.size_slug` (Small / Medium / Large / Extra Large). Live Hakum rows are backfilled from the PH bay chart (Vios/City small, Civic/Xpander medium, Fortuner/Hilux large, Alphard/Hiace extra large).
- Picking make + model auto-selects that size on TL queue, bookings, public/account book, CRM, and garage. Staff and customers can override; service and package prices follow `bookings.vehicle_type`.
- Legacy garage values (`sedan` / `suv`) still map to pricing slugs. Seed upserts `size_slug`.

## 2026-09-14 — Floor, maintenance, people, BA view-only

- Floor Board shows Services & Packages and Detailing Services as separate lane strips. Branch-scoped Floor has the same split.
- Maintenance tab lists overdue/due-soon and un-notified plates. Notify client sends SMS/push to book paint maintenance. Set date marks the visit done and hides the plate until the next cycle. Search finds already-notified upcoming cars. TL can ticket a paint-maintenance booking.
- People: Crew / Team Leads / Admins / Office tabs, Create account modal, directory search/filter, attendance dashboard, Super Admin supervisor tag and reports-to.
- `/operations/crew` redirects to Attendance for every role. Branch Admin can open Queue and Bookings as view-only (no ticket/status writes).

## 2026-09-14 — Finance books honesty

- Default reporting window is last 30 days. An empty window names the last paid POS day and can jump to it. Custom ranges reject end-before-start and do not query inverted dates.
- Reports retention follows last paid in the same window; crew KPI is labeled as the current roster. Five primary tabs plus More; period/branch stay in the URL. Vendors no longer hang on a loading skeleton.
- Unposted crew pay and missing shift closes are cues that open Payroll / POS. Categories “Payroll / salary” is a P&L bucket, not commission %.
- Sales, bills, P&L, and Reports export CSV. Dashboard still offers CSV, Excel, and PDF. Quotes reject ₱0. The Finance guide Payroll step is a real link.
- Deferred: brand pass, Xero clone. Quotes and Corporate stay under More.

## 2026-09-14 — Payroll register honesty

- Wash pool drops merch/product/coffee lines. POS proof shows theoretical pool vs allocated and names missing attendance. Wizard and Rules amounts are pesos; owner % clamps to 0–100.
- Every period is date-checked. Settings → Payroll writes require Super Admin or ASA finance write. Inventory salary % copy matches the engine (paid on confirm).
- Deferred: server recompute of `run_payroll` amounts, pending-floor RPC gate, hybrid/custom salary math, brand pass.

## 2026-09-14 — POS money integrity

- Loyalty awards require a linked customer with an earned milestone; the RPC consumes stamps. Catalog prices are re-checked server-side; GCash/card need a payment reference.
- Branch Admin no longer sees POS Settings (SA / ASA `finance_write` only). Phone tab strip starts left so Sell is reachable. Cart drafts persist in session storage.
- Deferred: receipt/print, void/refund, add/remove payment-method rows, RPC payment-method allowlist.
