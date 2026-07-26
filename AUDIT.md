# Hakum Auto Care — Functionality & Readiness Audit

**Date:** 2026-07-24  
**Progress:** **100%** — P0–P4 complete (see [AUDIT_CHECKLIST.md](./AUDIT_CHECKLIST.md); live proof: `scripts/e2e-readiness.mjs`)  
**Security baseline:** [Security (2).md](./Security%20(2).md) + [SECURITY_AUDIT.md](./SECURITY_AUDIT.md)

---

## Severity legend

| Tag | Meaning |
|-----|---------|
| **broken** | User cannot complete the job |
| **disconnected** | UI exists but not wired to DB/API |
| **stub** | Placeholder / hardcoded marketing |
| **risk** | Works but fragile (silent errors, auth, RLS) |
| **ok** | Wired and usable |

---

## Route inventory

### Public

| Path | Page | Status | Notes |
|------|------|--------|-------|
| `/` | PublicLandingPage | ok | Hero stats marketing-hardcoded |
| `/services` | ServicesPage | stub | Static list — not `services` table |
| `/packages` | PackagesPage | stub | Static packages |
| `/book` | BookingPage | ok | `/api/public-book`, plate-lookup |
| `/queue` | QueuePage | ok | Branch picker → `/queue/:slug` |
| `/queue/:branch` | PublicQueuePage | ok | Realtime queue views |
| `/branches` | BranchesPage | ok | `branches` table |
| `/contact` | ContactPage | ok | `contact_inquiries` |
| `/complaints` | ComplaintsPage | ok | `complaints` |
| `/events` | EventsPage | ok | `events` + registrations |
| `/terms` `/privacy` | Legal | ok | Static legal |

### Customer

| Path | Page | Status | Notes |
|------|------|--------|-------|
| `/signin` | CustomerSignInPage | ok | Lookup + Supabase Auth only |
| `/signup` | CustomerSignUpPage | ok | `/api/customer-signup` |
| `/account` | CustomerAccountPage | ok | `/api/customer-portal` |
| `/account/set-password` | CustomerSetPasswordPage | ok | Supabase recovery session |

### Operations

| Path | Page | Status | Notes |
|------|------|--------|-------|
| `/operations/login` | LoginPage | ok | Staff Auth + forgot (Supabase email) |
| `/operations/*` | Floor / POS / CRM / etc. | ok | Page-level RBAC |
| Settings modal | UserSettingsModal | ok | Theme, push, SMS opt-in, email, password |

### Legacy admin

| Path | Page | Status | Notes |
|------|------|--------|-------|
| `/admin` | → login or AdminLayout | risk | Dual routes historically |
| `/admin/dashboard` | DashboardPage | ok | Legacy shell |
| `/admin/bookings` | CalendarPage | ok | |
| `/admin/queue` | stub → redirect | fixed | Now redirects to `/operations/queue` |
| `/admin/customers` | MasterlistPage | ok | |
| `/admin/reports` | DashboardPage reuse | risk | Duplicate of dashboard |

---

## API map (all wired in Vite + Vercel `api/`)

| Endpoint | Auth | Purpose | Status |
|----------|------|---------|--------|
| `/api/customer-portal` | JWT customer | Portal + settings mutations | ok (ownership hardened) |
| `/api/customer-auth-lookup` | public + rate limit | Lookup / setup / reset | ok (Supabase email only) |
| `/api/customer-signup` | public | Signup | ok |
| `/api/public-book` | optional JWT | Public booking | ok |
| `/api/plate-lookup` | public | Plate autocomplete | ok |
| `/api/booking-status` | JWT ops | Booking board status | ok |
| `/api/notify-booking` | JWT ops | Transactional SMS + push | ok |
| `/api/busybee` | JWT admin | SMS tools | ok |
| `/api/push-subscribe` `/api/send-push` | JWT | Web push | ok |
| `/api/provision-customer` `/api/provision-staff` | JWT admin | Provisioning | ok |

**GraphQL:** Not used in this app. No GraphQL schema or client — REST + Supabase PostgREST only.

---

## Core flows (product loops)

| Flow | Status |
|------|--------|
| Customer signup → account → book → history → settings | ok |
| Customer forgot password → Supabase email → set-password | ok |
| Public book + live queue | ok |
| TL new ticket → status → assign → payment → POS | ok |
| CRM provision + outreach | ok |
| Ops settings (theme/push/SMS/email/password) | ok |
| Team forgot password (Supabase email) | ok |

---

## Known gaps (tracked in checklist)

1. Marketing Services/Packages not driven by `services` table (intentional marketing unless wired).
2. Landing hero stats hardcoded.
3. Several ops pages swallow Supabase `.error` (empty UI on RLS failure).
4. Older `/api` callers still use `getSession()` instead of fresh access token.
5. Demo account chips ship in client bundle.
6. Legacy `/admin/reports` duplicates dashboard.
7. No GraphQL layer (N/A).

---

## RLS / frontend common bugs

Silent empty data after RLS denial is the #1 “vibe code” failure mode:

- Always check `{ data, error }` — treat `error` as failure, not empty success.
- Prefer server routes with service role + JWT ownership for customer mutations (portal pattern).
- Do not rely on client-writable `user_metadata.role` for authorization.

Fixes applied this pass: portal `requireCustomer` requires live `customers` row; atomic plate claim; auth lookup rate limit; no `login_email` on reset responses; security headers; stub queue redirect; customer unauthorized redirect.

---

## Related docs

- [AUDIT_CHECKLIST.md](./AUDIT_CHECKLIST.md) — checkbox path to 100%
- [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) — Security (2).md adversarial review
- [Security (2).md](./Security%20(2).md) — bare minimum for vibe-coded apps
