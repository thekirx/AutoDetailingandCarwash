# Hakum Phase 2 — internal system backlog

Recorded 22 October 2026. **Documentation only; no Phase 2 work is authorized or implemented.**

This repository contains both the public React/Vite website and the internal application, plus API/server code and checked-in database migrations. Findings below come from static inspection, not a live database or permissions audit. Verify deployed definitions and all callers before implementing. Proposed database work is conditional on that audit. No database, authentication, authorization, API, queue, or POS changes were made in Phase 1.

## HAK-01 — Rename Floor Board to Floor Insight

- **Requested behavior:** Use Floor Insight consistently in module navigation, headings, and relevant references.
- **Current implementation:** `src/pages/SuperAdminFloorBoard.jsx` renders “Floor Board”. `src/auth/permissions.js` already names the insight navigation group “Floor Insight” while some child labels remain “Floor Board”.
- **Frontend affected:** That page, navigation labels in `permissions.js`, relevant role descriptions in `src/auth/internalRoles.js`, and matching UI tests/documentation. Inspect all references to distinguish display text from internal identifiers.
- **Backend affected:** None expected for display labels; confirm no integrations depend on those labels.
- **Potential database changes:** None expected. Preserve existing routes and identifiers unless separately justified.
- **Authorization/security:** Preserve all current grants, role restrictions, and branch scoping.
- **Dependencies:** Agree terminology for the existing group versus its renamed child module.
- **Recommended approach:** Inventory visible labels, update copy only, then verify each authorized role's navigation and headings.
- **Acceptance criteria:** Relevant visible labels say Floor Insight; existing links and role access remain unchanged; internal identifiers are not needlessly renamed.
- **Estimated complexity:** Low.

## HAK-02 — First Come, First Served Queue

- **Requested behavior:** Earliest waiting arrival first; new arrivals at the bottom; order survives refresh and agrees across users. Define what requeueing means.
- **Current implementation:** `sortTicketsFifo` in `src/queue/queueLogic.js` sorts by `waiting_at`, falling back to `created_at`, then `queue_number`. `src/pages/TeamLeadQueuePage.jsx` uses it. `src/queue/queueApi.js` also fetches queue rows by descending `created_at` with a limit of 250. This is evidence of partial support, not proof that every queue surface implements arrival ordering correctly.
- **Frontend affected:** Team Lead queue, other internal/public queue boards, `queueLogic.js`, `queueApi.js`; audit their individual ordering and realtime refresh paths.
- **Backend affected:** Queue loading, arrival/status transitions, timestamp assignment, realtime synchronization, and any server-side limits/pagination.
- **Potential database changes:** Audit persisted `waiting_at`, `created_at`, and `queue_number` before proposing fields or indexes. Consider a persisted arrival timestamp only if existing timestamps cannot represent the agreed rule.
- **Authorization/security:** Preserve branch restrictions; clients must not forge arrival priority. Timestamp writes and requeue actions require server enforcement and an audit trail.
- **Dependencies:** Agree whether returning to waiting retains original arrival or starts a new wait. Define ties, missing/invalid timestamps, branch/timezone boundaries, and pagination behavior.
- **Recommended approach:** Trace all queue consumers and timestamp writers, validate existing FIFO behavior, establish a deterministic final tie-breaker, then align fetch/sort/realtime behavior without replacing working logic unnecessarily.
- **Acceptance criteria:** Earlier arrival appears first; new jobs append; two sessions and refresh show identical order; oldest waiting rows are not lost to query limits; ties, legacy missing dates, and requeued jobs follow documented rules.
- **Estimated complexity:** Medium.

## HAK-03 — Restrict Admin POS to retail

- **Requested behavior:** Admin POS independently sells coffee, merchandise, accessories, and other retail products. Car wash/detailing service job orders originate from Team Leads. Cashiers can still collect payment against those job orders.
- **Current implementation:** `src/pages/PosPage.jsx` builds service/package catalog entries alongside product entries and calls `complete_pos_sale`. That file alone does not establish every role's effective server permissions. `src/auth/permissions.js` contains POS access helpers. Checked-in `supabase/migrations/20260914120000_pos_sale_integrity.sql` defines a wrapper around `complete_pos_sale_impl`; review all subsequent definitions and the deployed functions before changing enforcement.
- **Frontend affected:** `PosPage.jsx`, `src/pages/pos/`, catalog filters, linked queue checkout, receipt/history views, and role-aware navigation.
- **Backend affected:** `complete_pos_sale` and its implementation, sale validation, job-order linkage, and service mutation entry points.
- **Potential database changes:** Possibly constraints or RPC validation for service lines requiring an authorized source job order. Audit current sales/booking relationships first.
- **Authorization/security:** Enforce retail-only independent sales on the server. Reject forged service lines, role bypasses, cross-branch job orders, and unauthorized price changes. UI filtering is insufficient.
- **Dependencies:** HAK-04; clarify which existing role identifiers “Admin” and “Cashier” mean and whether privileged override roles are allowed.
- **Recommended approach:** Separate retail catalog entry from payment of existing service orders; enforce job-order provenance and totals in the sale transaction; retain consolidated reporting and reconciliation.
- **Acceptance criteria:** Retail checkout succeeds; Admin cannot independently add services through UI or direct requests; authorized Team Lead orders remain payable; receipts, sales reporting, stock changes, and reconciliation remain correct.
- **Estimated complexity:** High.

## HAK-04 — Team Lead job order ownership

- **Requested behavior:** All wash/detailing service orders originate from the Team Lead workflow. For additions: Admin receives request → informs Team Lead → Team Lead updates order → system reflects change → Cashier collects corresponding payment.
- **Current implementation:** `src/components/QueueTicketEditor.jsx` calls `addServiceToVisit` in `src/queue/queueApi.js`. The editor's current explanatory text lists several roles able to add services. `src/auth/permissions.js` contains `canAddQueueService` and related helpers. These paths require a complete server-side authorization review; the future restriction must not be inferred from UI text.
- **Frontend affected:** Team Lead queue, new ticket/order creation flows, ticket editor/modal, Admin request handling, and POS linked-order checkout.
- **Backend affected:** Order/booking creation, `addServiceToVisit` persistence, status transitions, price mutation, checkout validation, audit events, and realtime refresh.
- **Potential database changes:** Possibly order ownership/provenance, revision/audit records, or transactional checks against stale order versions; inspect existing schema before choosing.
- **Authorization/security:** Restrict service creation/modification server-side to approved Team Lead roles. Prevent forged ownership, cross-branch changes, duplicate service lines, and charging a stale total. Define how already-paid orders may be amended.
- **Dependencies:** HAK-03 and approved role/override policy. Agree how Admin informs the Team Lead; do not assume a new messaging subsystem is required.
- **Recommended approach:** Map all service-order entry points, preserve the existing visit/order identity, enforce ownership across those entry points, and make Cashier checkout use the current authoritative order total.
- **Acceptance criteria:** Team Leads create/edit eligible orders; Admin cannot bypass ownership; additions appear consistently across sessions; Cashier pays the updated total; concurrent edits and paid-order amendments follow agreed rules; consolidated sales, reconciliation, and audit history remain intact.
- **Estimated complexity:** High.

## HAK-05 — Service-specific vouchers

- **Requested behavior:** Target an individual service, selected packages, multiple selected services, or all eligible services; support a ceramic-tint-only voucher.
- **Current implementation:** `src/lib/promoVoucher.js` exposes category scopes `wash`, `detailing`, and `any`, using category/kind rather than selected IDs. `src/pages/VouchersPage.jsx` reads/writes `promo_vouchers`. The checked-in migration `supabase/migrations/20261019110000_promo_vouchers.sql` contains voucher schema and application/consumption RPCs; deployed behavior must be audited before implementation.
- **Frontend affected:** Voucher management, `CustomerVouchersPage.jsx`, `promoVoucher.js`, ticket voucher application in `QueueTicketEditor.jsx`, and POS consumption in `PosPage.jsx`.
- **Backend affected:** `apply_booking_promo_voucher`, `consume_booking_promo_voucher`, sale calculations, eligibility and redemption validation.
- **Potential database changes:** Possible voucher-to-service/package relationships or an explicit eligibility representation. Define compatibility for existing category-scoped vouchers before migrating.
- **Authorization/security:** Validate eligible IDs and prices on the server; preserve expiry, active state, per-customer and global limits; make redemption atomic and resistant to duplicate/concurrent consumption.
- **Dependencies:** Service/package identifiers, whether packages qualify by package ID or included services, and HAK-06's calculation/stacking rules.
- **Recommended approach:** Audit current schema and RPCs, define eligibility semantics, retain legacy behavior explicitly, then add precise selectors and authoritative server validation.
- **Acceptance criteria:** Tint-only vouchers reject unrelated services; each requested scope works; mixed orders discount only eligible lines; expiry/usage restrictions survive direct requests and concurrent checkout; historical vouchers remain interpretable.
- **Estimated complexity:** High.

## HAK-06 — Fixed amount discounts

- **Requested behavior:** Add a fixed peso amount (for example ₱300 off), alongside percentage discount and free service.
- **Current implementation:** `src/lib/promoVoucher.js` exposes `percent` and `free`; `promoDiscountedPriceMinor` handles those cases. `VouchersPage.jsx` uses `discount_kind` and `discount_percent`. Review `20261019110000_promo_vouchers.sql`, related checkout calculations, and deployed RPCs before extending the model.
- **Frontend affected:** Voucher form, customer voucher labels/rules, `promoVoucher.js`, Team Lead application, POS totals/receipts, and reporting views that describe discounts.
- **Backend affected:** Voucher creation validation, application/consumption RPCs, sale totals, redemption tracking, and reporting/reconciliation calculations.
- **Potential database changes:** A fixed-amount field in integer minor units and updated kind/value constraints may be needed; determine final schema after auditing existing storage.
- **Authorization/security:** Reject negative/invalid values; calculate discounts on the server; cap at the eligible subtotal and applicable limits; preserve per-customer limits and atomic redemption tracking. A voucher must not create a negative payable amount.
- **Dependencies:** HAK-05 eligibility; decide per-line versus per-order application, stacking, refund allocation, and treatment of fees/taxes.
- **Recommended approach:** Define currency/rounding/allocation rules, extend authoritative calculations and validation, then update UI labels and receipts consistently. Preserve percentage/free behavior and historical reporting.
- **Acceptance criteria:** ₱300 discounts eligible totals correctly, including totals below ₱300; percentage/free vouchers still work; invalid/ineligible/expired/exhausted vouchers fail server-side; duplicate checkout cannot double-redeem; refunds and sales reconciliation use the recorded discount consistently.
- **Estimated complexity:** High.

## Scheduling and release boundary

Obtain explicit Phase 2 authorization before implementation. Resolve the role and ownership policy for HAK-03/04 together, and the eligibility/calculation policy for HAK-05/06 together. Validate HAK-02's existing FIFO implementation before estimating changes. Each release needs role-based integration tests, concurrency checks, and review of deployed schema/RPCs. This document does not authorize migrations, permission changes, or deployment.
