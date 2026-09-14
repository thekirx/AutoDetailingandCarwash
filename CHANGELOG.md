# Changelog

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
