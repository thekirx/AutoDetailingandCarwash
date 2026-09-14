# Honesty — claim vs MONEY-CONTRACT

| Claim / UI surface | Contract truth | Severity | Status |
|--------------------|----------------|----------|--------|
| “Customize this counter” (was) | Only payment/expense labels — not payroll/P&L | P1 | **Fixed** → “Counter options” + explicit limits |
| EoS feeds payroll amounts | Attestation only; floor recomputes from POS proof | P0 if UI lies | UI already distinguishes Close ₱ vs POS proof ₱ |
| Finance accept auto-pays | Notify + unlock pending only | P0 if implied | Copy: accept ≠ pay |
| CA auto-deduct setting | Manual wizard only (B4) | P1 | Settings/payroll pages already note theater |
| POS expense “recorded” | **Draft**; counts drawer cash-left; not P&L | P1 | **Fixed** toast + CardDescription |
| P&L includes all expenses | Paid/posted only | P1 | Provenance lines on Overview/P&L/Reports |
| BA sells all services | Merch + pay queue only | — | By design |
| My Pay estimate | Wash-pool preview ≠ confirmed | — | Page already labels estimate |
| Empty payment allowlist accepts any | Open-ended was unsafe | P1 | **Fixed** → cash/gcash/card fallback |
| RPC payment methods | Still not DB-enforced | Medium | Residual — UI primary |

## Residual (not P0)

- `complete_pos_sale` payment_method string not cross-checked to `ops_pos_settings` (ops can still typo via API).
- PosPage god-file maintainability.
- Detailing SKUs with wrong `pay_category` may skip ceramic drafts (name/slug heuristics mitigate).
