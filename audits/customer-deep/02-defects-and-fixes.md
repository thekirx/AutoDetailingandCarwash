# Customer defects and fixes

Live DB checked 2026-07-30: `bookings` is in `supabase_realtime`; anon has SELECT on bookings (column-limited for REST); policy `Public can read safe active queue rows` allows anon SELECT of all active floor tickets.

| ID | Sev | Defect | Evidence | Root cause | Suggested fix |
|----|-----|--------|----------|------------|---------------|
| CUST-C1 | CRITICAL | **Public queue Realtime leaks full booking PII** | `PublicQueuePage.jsx:76-78` subscribes `postgres_changes` on `bookings` for branch; live pub includes `bookings`; anon policy `Public can read safe active queue rows` (migration `20260715153235` ~1504-1509). Column grants only expose `branch/queue_number/status/is_archived` on REST — Realtime WAL payloads are full rows (name, phone, plate, notes, prices). | Realtime + broad anon SELECT RLS + table in publication | Remove `bookings` from `supabase_realtime` **or** drop anon bookings SELECT policy and drive public board only via `security_barrier` views / RPC; subscribe to a PII-free view or poll views only. |
| CUST-C2 | CRITICAL | **Guest `/api/public-book` attaches booking to any CRM customer by phone** | `server/publicBook.mjs:82-94` — if no JWT, `.eq('phone', customer_phone)` sets `customer_id`. Attacker who knows/guesses a phone pollutes victim history, active visit, SMS to victim. | Phone treated as ownership proof | Never auto-link guest bookings by phone alone. Link only when JWT customer matches, or require OTP proof of phone. Store guest bookings with `customer_id=null` until claimed. |
| CUST-C3 | CRITICAL | **Walk-in provision leaves Auth uid ≠ CRM `customers.id`** | `server/provisionCustomer.mjs:169-213` — when CRM row exists without Auth, updates CRM id but creates/keeps separate `authUser.id`; portal `requireCustomer` / bookings filter use Auth uid (`customerPortal.mjs:24-36`, `:48`). Provisioned walk-ins get login that cannot see their visits/loyalty. | Dual identity without merge | On provision: `auth.admin.createUser` with CRM id, or migrate bookings/vehicles to Auth uid and delete orphan CRM row; never leave split ids. |
| CUST-H1 | HIGH | **Auth lookup returns `login_email` + account status (enumeration)** | `server/customerAuthLookup.mjs:101-121` returns `login_email` for `ready`/`needs_password`; UI stores it (`CustomerSignInPage.jsx:83`). Anyone can probe email/phone/plate. | Lookup designed for UX without anti-enumeration | Return opaque statuses only (`ok` / `needs_setup` / `unknown`) without email; constant-time responses; tighten rate limits further. |
| CUST-H2 | HIGH | **Phone-only accounts cannot reset password** | `customerAuthLookup.mjs:155-162` rejects synthetic `@customers.hakumautocare.com` for reset/setup email. Walk-in SMS path historically carried links; portal forgot-password dead for phone-only. | Email-only recovery | Collect real email at provision; or magic-link SMS via controlled short-lived token page (not raw recovery URL in SMS logs). |
| CUST-H3 | HIGH | **Signed-in customer sees broken/incomplete live queue** | `public_queue_*` views use `security_invoker=true` (`20260715153235` ~1634-1640). Authenticated customer RLS = own bookings only → `/queue/:branch` undercounts / hides other numbers while session exists. | Public views inherit customer RLS | Use `security_definer` public queue views that only project safe columns, or force anon key for public queue fetches. |
| CUST-H4 | HIGH | **Pending/confirmed bookings invisible as “Active visit”** | `customerPortal.mjs:58-63` active filter omits `pending`/`confirmed`. Public book inserts `status:'pending'` (`publicBook.mjs:107`). Account shows “No active visit” after book. | Status set mismatch | Include `pending`/`confirmed` in active list; extend `buildVisitProgress` for those statuses. |
| CUST-H5 | HIGH | **Signup / phone update allow phone hijack (no uniqueness)** | `customerSignup.mjs` creates user with phone without checking existing CRM phone; `mutateCustomerPortal` `update-phone` (`customerPortal.mjs:231-236`) updates without unique constraint / conflict check. Enables CUST-C2 targeting and lookup collisions. | Missing unique phone + merge rules | Unique index on normalized phone for active customers; reject signup/update on conflict; merge/claim flow. |
| CUST-H6 | HIGH | **`/api/plate-lookup` unauthenticated, no rate limit** | `server/publicPlateLookup.mjs:19-74`; BookingPage debounce calls it (`PublicUtilityPage.jsx:95`). Enumerate plates → make/model/year/color. | Service-role public GET without throttle | Add `rateLimit` (IP + plate); require min length 4+; optional CAPTCHA; consider auth for known-plate autofill only when signed in. |
| CUST-H7 | HIGH | **AuthProvider / sign-in trust `user_metadata.role === 'customer'`** | `AuthProvider.jsx:71-83`; `CustomerSignInPage.jsx:142-158`; `CustomerAccountPage.jsx:211`; `publicBook.mjs:76`. Client can `updateUser({ data: { role: 'customer' } })` and enter account shell / attach bookings without DB customer row. Portal GET still 403, but booking attach + UX bypass remain. | Ponytail metadata fallback | Trust only `customers.role` / `staff_profiles.role`; remove metadata role checks at trust boundaries. |
| CUST-H8 | HIGH | **Anon can INSERT pending bookings directly (bypass API)** | Live policy `Public can submit pending bookings` + anon INSERT grant; column grants include name/phone/plate/etc. Spam / schedule flooding without `/api/public-book` validation (branch coming_soon, pricing). | Dual write path | Revoke anon INSERT on `bookings`; only service-role `/api/public-book`. |
| CUST-H9 | HIGH | **Contact / complaints / event registration open insert (spam / abuse)** | `contact_inquiries` / `complaints` / `event_registrations` policies `with check (true)`; pages insert from anon (`ContactPage.jsx:14`, `ComplaintsPage.jsx:27`, `EventsPage.jsx:27`). | No rate limit / CAPTCHA / size checks | Edge rate limit + honeypot; tighten CHECK (length); consider authenticated-only for complaints. |
| CUST-H10 | HIGH | **Provision SMS may queue full recovery `action_link`** | `provisionCustomer.mjs:215-221` embeds set-password URL in SMS body via `sms_events`. Link is bearer-equivalent; SMS logs / handset leak = account takeover. | Magic link in SMS | Email-only recovery; SMS with opaque short code to `/account/set-password?code=` exchanged server-side. |

## Lower priority (still customer-facing)

| ID | Sev | Defect | Notes |
|----|-----|--------|-------|
| CUST-M1 | MEDIUM | No customer RLS on `vehicles` / `sales` / `loyalty_ledger` | Defense-in-depth gap if portal ever replaced by client queries; today portal service-role is sole path |
| CUST-M2 | MEDIUM | Customer memberships not shown in portal | Capability gap vs CRM; not a security hole |
| CUST-M3 | MEDIUM | CORS `*` on customer APIs | Expected for SPA; rely on bearer + rate limits |
| CUST-M4 | MEDIUM | Demo chips only in DEV | OK (`CustomerSignInPage.jsx:46`) |
| CUST-M5 | LOW | Visit progress treats unknown status as step 0 | `queueLogic.js:54-63` |

## Verified OK (not defects)

| Check | Result |
|-------|--------|
| Customer → `/api/booking-status` | 403 — `staff_profiles` + ALLOWED roles (`bookingStatus.mjs:36-42`) |
| Customer → `/api/provision-customer` | 403 — `QUEUE_PROVISION_ROLES` (`provisionCustomer.mjs:28-44`) |
| Customer → `/api/busybee` | 403 — staff roles (`api/busybee.js:21-28`) |
| Customer → `/api/notify-booking` | 403 — staff allow-list |
| Portal vehicle plate hijack | Blocked — 409 if other `customer_id` owns plate (`customerPortal.mjs:163-170`) |
| Portal archive other vehicle | Blocked — `.eq('customer_id', userId)` |
| Public queue UI | Displays numbers only (payload leak is Realtime, not UI) |
| Ops routes | `ProtectedRoute` ops roles — customer redirected |

## Correct hypothesis

Customer data plane is mostly safe **through** `/api/customer-portal`, but public booking + public queue Realtime + split CRM/Auth ids broke isolation and account recovery. Hardening closed anon bookings surface, stopped phone-based auto-link, unified customer identity on provision, and removed PII from the public queue path.

## Fix status (2026-07-30)

| ID | Status |
|----|--------|
| CUST-C1 | Fixed — poll + drop anon SELECT + definer views |
| CUST-C2 | Fixed — JWT + `customers.role` only |
| CUST-C3 | Fixed — pin Auth id / remount + no SMS recovery URL |
| CUST-H1 | Fixed — strip `login_email` except plate |
| CUST-H2 | Deferred — needs real email on file |
| CUST-H3 | Fixed — security_definer public queue views |
| CUST-H4 | Fixed — include pending/confirmed |
| CUST-H5 | Fixed — unique phone index + portal 409 |
| CUST-H6 | Fixed — rate limit + min length 4 |
| CUST-H7 | Fixed — DB role only |
| CUST-H8 | Fixed — revoke anon INSERT |
| CUST-H9 | Deferred — CAPTCHA / edge rate limit |
| CUST-H10 | Fixed — invite SMS without action_link |
