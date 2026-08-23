# 08 — Gaps & risks (do not soft-pedal)

## Product / claim gaps

1. **“Fully customizable”** — false; see [06-SETTINGS.md](./06-SETTINGS.md).
2. **“BA manual POS for services/packages/detailing”** — false; BA merch-only.
3. **“EoS feeds payroll amounts”** — false; reminder + attestation only.
4. **`pending_floor_optional`** — stored, not enforced in Payroll UI.

## Technical / operational risks

| # | Risk | Severity | Notes |
|---|------|----------|-------|
| 1 | Detailing-tab SKUs with non-`detailing` pay_category skip ceramic drafts | Medium | PPF/tint may miss compensation path |
| 2 | Ordinary expense **drafts** inflate EoS expenses / cash-left | Medium | “Recorded” ≠ paid |
| 3 | `ca_collected_minor` baseline 0 while approved CAs already listed | Medium | Double-count training hazard |
| 4 | Payment methods in settings not enforced by RPC | Low–Med | Typos / unknown methods possible |
| 5 | SA merch grid = all products (not sellable filter) | Low–Med | Supplies may appear sellable |
| 6 | Products not branch-scoped | Low | Global active catalog |
| 7 | Handoff missing `service_id` blocks pay | Med (ops) | Stuck until ticket fixed |
| 8 | Visit-group price drift | Med | Sibling booking amounts must stay consistent |
| 9 | `PosPage` god-file | Med (maintainability) | Bugs in wiring |
| 10 | Legacy key `square_sales_minor` | Low | UI labeled Total sales; storage still legacy |

## Security / backend notes (Supabase)

- Keep relying on RPC for sale completion — do not insert `sales` from the client.
- RLS + `complete_pos_sale` role checks remain the trust boundary.
- New settings tables must use `is_super_admin()` / `asa_has_grant(...)` patterns already used (`ops_pos_settings` write).

## Architecture deepening candidates (POS-focused)

1. **Strong** — Deepen cart/sale module (`buildCatalogCartLine` used everywhere; single normalizer locality).
2. **Strong** — Explicit ShopDaySettlement vs FloorPayWindow types in docs + payroll helpers (already partially in behavior).
3. **Worth exploring** — Server allowlist for payment methods from `ops_pos_settings`.
4. **Worth exploring** — Expense draft vs posted policy for EoS (settings flag).

## What is *not* a bug

- BA cannot browse bay/detailing catalog.
- Finance accept does not change sales.
- Payroll not auto-running after close.
- Dual floor/fixed payroll tracks.
