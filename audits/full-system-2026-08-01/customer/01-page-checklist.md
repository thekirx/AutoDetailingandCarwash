# Customer — page checklist — 2026-08-01

---

## `/signin` — Partial (CUST-H2)

- [ ] Page loads
- [ ] Primary CTA: lookup + password sign-in
- [ ] Validation on identifiers
- [ ] Errors surfaced (no email enumeration leak — CUST-H1 Fixed)
- [ ] Role trust = DB only (CUST-H7 Fixed)
- [ ] Forgot-password: works with real email
- [ ] Forgot-password: phone-only / synthetic — **CUST-H2 deferred**
- [ ] Mobile
- [ ] Demo chips DEV-only

## `/signup` — Ready

- [ ] Loads
- [ ] Create account CTA
- [ ] Phone uniqueness / conflict (CUST-H5 Fixed)
- [ ] Errors surfaced (409)
- [ ] Mobile

## `/account` — Ready

- [ ] ProtectedRoute customer only
- [ ] Profile / active visit / history / garage / loyalty / purchases
- [ ] Pending/confirmed in active visit (CUST-H4 Fixed)
- [ ] Archive / add vehicle CTAs
- [ ] Update phone with conflict check
- [ ] Errors surfaced
- [ ] Cannot call ops APIs (403)
- [ ] Mobile
- [ ] Memberships not shown (CUST-M2 — known gap)

## `/account/set-password` — Ready

- [ ] Works with recovery session
- [ ] Validation (strength / match)
- [ ] Errors surfaced
- [ ] No raw action_link required from SMS (CUST-H10 Fixed)
- [ ] Mobile

## Ops denial — No

- [ ] `/operations/*` blocked for customer role
