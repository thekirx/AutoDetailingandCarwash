# Graphify money RPC payloads (client → DB)

Source: `src/lib/posSale.js`, `src/lib/payroll.js`, `src/pages/PosPage.jsx`, `docs/POS/*`, `docs/PAYROLL/*`.
Live signatures: `complete_pos_sale(payload jsonb)`, `submit_shift_close(payload jsonb)`, `run_payroll(payload jsonb)`.

## `complete_pos_sale` / `complete_pos_sale_impl`

Built by `buildPosSalePayload`:

```js
{
  branch,                    // branch slug
  customer_id,               // uuid | null
  booking_id,                // uuid | null (from handoff)
  pos_handoff_id,            // uuid | null
  payment_method,            // cash | gcash | card (server allowlist)
  payment_ref,               // required for non-cash
  discount_reason,           // string | null
  discount_minor,            // int >= 0
  status: 'paid',
  notes,                     // string | null
  lines: [{
    item_type,               // service | product only
    service_id,              // uuid | null
    product_id,              // uuid | null
    name,
    quantity,
    unit_price_minor,        // 0 for loyalty/birthday/membership awards
    is_loyalty_award,
    is_birthday_award,
    is_membership_included,
    vehicle_size,            // small|medium|large|extra_large | null
  }]
}
```

Write set: `sales`, `sale_line_items`, stock movements, loyalty, handoff→completed, booking(s)→completed, audit; optional ceramic expense drafts.

## `submit_shift_close`

From POS End of shift wizard:

```js
{
  branch,
  business_date,             // Manila local YYYY-MM-DD
  shift_ended_at,            // ISO timestamptz
  pos_baseline,              // computed paid-sales snapshot object
  submitted,                 // attested drawer fields (cash/gcash/card/expenses/CA…)
  override_reasons,          // map when typed ≠ baseline
}
```

Does **not** insert sales or run payroll. Status → `submitted` for Finance `review_shift_close`.

## `run_payroll`

Built by `buildRunPayrollPayload`:

```js
{
  branch,                    // slug | null (all/hq patterns)
  frequency,                 // daily|weekly|…
  period_start, period_end,
  wash_pool_pct,
  notes,
  run_kind: 'floor' | 'fixed',
  sales: [{ sale_id, branch, total_minor, wash_pool_minor }],
  lines: [{
    staff_id, staff_name, branch,
    kind,                    // wash_pool|ceramic_*|adjustment|package_*…
    direction,               // add|deduct
    label, source_key, source_sale_id,
    attendance_weight,
    amount_minor,            // from preview pay_minor (>0 only)
  }]
}
```

Claims sales via `payroll_run_sales` (unique per sale). Hard-blocked when `pending_floor_optional=false` and closes not accepted.

## Related RPCs

| RPC | Args |
|-----|------|
| `send_queue_ticket_to_payment` | `input_booking_id uuid` |
| `review_shift_close` | `payload jsonb` (accept/reject/lock) |
| `review_expense_report` / `submit_expense_report` | `payload jsonb` |
| `redeem_pos_loyalty_awards` | `payload jsonb` |
| `transition_expense` | `p_expense_id, p_new_status, p_notes` |
