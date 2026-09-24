# Money-path evidence index (FLOPS)

Maps each soft-launch shop-day step to a command, artifact, and SQL check. Fill paths only after a fresh exit-0 run this campaign.

| ID | Step | Command / seam | Screenshot / video | SQL / UI assert |
|----|------|----------------|--------------------|-----------------|
| C1 | Public detailing book + TL confirm | `e2e:lifecycle-flops` | `01-public-book.png`, `02-tl-bookings.png` | booking status ≠ `pending` |
| A1 | Crew present | FLOPS attendance upsert | `03-crew-attendance.png` | `staff_attendance.status` in present/late |
| W1 | Wash → Final check → POS paid | FLOPS queue + `complete_pos_sale` | `04-tl-queue.png`, `05-ba-pos.png` | `sales.status=paid`; kind sum ≥ sale |
| W2 | Cancel waiting | FLOPS | `06-cancel.png` | `bookings.status=cancelled` |
| W3 | Redo then cancel | FLOPS | `07-redo.png` | redo then cancelled |
| B1 | Detailing board advance | FLOPS | `02-tl-bookings.png` | status advanced from pending |
| E1 | End of shift (± reopen) | FLOPS + `review_shift_close` reopen | `08-eos.png` | submitted square_sales = kind sum |
| F1 | Finance accept + Paid by kind | FLOPS UI | `09-finance-today.png` | `finance_daily_line_kind` = screen |
| P1 | Floor payroll | FLOPS `run_payroll` or prove existing | `10-payroll.png` | confirmed `total_payout_minor` literal |
| R1 | RBAC denials | FLOPS puppeteer | `11-tl-pos-deny.png`, `12-investor-payroll-deny.png` | access-denied body |
| Rec | Full day recording | FLOPS CDP / MediaRecorder | `shop-day.webm` or `frames/` | present when run ok |

## Related packs

| Pack | npm | Mutating? |
|------|-----|-----------|
| FLOPS | `e2e:lifecycle-flops` | Yes (today’s branch) |
| UI P0 | `e2e:ui-p0` | No |
| Money path UI | `e2e:money-path` | No |
| Shift close sandbox | `e2e:shift-close-money` | Yes (2099-01-01 wipe) |
| Reopen probe | `node scripts/e2e-shift-close-reopen.mjs` | Yes (no new sale) |

## Latest campaign stamp

See [BRANCH-DAY-SIGN-OFF.md](./BRANCH-DAY-SIGN-OFF.md) and `e2e-evidence/lifecycle-flops/summary.json`.
