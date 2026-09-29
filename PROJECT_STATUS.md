# Project Status

**Last Updated:** 2026-09-27 (Asia/Manila) — untested pages, push, backend pass  
**Current Branch:** `main` @ `59c27e0` (synced with `origin/main`)  
**Overall Status:** **READY_WITH_OPS_BLOCKERS** (soft-launch shop-day) · **NOT** 100% production-ops ready

## Executive Summary

Hakum soft-launch shop-day path is **code-and-evidence ready** on a **fresh** stamp: FLOPS **25/25** (2026-09-26), unit **1284/1284**, lint **0**, build **0**, integrity **PASS**, POS handoff **PASS**. Money honesty today: kind = drawer = **450000**; floor payroll **157500**.

Production messaging remains **open**: BrandTxt ErrorCode **11** on **`180.191.244.237`**; Auth SMTP unproven; Vercel Static IPs not enabled on Hakum team. **Owner daily SMS is intentionally disabled** (Finance accept → web push).

Canonical audit: [`docs/SYSTEM_AUDIT.md`](docs/SYSTEM_AUDIT.md) · Sign-off: [`docs/qa/BRANCH-DAY-SIGN-OFF.md`](docs/qa/BRANCH-DAY-SIGN-OFF.md) · Architecture: [`docs/architecture/shop-day-flops.workflow.html`](docs/architecture/shop-day-flops.workflow.html) · Progress: [`docs/qa/PRINCIPAL-PROGRESS.md`](docs/qa/PRINCIPAL-PROGRESS.md)

## SMS product policy (always)

- BusyBee / BrandTxt: **outbound only** (status + reminders). **No inbound / no reply inbox.**
- **No owner daily close SMS** — Finance accept notifies SA/ASA via **web push**.
- Optional fixed-egress path: `BUSYBEE_RELAY_URL` + `api/busybee-relay.js` (unit-proven); still needs a whitelisted host IP.

## Fresh verification (2026-09-26 principal pass)

| Check | Result |
|-------|--------|
| `git pull --ff-only` | **59c27e0** (homepage polish) |
| `npm test` | **1284/1284** |
| `npx eslint .` | exit **0** |
| `npm run build` | exit **0** |
| `npm run ops:daily-ops` | exit **0** · egress ErrorCode 11 |
| `e2e:integrity` | **PASS** |
| `smoke-pos-handoff.mjs` | exit **0** |
| `e2e:lifecycle-flops` | **25/25** |
| Story / dailyOps seams | **18/18** |
| `test:readiness` full orch | **NOT RE-RUN** (FLOPS + unit + integrity used) |

## Untested pages, push, backend (2026-09-27)

| Check | Result |
|-------|--------|
| `e2e:nav-walk` (11 ops personas × every sidebar link; wall / crash / blank / pageerror / 5xx) | **92/92**, backend 4xx **0** |
| `e2e:role-qa` | **54/54** |
| Push e2e (+ Finance accept → SA/ASA, owner SMS off) | **PASS** |
| Bug fixed | CRM expense categories used non-existent `is_active` column → list empty, add failed. Fixed + browser-verified |
| Supabase advisors | search_path pin, trigger-fn revoke, write-policy split applied; FLOPS **25/25** after |
| Push reality | **0** SA/ASA/staff devices subscribed (only 3 demo-customer subs) — owners must enable notifications |
| Unit / lint / build | **1284/1284** · 0 · 0 |

## Soft-launch vs production

| Gate | Status |
|------|--------|
| Soft-launch shop-day (FLOPS) | **MET** (2026-09-26) |
| Production SMS / SMTP / Static IPs | **NOT MET** |
| Admin POS/Payroll/Finance redesign | **Not required** |
| Archify lifecycle map | **MET** (claim unchanged) |

## Admin daily ops UX

**No redesign** of POS / Payroll / Finance. Tracker: [`docs/OPS/ADMIN-DAILY-OPS-TRACKER.md`](docs/OPS/ADMIN-DAILY-OPS-TRACKER.md) · Friction: [`docs/qa/ADMIN-FRICTION-LOG.md`](docs/qa/ADMIN-FRICTION-LOG.md).

## Recommended Next Action

**Single highest value:** Paste [`docs/OPS/brandtxt-dexter-followup.txt`](docs/OPS/brandtxt-dexter-followup.txt) into the Dexter Gmail thread and Send, then `SEND_TEST_SMS=1 TEST_SMS_PHONE=09625294043 npm run sms:egress` until DELIVRD. Parallel: Vercel Static IPs + Auth SMTP proof. Before opening day: BossMich enables push on her phone (sidebar → Account → push toggle) so Finance-accept alerts actually land.
