# Hakum — Remaining gaps to “complete” (post-session)

Session management is **done** in code (PKCE, auto-refresh, single-flight token refresh, visibility resume, local sign-out, no custom storageKey wipe). This file lists what is still outside that work for a principal full-stack bar.

## Done this pass

| Area | Status |
|------|--------|
| Supabase SPA session (persist + autoRefresh + PKCE) | Done |
| Single-flight `ensureFreshAccessToken` | Done |
| Skip profile reload on `TOKEN_REFRESHED` | Done |
| Tab visibility → `getSession` | Done |
| `signOut({ scope: 'local' })` | Done |
| TDD `tests/session.test.js` + `check-session.mjs` | Done |
| E2E session token assert in `e2e-readiness.mjs` | Done |
| GraphQL layer | **N/A** — PostgREST + `/api/*` only; do not add GraphQL |

## Shipped — newrequest Parts 1–9 (2026-07-26)

| Area | Status |
|------|--------|
| RBAC Assistant Super Admin + grants; no sales/cashier | Done |
| POS / Finance / Queue / Crew / Planning / CRM / Bookings / KPI / Reports / Cars catalog | Done |
| `e2e-rbac-matrix.mjs` + Part table RLS smoke | Done |
| Seed demos: sales/cashier removed | Done |
| Advisors: revoked anon `create_branch` / `update_branch` EXECUTE | Done |

## Gaps that block “100% production ops” (not code checklist)

| # | Gap | Why it matters | Effort |
|---|-----|----------------|--------|
| 1 | **Supabase Auth SMTP** configured in dashboard (custom domain, templates) | Reset/setup emails fail or land in spam without it | Ops (dashboard) |
| 2 | **Deploy secret parity** (Vercel = local `.env` names) | Live auth/SMS/push break if names drift | Ops |
| 3 | **Browser Playwright E2E** (click login → portal → book → POS) | `e2e-newrequest` is API/auth/schema smoke, not UI | Medium |
| 4 | **Distributed rate limit** (Redis/Upstash) for `/api/customer-auth-lookup` | In-memory limit resets per serverless instance | Medium |
| 5 | **Observability** (Sentry or equivalent + Supabase advisors on schedule) | Blind to production exceptions/RLS regressions | Medium |
| 6 | **CONTEXT.md + ADRs** | Architecture reviews re-suggest rejected work; AI navigability | Small |
| 7 | **Idle timeout / “sign out other devices”** | Not standard for this product; add only if BossMich asks | Skip (YAGNI) |
| 8 | **Auth leaked-password protection** (HaveIBeenPwned) | Advisor WARN — enable in Auth settings | Ops (dashboard) |
| 9 | **Public INSERT WITH CHECK (true)** on complaints / contact / event_registrations | Intentional public forms; tighten with captcha/rate limits if abused | Later |
| 10 | **Legacy enum labels `sales`/`cashier` on `profile_role`** | Zero rows use them; Postgres enum drop is painful — leave labels, app rejects | Skip |

## Full E2E evidence

Re-run: `npm run e2e:newrequest` → see [`E2E_CHECKLIST.md`](./E2E_CHECKLIST.md).

## Architecture deepening (see HTML report)

Top candidates: deepen **Customer Auth** module (lookup + portal + reset), deepen **Notify** (BusyBee + push), introduce **CONTEXT.md** seam vocabulary.

## Completeness score (honest)

| Layer | Score |
|-------|-------|
| App security + portals (AUDIT P0–P4) | ~100% code |
| Session management | ~100% SPA-standard |
| Domain feature matrix (newrequest Parts 1–9) | ~100% code + e2e smoke |
| Production ops (SMTP, secrets, monitoring, browser E2E) | ~60–70% |
| Domain docs / ADRs | ~0% |

**Overall product readiness for soft launch:** high if SMTP + Vercel secrets are confirmed.  
**Overall “principal platform complete”:** blocked on gaps 1–5 above (ops), not on app RBAC/feature code.
