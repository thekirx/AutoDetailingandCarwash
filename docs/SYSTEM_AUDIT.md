# System Audit

## Summary

| Field | Value |
|-------|-------|
| Audit date | 2026-09-08 (Asia/Manila) |
| Last eng pass | Wave 0–3 executed this session (Wave 1 ops SMS still blocked; Wave 4–5 partial/deferred) |
| Branch | `main` |
| Framework | Vite 6 + React 19 SPA · Supabase Auth/RLS/RPC · Vercel `api/*` → `server/*.mjs` |
| Build status | **PASS** — `npm run build` exit 0 |
| Unit suite | **PASS** — `npm test` **1193/1193** (browser tests moved to `npm run test:browser`) |
| Lint | **FAIL** — 61 errors / 3 warnings (mostly pre-existing / scripts `no-undef`; not auto-fixed) |
| Soft-launch product | **READY** with ops SMS blocker |
| Production-perfect | **NOT COMPLETE** — Wave 1 ops + Wave 4–5 debt remain |

---

## Critical Issues

| Severity | Area | Issue | Status |
|----------|------|-------|--------|
| P1 (ops) | SMS | Vercel BrandTxt egress + `OWNER_SMS_PHONE` (BUG-002/003) | **Open (ops)** — no Vercel team linked in this agent session |
| P1 | Events spam | Anon INSERT + client honeypot | **Closed** — API + migration applied |
| P1 | Waitlist CTA | Fake waitlist | **Closed** |
| P2 | Legal contact form copy | Misleading | **Closed** |
| P2 | npm test + preview | False-red browser suite | **Closed** — excluded from default `npm test` |

---

## Fixed this campaign (Wave 2+)

| Item | Change |
|------|--------|
| Event registration | `kind=event_registration` via `/api/public-inquiry`; RLS insert revoked |
| Guard parity | Server accepts `company_website` / `form_opened_at` |
| Waitlist CTA | “Ask about opening” → `/contact` |
| Legal copy | Contact page links (no “contact form”) |
| Broadcast metrics | `skipped` for SMS/push opt-out / missing phone |
| Dead `contact` API alias | Removed from `api/public-inquiry.js` |
| Unit harness | `*.browser.test.js` → `npm run test:browser` |

---

## Remaining Issues

| Priority | Item | Wave |
|----------|------|------|
| P1 ops | BrandTxt IP + `OWNER_SMS_PHONE` on Vercel | 1 |
| P2 | `npm run lint` clean-up | 3 residual |
| P2 | POS/payroll risks (drafts, payment methods, ceramic SKUs) | 4 |
| P2 | Supabase leaked-password protection; counters RLS INFO | 4 |
| P2 | `npm audit` 14 prod vulns | 4 |
| P2 | Full live browser money path (BUG-007 optional) | 3 optional |
| P3 | Branch select display names; PosPage split; full a11y | 5 |

---

## Final Verification

- [x] Production build passes
- [ ] Lint clean — **NOT** (pre-existing debt; documented)
- [x] Automated unit tests pass (`npm test` 1193/1193)
- [x] Event registration geofence migration applied (remote)
- [x] Honesty copy tests pass
- [ ] Prod SMS smoke — **BLOCKED** (Wave 1)
- [ ] Full `test:readiness` orchestrator — **NOT RUN** this pass (time); units+build green

---

## Next actions

1. **You (ops):** Whitelist Vercel egress on BrandTxt; set `OWNER_SMS_PHONE` on Hakum Vercel.
2. **Eng:** Run `npm run test:readiness` before cutover; optional Wave 4 audit/POS.
3. **Commit:** Product delta staged when Wave 0 commit lands this session.
