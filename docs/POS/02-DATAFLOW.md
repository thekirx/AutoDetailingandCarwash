# 02 — POS dataflow (tables & RPCs)

## Authoritative money path

```text
Catalog / Pay queue cart
    → buildPosSalePayload (client)
    → RPC complete_pos_sale
    → sales + sale_line_items (+ stock, loyalty, handoff, booking)
```

End of shift does **not** insert sales. It snapshots attestation into `shift_close_reports`.

## Tables touched on paid checkout

| Table | Action |
|-------|--------|
| `sales` | Insert `status = paid` (links `booking_id`, `pos_handoff_id`) |
| `sale_line_items` | Insert lines: `item_type` ∈ `{product, service}` only |
| `products` / `product_stock_movements` | Decrement stock for product lines |
| `loyalty_ledger` / `customers` | Points / stamps per program rules |
| `pos_handoffs` | `pending` → `completed` |
| `transactions` | `pending_payment` → `completed` (when present) |
| `bookings` | Primary (+ visit-group siblings) → `completed` |
| `audit_logs` | `pos.sale` |
| `expenses` | Optional ceramic drafts (`ceramic:{saleId}:crew|detailer`) |

## Tables touched on End of shift

| Table | Action |
|-------|--------|
| `shift_close_reports` | Insert/update via `submit_shift_close` — `pos_baseline`, `submitted`, `override_reasons`, `status = submitted` |

Finance later: `review_shift_close` → `accepted` / `rejected` / `locked`.

## Tables read for POS “Today” baseline

| Source | Filter |
|--------|--------|
| `sales` | `status = paid`, branch, `occurred_at` local calendar day (+08:00 window) |
| `sale_line_items` (+ services/products) | Bucket classification |
| `expenses` | Branch/day; filtered by `expenseCountsOnDailyClose` |
| `ops_form_submissions` (cash advances) | Approved CAs in branch/day for close math |
| `ops_pos_settings` | Payment methods + expense kinds (UI) |
| `compensation_settings` | Ceramic % preview |
| `pos_handoffs` | `status = pending`, branch |

## Line type contract (critical)

| UI catalog_kind | Cart `item_type` | RPC `item_type` | FK |
|-----------------|------------------|-----------------|-----|
| service / package / detailing | `service` | `service` | `service_id` |
| merch / product | `product` | `product` | `product_id` |

Anything else must be normalized via `normalizePosLineItemType` before RPC or checkout fails / FK-errors.

## Expense status vs close vs payroll

| Expense pattern | Counts on EoS? | Used by floor payroll? |
|-----------------|----------------|------------------------|
| Ordinary POS draft (`daily`, etc.) | **Yes** (if not void/pending_*) | No (not wash pool) |
| `ceramic:…` draft | **No** until paid/posted | **Yes** (parsed into crew/detailer lines) |
| `compensation:` / payroll drafts | No until paid/posted | Separate |

## Indexes / integrity (backend notes)

- Paid handoff uniqueness: `sales_pos_handoff_paid_uidx` (one paid sale per handoff).
- Handoff row locked `FOR UPDATE` inside RPC — prevents double pay.
- Branch scope enforced in RPC for ASA/BA patterns — do not bypass with client-only checks.

## What is *not* written by POS

- Payroll run lines (`payroll_runs` / `payroll_run_lines`) — only Payroll confirm.
- Finance P&L rewrite of sales — never.
- Inventory catalog create/edit — Inventory page (`canManageServices`), not POS Settings.
