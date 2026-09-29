# Principal progress — 2026-09-26

Strict handoff after daily-ops verification campaign. **Do not treat as 100% production-ready.**

## Overall verdict

| Label | Result |
|-------|--------|
| Soft-launch shop-day | **MET** — FLOPS **25/25** (Manila 2026-09-26), unit **1284/1284**, build/lint/integrity green |
| Production ops | **NOT MET** — BrandTxt IP, Auth SMTP, Vercel Static IPs still open |
| Combined | **READY_WITH_OPS_BLOCKERS** |

HEAD: `59c27e0` on `main` (pulled from origin).

## What works (proven this session)

```text
Crew attendance → TL queue → BA POS pay → End of shift
  → SA Finance accept → SA Floor payroll → Paid-by-kind books
```

| Proof | Exit / score |
|-------|----------------|
| `npm test` | 1284/1284 |
| `npx eslint .` | 0 |
| `npm run build` | 0 |
| `e2e:integrity` | PASS |
| `smoke-pos-handoff.mjs` | 0 |
| `e2e:lifecycle-flops` | **25/25** |
| Money | kind = drawer = **450000**; payroll **157500** |
| Story seams | userStoriesCoverage + dailyOps + adminDailyOps **18/18** |
| BusyBee relay code path | unit green (`resolveBusybeeSendMode`, `api/busybee-relay.js`) |

Docs aligned: runbook, money contract, shop-day-flow, POS/Payroll flowcharts, Archify shop-day workflow (claim unchanged — no re-deliver).

## 2026-09-27 — untested pages, push, backend

| Proof | Result |
|-------|--------|
| `e2e:nav-walk` — every ops persona × every sidebar link | **92/92**, backend 4xx **0** (`e2e-evidence/nav-walk/summary.json`) |
| `e2e:role-qa` | **54/54** |
| Push e2e incl. Finance accept → SA/ASA | **PASS** (fan-out = BossMich; demo ASA has no `finance_write`, correct) |
| Advisor hardening migration | Applied; FLOPS **25/25** re-run after |

Bug found and fixed: CRM → Expense categories selected/inserted `is_active` (column never existed) → SA/ASA saw an empty list and could not add. Now lists 6, add works (browser-verified).

Honest gap: push code works, but **no SA/ASA/staff device is subscribed** in production data (3 subs, all demo customer). "Bypass" was interpreted as test coverage — auth/RLS were never disabled.

## What does **not** work / is blocked

| Blocker | Evidence | Owner action |
|---------|----------|--------------|
| Customer SMS live | `sms:egress` ErrorCode **11**, IP `180.191.244.237` | Send Dexter follow-up; whitelist IP |
| Vercel prod SMS | No Hakum project on this CLI; no Static IPs | Enable Static IPs (or relay host) + whitelist |
| Auth SMTP | No inbox proof | Configure + recover-password test on `lybxhpzzqqyqswvuwpxv` |
| Owner daily SMS | N/A — intentionally off | Do not treat as gate |
| Ops push devices | 0 SA/ASA/staff subscriptions | BossMich enables notifications on phone |
| Auth leaked-password protection | Disabled (advisor WARN) | Supabase dashboard toggle (P2) |

## Product / PM status

- Daily ops user stories: present and acceptance-checked (`epic-daily-operations`, `shop-day-flow`).
- Flowcharts: POS `09`, Payroll `10`, Archify `shop-day-flops.workflow.html`.
- **No redesign** of POS/Payroll/Finance for soft-launch (tracker + friction log).

## Next actions (priority)

1. Paste [`docs/OPS/brandtxt-dexter-followup.txt`](../OPS/brandtxt-dexter-followup.txt) → Dexter → prove DELIVRD.
2. Hakum Vercel Static IPs (or relay) → whitelist → domain SMS.
3. Auth SMTP Gate 10.1 with real inbox screenshot.

## Honesty note

Prior Sep-24 FLOPS (900000 / overlap caveat) remains historical. Today’s stamp is a clean single-sale day (450000 / 157500). Full `npm run test:readiness` orchestrator was **not** re-run this campaign.
