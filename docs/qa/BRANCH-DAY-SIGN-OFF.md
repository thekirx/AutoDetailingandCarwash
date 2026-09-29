# Branch day sign-off

One page for Super Admin / Branch Admin after a shop day. Check a box only with a path to fresh evidence from **this** campaign.

**Branch:** bacoor **Manila date:** 2026-09-26 **Runner:** principal daily-ops verify · HEAD `59c27e0`

| # | Check | Evidence path | OK |
|---|--------|---------------|----|
| 1 | Unit suite exit 0 | `tmp-principal-unit.txt` (**1284/1284**) | [x] |
| 2 | `npm run build` exit 0 | `tmp-principal-build.txt` | [x] |
| 3 | FLOPS lifecycle exit 0 | `e2e-evidence/lifecycle-flops/summary.json` (**25/25**) | [x] |
| 4 | PNG storyboard complete | `e2e-evidence/lifecycle-flops/01-*.png` … `12-*.png` | [x] |
| 5 | Recording artifact present | `e2e-evidence/lifecycle-flops/frames/` (+ README; ffmpeg may be absent → few jpgs) | [x] |
| 6 | Paid POS kind sum = Finance UI | SQL kind **450000**; `09-finance-today.png` | [x] |
| 7 | Accepted close square_sales = kind sum | close `ffb07982-…` drawer **450000** | [x] |
| 8 | Floor payroll confirmed for window | run `79f0a932-…` confirmed **157500** (35% of ₱4,500) | [x] |
| 9 | Production SMS/SMTP still documented if open | [ULTIMATE-READINESS.md](./ULTIMATE-READINESS.md) · [ADMIN-DAILY-OPS-TRACKER.md](../OPS/ADMIN-DAILY-OPS-TRACKER.md) | [x] |

## Money honesty (2026-09-26 Bacoor)

| Fact | Value |
|------|------:|
| FLOPS paid sales (notes `QA FLOPS`) | 1 × 450000 = **450000** minor |
| `finance_daily_line_kind` sum | **450000** |
| Accepted close submitted square_sales | **450000** |
| Confirmed floor payroll | **157500** |

Day was clean before run (no prior floor payroll / close for 2026-09-26). Prior campaign 2026-09-24 still has confirmed run `275826f1-…` (overlap caveat for that day only).

## Production ops (do not fake-close)

| Item | Status |
|------|--------|
| BrandTxt / BusyBee office + Vercel Static IPs | **OPEN** — ErrorCode **11** on **`180.191.244.237`** (fresh `npm run sms:egress`) |
| Owner daily SMS / `OWNER_SMS_PHONE` | **N/A** — product disabled; SA/ASA get web push on accept |
| Auth SMTP | **OPEN** — [`AUTH-SMTP-PROOF.md`](../OPS/AUTH-SMTP-PROOF.md) |

**Soft-launch shop-day ready:** boxes 1–8 checked this campaign.  
**Production messaging ready:** **NOT MET** until BrandTxt whitelist + Auth SMTP inbox proof (+ Vercel Static IPs for custom domain).
