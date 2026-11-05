# Points shop implementation

Approved source: docs/handoff/points-shop/HANDOFF.md and real-app-options.html Option A + Staff side.
Execute inline in the requested order; no commits, pushes, live writes or migration application.

1. Write one migration and SQL scenarios: preflight lists pending sized claims and aborts; unsized pending claims receive codes and a fresh ten-day hold; fulfilled rows unchanged. Claim locks customer/product and deducts only branch+size, writes ledger/movement; code-only staff handover checks role+branch; expiry locks pending claims and restores stock/points once. Restrict code reads to owning customers and service role. Keep new RPCs service-role-only. Seed three app-only placeholders without photos or stock.
2. Server: map products/size stock into portal, pass size through claim, push confirmation. Add authenticated staff list/verify/handover operation with masked responses and branch scope. Add scheduled expiry and deduplicated reminder/returned-points push inbox messages; never SMS.
3. Customer: Rewards rows under Next reward; Sheet with stock-aware sizes/branch and points calculation; pickup route with pass, countdown and history. Remove Vouchers shop and hard-coded merch points.
4. POS: reuse one pickup component above Items; require server validation of a typed code for the selected claim/customer/branch, then revalidate atomically on handover; never create a sale.
5. Admin: Customers > Merch shop with services_merch access, summaries/filter/customer search/items/waiting/history. Reuse ProductsManagePage form and stock flows in merch mode; reuse content-media upload bucket with appropriate merch-grant access.
6. Website: remove merch tab/grid; point to existing app CTA.
7. Verify focused units (mapping, claim disabled states, size-only stock, code scope, expiry), lint/full tests/build; reproduce failures on clean main. Fixture rig captures customer/staff routes at 390 and 1440; compare with approved mock, exercise controls and check overflow/errors. Update graph (if available), CHANGES.log and delivery notes with migration NOT applied.

Review focus: concurrent claims/expiry/handover, code leakage via direct table reads, wrong branch/customer code, old sized claims, reminder retry/idempotency, restock approval and upload grants. SQL scenarios are written for Kirk/local testing; do not run migrations in this session.
