# Branch day sign-off

One page for Super Admin / Branch Admin after a shop day. Check a box only with a path to fresh evidence from **this** campaign.

**Branch:** bacoor **Manila date:** 2026-09-24 **Runner:** FLOPS campaign

| # | Check | Evidence path | OK |
|---|--------|---------------|----|
| 1 | Unit money/queue suites exit 0 | `tmp-flops-unit.txt` (100/100) | [x] |
| 2 | `npm run build` exit 0 | `tmp-flops-build.txt` | [x] |
| 3 | FLOPS lifecycle exit 0 | `e2e-evidence/lifecycle-flops/summary.json` (23/23) | [x] |
| 4 | PNG storyboard complete | `e2e-evidence/lifecycle-flops/01-*.png` … `12-*.png` | [x] |
| 5 | Recording artifact present | `e2e-evidence/lifecycle-flops/frames/` (+ README; ffmpeg absent → no webm) | [x] |
| 6 | Paid POS kind sum = Finance UI | SQL kind **900000** = drawer; `09-finance-today.png` | [x] |
| 7 | Accepted close square_sales = kind sum | close `193d3ea6-…` drawer **900000** | [x] |
| 8 | Floor payroll confirmed for window | run `275826f1-…` confirmed **157500** (35% of first ₱4,500 sale) | [x] |
| 9 | Production SMS/SMTP still documented if open | [ULTIMATE-READINESS.md](./ULTIMATE-READINESS.md) ops gate | [x] |

## Money honesty (2026-09-24 Bacoor)

| Fact | Value |
|------|------:|
| FLOPS paid sales (notes `QA FLOPS`) | 2 × 450000 = **900000** minor |
| `finance_daily_line_kind` sum | **900000** |
| Accepted close submitted square_sales | **900000** |
| Confirmed floor payroll | **157500** (first sale only) |

A second overlapping floor run for the same branch-day is refused by `run_payroll` (“Overlapping floor payroll run already exists”). Soft-launch path proved; catching up pay for the accidental second QA sale needs an owner decision (new period / void policy) — not auto-voided.

## Production ops (do not fake-close)

| Item | Status |
|------|--------|
| BrandTxt / BusyBee Vercel + office IP allowlist | **OPEN** — ErrorCode 11; whitelist **`180.191.244.237`** (+ Vercel Static IPs) |
| Owner daily SMS / `OWNER_SMS_PHONE` | **N/A** — product disabled; SA/ASA get web push on accept |
| Auth SMTP | OPEN until dashboard proof |

**Soft-launch shop-day ready:** boxes 1–8 checked (with payroll overlap note above).  
**Production messaging ready:** also the three ops rows closed with evidence.
