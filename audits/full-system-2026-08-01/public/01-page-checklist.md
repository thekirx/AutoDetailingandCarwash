# Public — page checklist — 2026-08-01

---

## `/` landing — Partial (PUB-7)

- [ ] Loads brand + hero
- [ ] Primary CTA → book / queue
- [ ] Coating / package cards deep-link correctly where promised
- [ ] Generic `/book` cards without query — **PUB-7**
- [ ] Mobile / motion OK
- [ ] No dead primary CTAs

## `/book` — Ready

- [ ] Loads booking wizard
- [ ] PPF / location.state seed (PUB-1 Fixed)
- [ ] Garage Book seeds vehicle (PUB-3 Fixed)
- [ ] Submit via `/api/public-book` (no anon INSERT — CUST-H8 Fixed)
- [ ] Validation / branch coming_soon
- [ ] Errors surfaced
- [ ] Guest phone not auto-linked as ownership (CUST-C2 Fixed)
- [ ] Mobile

## `/queue` — Ready

- [ ] Branch picker loads
- [ ] CTA to `/queue/:branch`
- [ ] Mobile

## `/queue/:branch` — Ready

- [ ] Safe numbers/counts only in UI
- [ ] No full PII Realtime leak (CUST-C1 Fixed)
- [ ] Signed-in customer still sees public board (CUST-H3 Fixed)
- [ ] Errors / empty states
- [ ] Mobile
- [ ] getSession usage reviewed (**AUTH-P0-1** on related utilities)

## `/contact` — Partial (CUST-H9)

- [ ] Form loads / submits
- [ ] Validation (length)
- [ ] Errors / success surfaced
- [ ] Spam controls (rate limit / CAPTCHA) — **OPEN**
- [ ] `WITH CHECK (true)` accepted risk documented
- [ ] Mobile

## `/complaints` — Partial (CUST-H9)

- [ ] Form loads / submits
- [ ] Validation
- [ ] Errors surfaced
- [ ] Spam controls — **OPEN**
- [ ] Mobile

## `/events` · `/events/:slug` — Partial (CUST-H9)

- [ ] Published list / detail load
- [ ] Registration CTA
- [ ] Validation
- [ ] Spam / open insert — **OPEN**
- [ ] Mobile

## Catalog / legal — Ready enough

- [ ] `/services` `/packages` `/branches` load
- [ ] `/terms` `/privacy` load
- [ ] Mobile

## `/f/:slug` ops forms — Ready / verify

- [ ] Public form RPC loads
- [ ] Submit validation / errors
- [ ] Mobile

## Push / install — Partial polish

- [ ] Push Enable disabled when unsupported (PUB-4 Fixed)
- [ ] Install Got it → native when available (PUB-6 Fixed)
- [ ] Multiple Book/Push entry density — PUB-8/9 deferred
