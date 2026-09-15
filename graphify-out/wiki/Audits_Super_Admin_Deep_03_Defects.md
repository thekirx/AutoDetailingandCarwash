# Audits Super Admin Deep 03 Defects

> 11 nodes · cohesion 0.18

## Key Concepts

- **20260819140000_concurrency_hot_path.sql** (5 connections) — `supabase/migrations/20260819140000_concurrency_hot_path.sql`
- **bookings_for_payment_floor_idx** (2 connections) — `supabase/migrations/20260819140000_concurrency_hot_path.sql`
- **expense_status_events_expense_id_idx** (2 connections) — `supabase/migrations/20260819140000_concurrency_hot_path.sql`
- **loyalty_ledger_sale_id_idx** (2 connections) — `supabase/migrations/20260819140000_concurrency_hot_path.sql`
- **sale_line_items_product_id_idx** (2 connections) — `supabase/migrations/20260819140000_concurrency_hot_path.sql`
- **transactions_pos_handoff_idx** (2 connections) — `supabase/migrations/20260819140000_concurrency_hot_path.sql`
- **public.expense_status_events** (1 connections)
- **public.loyalty_ledger** (1 connections)
- **public.bookings** (1 connections)
- **public.sale_line_items** (1 connections)
- **public.transactions** (1 connections)

## Relationships

- No strong cross-community connections detected

## Source Files

- `supabase/migrations/20260819140000_concurrency_hot_path.sql`

## Audit Trail

- EXTRACTED: 10 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*