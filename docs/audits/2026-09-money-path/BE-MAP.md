# BE map — money path (trust boundary)

## Writes (DEFINER RPC / server only)

| RPC / path | Owns |
|------------|------|
| `complete_pos_sale` | Paid sale rows, handoff complete, branch stock deduct, loyalty |
| `submit_shift_close` | EoS attestation (`shift_close_reports`) |
| `review_shift_close` | accept / reject / lock — unlocks pending floor; **does not** rewrite sales |
| `run_payroll` | `payroll_runs` + lines + payroll expenses (advisory lock) |
| `POST /api/notify-pos` | Staff inbox for sale / expense / CA |

## Reads / views

| Artifact | Semantics |
|----------|-----------|
| `finance_daily_pl` | **Paid** sales income ∪ **paid/posted** expenses |
| Client preview | `buildPayrollPreview` / `buildBacoorDailyReport` — never authoritative pay |

## Tables (core)

`sales`, `sale_line_items`, `pos_handoffs`, `expenses`, `product_branch_stock`, `shift_close_reports`, `payroll_runs`, `payroll_lines`, `ops_pos_settings`, `compensation_settings`

## Client must not

- Insert `sales` directly
- Call `run_payroll` as Branch Admin
- Treat EoS attested ₱ as crew pay

## Payment method allowlist

- UI: `isAllowedPosPaymentMethod` (empty list → cash/gcash/card only)
- RPC: still accepts payload string — residual Medium risk (documented); settings-driven UI is primary control
