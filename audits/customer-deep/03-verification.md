# Customer verification

## Feedback loop (Phase 1)

```bash
node --test tests/customerScope.test.js
node scripts/customer-regression-check.mjs
npm run build
```

## Live DB (2026-07-30, post `customer_public_harden`)

| Check | Result |
|-------|--------|
| Anon bookings SELECT policy | Dropped (`Public can read safe active queue rows`) |
| Anon bookings INSERT policy | Dropped (`Public can submit pending bookings`) |
| `public_queue_*` views | `security_invoker=false` (definer) |
| Unique active phone | `customers_active_phone_uidx` |

## Correct hypothesis (post-fix)

| ID | Cause confirmed | Fix |
|----|-----------------|-----|
| CUST-C1 | Anon SELECT + Realtime full-row WAL + client subscribe | Drop anon SELECT; poll views; security_definer views |
| CUST-C2 | Guest phone auto-link | `resolveBookingCustomerId` JWT+DB role only |
| CUST-C3 | Auth uid ≠ CRM id on provision | Pin Auth id to CRM / remount FKs; SMS without recovery URL |
| CUST-H1 | Lookup returned `login_email` | `publicAuthLookupPayload` strips for email/phone |
| CUST-H3 | Invoker views + customer RLS | Definer views |
| CUST-H4 | Active list omitted pending | `CUSTOMER_ACTIVE_VISIT_STATUSES` |
| CUST-H5 | No phone uniqueness | Partial unique index + portal 409 |
| CUST-H6 | Open plate lookup | Rate limit + min length 4 |
| CUST-H7 | Metadata role trust | AuthProvider / sign-in / account require DB role |
| CUST-H8 | Anon INSERT bookings | Policy + revoke dropped |
| CUST-H10 | Recovery URL in SMS | `buildProvisionInviteMessage` text-only |

## Deferred

| ID | Why |
|----|-----|
| CUST-H2 | Phone-only accounts still need a real email for Auth reset (product collect-email) |
| CUST-H9 | Contact/complaints CAPTCHA — separate spam hardening |
