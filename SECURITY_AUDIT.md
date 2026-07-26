# Hakum — Security audit (adversarial)

**Against:** [Security (2).md](./Security%20(2).md)  
**Also:** Injection, authz bypass, secrets, validation, insecure defaults, hallucinated deps  
**Date:** 2026-07-24  
**Reviewer mode:** Senior Security Engineer — no reassurance  

---

## Security (2).md — bare minimum scorecard

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | Auth on every protected endpoint | **Pass** (portal) / **Partial** (public APIs) | Portal/JWT routes reject missing token. Public book/lookup/auth-lookup intentionally open but rate-limited where abuse-prone. |
| 2 | Authorization / ownership | **Pass** after patch | Portal mutations require live customer row; plate claim is ownership-safe. |
| 3 | Input validation / allowlists | **Partial** | Plate normalize, phone length, action allowlist. Email checks `@` only — tighten if needed. |
| 4 | No secrets in frontend / git | **Pass** with caveat | Service role server-only. Demo passwords in `demoAccounts.js` ship to client — **fail until gated**. |
| 5 | Rate limiting auth / expensive | **Pass** after patch | In-memory limit on auth-lookup send_*; serverless cold starts reset buckets — prefer Redis/Upstash for multi-instance. |
| 6 | Security headers | **Pass** after patch | CSP / XFO / nosniff / referrer / permissions in `vercel.json`. |
| 7 | Dependency CVEs | **Check each release** | Run `npm audit --omit=dev` before ship. |

---

## Findings (file · severity · fix)

### Fixed this pass

| File | Severity | Finding | Fix |
|------|----------|---------|-----|
| `server/customerPortal.mjs` | HIGH | `add-vehicle` upsert could reassign plates | Insert-or-update-own only; conflict → 409 |
| `server/customerPortal.mjs` | MEDIUM | `requireCustomer` trusted metadata / synthetic email | Require live `customers` row |
| `server/customerAuthLookup.mjs` | MEDIUM | `login_email` on send_reset/setup | Omit from response |
| `server/customerAuthLookup.mjs` | MEDIUM | Unauthenticated reset spam | Rate limit per IP + identifier |
| `vercel.json` | MEDIUM | No security headers | Added CSP-friendly baseline headers |
| `src/App.jsx` + Admin | LOW | Stub queue module | Redirect to `/operations/queue` |
| `src/auth/ProtectedRoute.jsx` | LOW | Customer wrong-role → ops deny | `unauthorizedTo` support |

### Open / accepted risk

| File | Severity | Finding | Fix |
|------|----------|---------|-----|
| `src/lib/demoAccounts.js` | LOW | Demo passwords still in source | Chips gated to DEV; strip module from prod bundle later |
| `server/httpUtil.mjs` `setCors` | LOW | `Access-Control-Allow-Origin: *` | Restrict to app origin(s) when cookies unused; Bearer still required |
| Auth lookup `lookup` action | LOW | Account enumeration via status codes | Uniform responses + tighter rate limit |
| Multi-instance rate limit | LOW | Map resets per serverless instance | Upstash Redis rate limit |
| Client `getSession()` on some APIs | MEDIUM | Stale JWT → intermittent 401 | Mig to `getAccessTokenFresh()` |

### Injection / XSS / command

| Area | Result |
|------|--------|
| SQL | Supabase client parameterized — no string-built SQL in reviewed paths |
| XSS | No new `dangerouslySetInnerHTML` in settings/auth diff |
| Command | No shell exec on request paths |
| Prompt injection | N/A (no LLM endpoint) |

### Hallucinated dependencies

| Import | Verified |
|--------|----------|
| `next-themes` | In `package.json` |
| `@supabase/supabase-js` | In `package.json` |
| No new packages added for rate limit (stdlib Map) | — |

---

## Caveman review (security + auth diff)

`server/customerPortal.mjs`: 🔴 was: plate upsert race. Fixed: update-own then insert; `23505` → 409.  
`server/customerPortal.mjs`: 🔴 was: metadata role gate. Fixed: live `customers` row only.  
`server/customerAuthLookup.mjs`: 🟡 was: `login_email` leak on send_*. Fixed: omit.  
`server/customerAuthLookup.mjs`: 🟡 was: no rate limit. Fixed: IP+id bucket.  
`src/lib/demoAccounts.js`: 🟡 risk: demo passwords in prod bundle. Gate with `import.meta.env.DEV`.  
`server/httpUtil.mjs`: 🔵 nit: CORS `*` — lock to site origin when feasible.

---

## RLS note (frontend)

Service-role portal bypasses RLS **by design** — authorization must live in `requireCustomer` + `.eq('customer_id'|'id', userId)`. Do not “fix” empty arrays from RLS-denied client queries without toasting `error`.
