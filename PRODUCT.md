# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: Hakum Auto Care shop staff and managers (Branch Admin, Team Lead, crew, detailer, Super Admin / Assistant Super Admin, Finance viewers) running a multi-branch car wash and detailing operation in Metro Manila.

Secondary: retail customers booking detailing, tracking wash queue, loyalty, vouchers, and visit feedback on a mobile-first customer app.

## Product Purpose

Hakum Auto Care staff ops + customer portal for same-day wash/packages queue, multi-day detailing bookings, POS, Daily Sheet money close, Finance books, planner/forms, inventory, and memberships—so each branch can run the shop day and close cash without a separate floor-payroll wizard.

Success: paid POS is income truth; one Daily Sheet per branch per Manila day is approved into books; customers get outbound BusyBee status/reminder SMS only (no inbound SMS inbox, no owner daily close SMS).

## Positioning

Branch-scoped shop-day operating system for wash + detailing under one Hakum brand: queue → POS → Daily Sheet → Finance approve, with role docks (phone floor vs desktop command) rather than a generic booking SaaS.

## Operating Context

- Branches (e.g. Bacoor / Imus), Manila calendar day, geofenced attendance, Team Lead queue, Branch Admin POS + Daily Sheet, SA/ASA Finance approve (web push).
- Money triangle documented in `docs/OPS/MONEY-CONTRACT.md` and `docs/daily-sheet/`.
- Customer app: book detailing, live queue, vouchers/birthday/referral, thumbs-up Google / thumbs-down complaints form.

## Capabilities and Constraints

- Stack: Vite + React SPA, Node `/api/*`, Supabase Auth/RLS/RPCs (`lybxhpzzqqyqswvuwpxv`).
- Daily Sheet line kinds: expense, salary, ca_release, ca_repay. Cash advances are drawer moves, not P&L.
- SMS: BusyBee outbound customer reminders/status only; Finance accept uses web push.
- Access contract: `docs/OPS/RBAC-MATRIX.md` (19 Oct sheet). People uses those names and shows each role’s access. Write locks: `20261019180000_rbac_sheet_write_locks`. Friend referral points and discount % are Settings values (default 50 / 3% until Sir saves another). Detailing board has no List tab. POS car-size buttons are S/M/L/XL. Sellables can store optional named sizes. A planner task can link one form.
- *(Inferred from repo/docs 19 Oct 2026 — user asked to proceed with Impeccable setup without a separate interview round.)*

## Brand Commitments

Name: Hakum Auto Care. Ops visual identity is the incumbent daylight/command shell in-repo (no redesign in this PRODUCT.md). Do not invent a new visual world here.

## Evidence on Hand

- `CONTEXT.md`, `docs/OPS/MONEY-CONTRACT.md`, `docs/plans/2026-10-18-michi-notes-checklist.md`, `docs/architecture/*` Archify HTML, role guides under `docs/guides/roles/`.
- No fabricated testimonials or revenue claims.

## Product Principles

1. Paid POS is the only income source of truth.
2. One Daily Sheet per branch per day; approve posts books once.
3. Smallest correct change; do not rebuild Done checklist rows.
4. Customer messaging stays outbound-only; never treat owner handset env as a launch gate.
5. Preserve incumbent ops UI unless an explicit redesign is requested.

## Accessibility & Inclusion

Touch-first floor docks (min hit targets ~44px in ops UI). No separate WCAG target recorded beyond incumbent patterns.
