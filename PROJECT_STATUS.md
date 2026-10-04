# Project Status

**Last Updated:** 2026-10-04 (Asia/Manila) — re-verification on the Daily Sheet money path  
**Current Branch:** `main` (pushed to `origin/main`; Vercel auto-deploys)  
**Overall Status:** **READY_WITH_OPS_BLOCKERS** (soft-launch shop-day) · **NOT** 100% production-ops ready

## Executive Summary

Since 2026-10-01 the money path is **POS → Daily Sheet (Branch Admin) → Finance approve (Super Admin / ASA) → books**. End of shift, Payroll and My pay are retired. The Daily Sheet has a close-of-day slip (Print / PDF, CSV, Excel); Finance › Daily sheets has search, submitted by, net profit range, quick dates, over/short, and CSV / Excel / Print exports.

Fresh evidence (2026-10-04): unit **1448/1448**, lint **0**, build **0**, nav walk **84/84**, role matrix **52/52**, money UI **5/5**, P0 UI **9/9**, data integrity **PASS**, Daily Sheet live smoke **17/17**, money dashboards at 375 / 768 / 1440 **36/36**. Daily Sheet money path on production (sandbox day, wiped) **38/38** (2026-10-02).

Production messaging remains **open**: BrandTxt ErrorCode **11** (server IP not whitelisted); Auth SMTP unproven. **Owner daily SMS is intentionally disabled** — Daily Sheet submit / approve use web push.

Canonical audit: [`docs/SYSTEM_AUDIT.md`](docs/SYSTEM_AUDIT.md) · Daily Sheet guide: [`docs/daily-sheet/README.md`](docs/daily-sheet/README.md) · Bugs: [`docs/qa/BUGS.md`](docs/qa/BUGS.md) · Architecture: [`docs/architecture/shop-day-flops.workflow.html`](docs/architecture/shop-day-flops.workflow.html)

## SMS product policy (always)

- BusyBee / BrandTxt: **outbound only** (status + reminders). **No inbound / no reply inbox.**
- **No owner daily close SMS** — Daily Sheet submit / approve notify by **web push**.
- Optional fixed-egress path: `BUSYBEE_RELAY_URL` + `api/busybee-relay.js` (unit-proven); still needs a whitelisted host IP.

## Fresh verification (2026-10-04)

| Check | Result |
|-------|--------|
| `npm test` | **1448/1448** |
| `npx eslint .` | exit **0** |
| `npm run build` | exit **0** |
| `e2e:nav-walk` (every role × every sidebar link) | **84/84**, backend 4xx **0** |
| `e2e:role-qa` | **52/52** (Branch Admin denied Queue by design) |
| `e2e:ui-money` | **5/5** (rewritten for the Daily Sheet) |
| `e2e:ui-p0` | **9/9** |
| `e2e:integrity` | **PASS** |
| `scripts/_daily-sheet-live-smoke.mjs` (read-only, aborts writes) | **17/17** local + production |
| `scripts/_ops-pages-shots.mjs` (money dashboards, full page, 3 widths) | **36/36**, ready in ~1.5–2.5 s |
| `e2e:daily-sheet-money` (live RPCs, sandbox day wiped) | **38/38** (2026-10-02) |
| `e2e:lifecycle-flops` | **NOT RE-RUN** — it completes a real paid sale on production that would land on the live Daily Sheet |
| Real-device push audit (`push-audit-events.mjs`) | **NOT RE-RUN** since the Daily Sheet |

## Soft-launch vs production

| Gate | Status |
|------|--------|
| Soft-launch shop-day (Daily Sheet money path) | **MET** (2026-10-04) |
| Production SMS / SMTP / Static IPs | **NOT MET** |
| Archify shop-day map | **MET** (claim unchanged) |

## Known follow-ups

- Dropping the locked payroll tables needs a separate migration and the owner's OK.
- `20260929090000_visit_stamp.sql` is unapplied on production; no app code calls it.
- Production has no real Daily Sheet yet — list exports with real rows are proven by unit tests, not yet in a browser on real data.
- Xero gaps by choice: aged payables, balance sheet, bank reconciliation, VAT.

## Recommended Next Action

**Single highest value:** whitelist the BrandTxt sending IP (or enable Vercel Static IPs) and prove `npm run sms:egress` DELIVRD, so customer status SMS works. Before opening day: BossMich and approving ASAs enable push (sidebar → Account → push) so Daily Sheet submit / approve alerts land, then re-run the real-device push audit.
