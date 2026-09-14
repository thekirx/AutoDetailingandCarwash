# Workflows — money path

```text
Queue for_payment → pos_handoffs (pending)
  → POS Pay queue → complete_pos_sale
  → optional detailing compensation expense drafts
  → POS expenses (draft) + Today dashboard
  → End of shift submit_shift_close (attestation)
  → Finance Shift reviews → review_shift_close(accept)
  → Payroll pending floor (hard gate when pending_floor_optional=false)
  → run_payroll from POS proof + attendance + ceramic keys
  → My Pay confirmed lines | Finance P&L / Reports
```

| ID | Flow | Happy | Failure |
|----|------|-------|---------|
| WF-POS-01 | Pay queue settle | Sale paid, handoff cleared | Missing service_id blocks checkout |
| WF-POS-02 | Walk-in / merch | Sale paid | BA cannot sell bay catalog |
| WF-POS-03 | Expense draft | Counts in EoS cash-left | Not in P&L until posted |
| WF-EOS-01 | Submit close | Finance sees submitted | Duplicate day close blocked |
| WF-FIN-01 | Accept close | Pending floor unlocks | Accept ≠ pay |
| WF-PAY-01 | Confirm floor | Lines posted | Hard-blocked if closes pending |
| WF-PL-01 | P&L / Reports | Matches paid POS | Drafts / overrides excluded |

Evidence: `npm run e2e:money-path`, `e2e:ui-money`, `e2e-shift-close-money`.
