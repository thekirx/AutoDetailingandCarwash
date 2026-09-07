# Hakum QA — Living Results Log

**Rule:** Every campaign slice must leave command + exit code here (or via orchestrator stamp).  
**Machine stamp:** [`last-run.json`](./last-run.json) · [`readiness-dashboard.html`](./readiness-dashboard.html)  
Orchestrator (`npm run test:readiness`) overwrites **Latest orchestrator** and prepends a campaign-log row.

---

## Latest orchestrator

| Field | Value |
|-------|-------|
| Finished | 2026-09-03T13:52:11.567Z |
| Overall | **PASS** |
| Passed / failed / skipped | 14 / 0 / 1 |
| SEND_LIVE_SMS | 0 |

| ID | Step | Result |
|----|------|--------|
| U | npm test (unit) | PASS |
| L1 | e2e-attendance | PASS |
| L2 | e2e-payroll | PASS |
| L3 | e2e-readiness | PASS |
| L4 | e2e-queue-part3 | PASS |
| L5 | e2e-pos-part2 | PASS |
| L6 | smoke-busybee (balance only) | PASS |
| L7 | e2e-real-customer-status-sms | SKIP |
| L8 | e2e-ops-cutover | PASS |
| L9 | e2e-shift-close-money (BUG-007 RPC) | PASS |
| B | npm run build | PASS |
| UI | e2e-ui-p0 | PASS |
| UI2 | e2e-ui-money (BUG-007) | PASS |
| R | responsive-validation | PASS |

See also [`last-run.json`](./last-run.json) · [`readiness-dashboard.html`](./readiness-dashboard.html).


---

## Campaign log

| When (UTC) | Command | Exit | Notes |
|------------|---------|------|-------|
| 2026-09-07T07:25Z | completion QA suite (att/payroll/pos/queue/money/cutover/sales-bookings/TL units) | 0 | All PASS; sales e2e asserts updated (check-in + waiting allowed; for_payment denied) |
| 2026-09-07T06:55Z | `npm test` | 0 | **1195/1195** pre-push |
| 2026-09-07T06:55Z | `npm run build` | 0 | vite + PWA exit 0 |
| 2026-09-07T06:55Z | `npm run e2e:shift-close-money` | 0 | **13/13** dry pre-push |
| 2026-09-07T06:50Z | `node --test` planner + qaNewRevisions + notify + money contract | 0 | 17/17; Experience toast + Planner default |
| 2026-09-07T06:50Z | `npm run e2e:shift-close-money` | 0 | **13/13** dry |
| 2026-09-07T06:50Z | SQL | — | Experience cards=1; `post_service_completed` pending=0 (BUG-005 closed) |
| 2026-09-07T06:42Z | `npm run e2e:shift-close-money` | 0 | **13/13** dry; Finance toast severity polish (warning/success) |
| 2026-09-07T06:42Z | `node --test` notify + money contract | 0 | 2/2 |
| 2026-09-07T06:40Z | `npx vercel project ls` / inspect | — | Hakum `auto-detailingand-carwash` **not** under `jcuadys-projects` — cannot set prod env from this CLI |
| 2026-09-07T06:35Z | `SEND_LIVE_OWNER_SMS=1 npm run e2e:shift-close-money` | 0 | **13/13** `notify_sent sent=1` to QA handset 09625294043 (BossMich.phone + local OWNER_SMS_PHONE) |
| 2026-09-07T06:35Z | `npm run e2e:shift-close-money` | 0 | **13/13** dry: `phone_sources` + `notify_dry` (no SMS burn) |
| 2026-09-07T06:35Z | `node --test tests/e2eShiftCloseMoneyContract.test.js tests/notifyShiftCloseOwnerSms.test.js` | 0 | 2/2 |
| 2026-09-07T06:25Z | `npm run e2e:shift-close-money` | 0 | **13/13**: + `notifyShiftCloseAccepted` → `ownerSms.skipped=no_owner_phone`; sale claim; chem |
| 2026-09-07T06:25Z | `node --test tests/e2eShiftCloseMoneyContract.test.js tests/notifyShiftCloseOwnerSms.test.js` | 0 | 2/2; Finance toast surfaces `no_owner_phone` |
| 2026-09-07T06:15Z | `npm run e2e:shift-close-money` | 0 | BUG-007 **12/12**: + sandbox sale seed, `payroll_run_sales` claim, `pos_sales_minor`, owner SMS phone_gap (env+BossMich null), chem lines |
| 2026-09-07T06:15Z | `node --test tests/e2eShiftCloseMoneyContract.test.js` | 0 | 1/1 (sale claim + owner SMS seams) |
| 2026-09-07T06:15Z | `node scripts/smoke-busybee.mjs` | 0* | balance ErrorCode 0, credits 4178 (*node win UV assert after success) |
| 2026-09-07T06:10Z | `npm run e2e:shift-close-money` | 0 | BUG-007 **9/9**: submit→accept→pending floor→hard gate→`run_payroll` confirm→cleanup→chem recon line seed. Schema fixes: `expense_categories.sort_order`, `payroll_runs.confirmed_by` |
| 2026-09-07T06:10Z | `node --test tests/e2eShiftCloseMoneyContract.test.js` | 0 | 1/1 source-scan contract |
| 2026-09-07T05:50Z | `npm run e2e:shift-close-money` | 0 | BUG-007: submit→accept→pending floor→hard_gate_unlocked (6 checks; no run_payroll post) |
| 2026-09-07T05:48Z | `npm run e2e:payroll` | 0 | static + RLS; run_payroll reachable |
| 2026-09-07 (session) | `npm test` | 0 | 1194/1194 |
| 2026-09-03T13:52:11.567Z | `npm run test:readiness` | 0 | passed=14 failed=0 skipped=1 |
| 2026-09-03T12:05:46.361Z | `npm run test:readiness` | 0 | passed=13 failed=0 skipped=1; UI2 money + L8 cutover green |
| 2026-09-03T12:00Z | `npm run e2e:ui-money` | 0 | 5/5 TL denied · admin queue/POS/EoS · boss finance |
| 2026-09-03T12:00Z | `npm run e2e:cutover` | 0 | PASS (WARN: OWNER_SMS env, CHEM-RECON=0) |
| 2026-09-03T11:20:34Z | `npm run test:readiness` | 0 | Soft-launch code gate; responsive CONDITIONAL |
| 2026-09-03 (earlier) | `e2e-real-customer-status-sms` | 0 | 21/21 · DELIVRD on 09625294043 |

---

## Gate status (honest)

| Gate | Status |
|------|--------|
| Soft-launch code (unit + orch live + UI P0 + money UI + responsive) | **MET** (2026-09-03T13:52:11Z) |
| BUG-007 browser surfaces (TL deny / admin EoS wizard / boss finance tab) | **MET** (non-destructive) |
| BUG-007 RPC submit → Finance accept → pending floor + hard-gate unlock | **MET** (2026-09-07) |
| BUG-007 full `run_payroll` confirm + sale claim + sandbox cleanup | **MET** (2026-09-07 `e2e:shift-close-money` 13/13) |
| Chem recon line presence (QA seed if empty) | **MET** (1+ line on approved recon) |
| Owner SMS phone sources (env or BossMich.phone) | **MET** (QA `09625294043` on env + BossMich) |
| Owner SMS notify after accept (local/office egress) | **MET** (`SEND_LIVE_OWNER_SMS=1` → `sent=1`) |
| BrandTxt local balance | **MET** (2026-09-07 ErrorCode 0 / 4178 credits) |
| Production ops (Vercel BrandTxt IP + Vercel `OWNER_SMS_PHONE`) | **NOT MET** |

**Not 100%.** **CONTINUE** — set `OWNER_SMS_PHONE` on the **Hakum** Vercel team/project (not `jcuadys-projects`) + whitelist Vercel static egress; confirm handset for today’s QA send.
