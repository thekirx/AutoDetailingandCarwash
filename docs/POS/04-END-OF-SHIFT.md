# 04 — End of shift (truth & attestation)

## Purpose (honest)

End of shift is a **shop-day settlement attestation**: BA (or SA/ASA) confirms “this is what we believe the register day looked like,” against a **POS-computed baseline**, then Finance reviews. It is **not** a second sales ledger and **not** the payroll calculator.

## Baseline source (real data)

Built in `PosPage` via `buildBacoorDailyReport`:

| Input | Source |
|-------|--------|
| Sales | Today’s **paid** `sales` for branch → `paidSalesToBacoorRows` |
| Expenses | Today’s expenses filtered by `expenseCountsOnDailyClose` |
| Cash advances | Approved CAs in branch/day → `approved_ca[]` and expense total impact |

### Computed money fields (examples)

- **Total sales** — sum of paid POS (`square_sales_minor` legacy key; UI label “Total sales”)
- GCash / card / cash-left formula
- Category buckets (wash, coating, PPF, tint, merch families, …)
- Expense totals and salary-kind splits from expense_kind heuristics

Keys: `SHIFT_CLOSE_COMPUTED_KEYS` in `src/lib/shiftClose.js`.

### Manual baselines (start at 0)

- `downpayments_minor`
- `ca_collected_minor`

**Important:** Approved CAs already appear in `approved_ca` / expenses path. `ca_collected_minor` is a **separate typed field** (easy to double-count if BA misunderstands). Training required.

## Overrides

- If `shift_close_field_config.allow_override` is true, BA may change a computed field.
- Override requires a reason (≥ 3 characters) — `validateShiftCloseSubmit`.
- Submitted payload stores both `pos_baseline` (system) and `submitted` (final attested) plus `override_reasons`.

## Wizard steps

1. When — `shift_ended_at`
2. Money in — totals / tender
3. Breakdown — categories / expenses
4. Review — submit

UI: `ShiftCloseWizard.jsx`. RPC: `submit_shift_close` → `shift_close_reports.status = submitted`.

## Does it “make sense”?

| Question | Answer |
|----------|--------|
| Does baseline come from real paid sales? | **Yes** |
| Can BA lie / mistype with a reason? | **Yes** (by design, if override allowed) |
| Does Finance rewrite POS sales on accept? | **No** |
| Does accepting close pay crew? | **No** — only queues pending floor opportunity |
| Is cash-left always physically true? | **Not guaranteed** — draft expenses count; CA collected is manual |

## Strict judgment

**EoS is coherent as an attestation + Finance review workflow.**  
**EoS is incomplete as a single source of truth for cash or payroll** if operators treat attested ₱ as pay or as bank-reconciled cash without understanding drafts and manual CA fields.

## Related Finance UI

`FinanceShiftCloseTab.jsx` — accept / reject / lock; “Floor pay” column is coverage reporting only.
