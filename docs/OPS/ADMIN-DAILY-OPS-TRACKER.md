# Admin daily-ops tracker (no redesign)

**Decision:** Soft-launch admin daily ops do **not** need a POS / Payroll / Finance redesign.  
**Money path:** BA POS → End of shift → SA Finance accept → SA Floor payroll.

## Checklist

| # | Item | Repo artifact | Status 2026-09-24 |
|---|------|---------------|-------------------|
| 1 | BrandTxt Dexter follow-up | [`brandtxt-dexter-followup.txt`](./brandtxt-dexter-followup.txt) + [`BUSYBEE-BRANDTXT-REQUEST.md`](./BUSYBEE-BRANDTXT-REQUEST.md) | **READY TO SEND** — Malcolm: paste into the existing Gmail thread to Dexter and Send |
| 1b | Prove `sms:egress` after whitelist | `npm run sms:egress` / `SEND_TEST_SMS=1 …` | **BLOCKED** — ErrorCode 11 on `180.191.244.237` until Dexter whitelists |
| 2 | Vercel Static IPs | [`VERCEL-STATIC-IPS.md`](./VERCEL-STATIC-IPS.md) | **BLOCKED** — Hakum project not on this CLI Vercel account; no `.vercel/` link |
| 3 | Auth SMTP proof | [`AUTH-SMTP-PROOF.md`](./AUTH-SMTP-PROOF.md) | **OPEN** — project `lybxhpzzqqyqswvuwpxv`; Hakum not on linked Supabase MCP org |
| 4 | BA/SA friction log | [`../qa/ADMIN-FRICTION-LOG.md`](../qa/ADMIN-FRICTION-LOG.md) | **OPEN for entries** — seeded with FLOPS notes; no redesign until repeated High/Blocker |

## Human send steps (BrandTxt)

1. Open Gmail thread with Dexter (Aug 28 / Aug 31).
2. Paste body from `docs/OPS/brandtxt-dexter-followup.txt`.
3. Send from `jcuady@gmail.com`.
4. When Dexter confirms, run:

```bash
node scripts/check-busybee-egress.mjs
SEND_TEST_SMS=1 TEST_SMS_PHONE=09625294043 node scripts/check-busybee-egress.mjs
```

5. Expect `ok: true` + handset DELIVRD. Update row 1b above to **CLOSED** with the MessageId.

## Verify package integrity

```bash
npm run ops:daily-ops
node --test tests/adminDailyOpsPlan.test.js
```

## Fresh egress probe (this session)

Recorded by `scripts/ops-admin-daily-ops.mjs` when run — expect `unauthorized_ip` until BrandTxt acts.

**Last run:** see [`admin-daily-ops-last-run.json`](./admin-daily-ops-last-run.json) — `egressIp` `180.191.244.237`, ErrorCode **11**, `followupReady: true`, `redesignRequired: false`.
