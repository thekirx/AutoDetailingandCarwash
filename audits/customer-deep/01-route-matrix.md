# Customer capability matrix (from code)

## Routes (`src/App.jsx`)

| Route | Access | Component |
|-------|--------|-----------|
| `/`, `/services`, `/packages`, `/branches`, `/terms`, `/privacy` | Public | Marketing / catalog |
| `/book` | Public | `BookingPage` → `/api/public-book` |
| `/queue` | Public | Branch picker |
| `/queue/:branch` | Public | `PublicQueuePage` (counts + numbers only in UI) |
| `/contact` | Public | `contact_inquiries` insert |
| `/complaints` | Public | `complaints` insert |
| `/events`, `/events/:slug` | Public | Published events + registration |
| `/f/:slug` | Public | Ops forms RPC |
| `/signin`, `/signup` | Public | Customer auth |
| `/account/set-password` | Recovery session | Set password |
| `/account` | `ProtectedRoute` `allowedRoles=['customer']` | `CustomerAccountPage` |
| `/operations/*` | Ops roles only | Customer denied by gate |

## Account portal capabilities (`/api/customer-portal`)

| Capability | Allowed | Mechanism |
|------------|---------|-----------|
| Read own profile | Yes | Service role + `customers.id = auth uid` + `role=customer` |
| Read own bookings history | Yes | `.eq('customer_id', userId)` |
| Read active visits + visit progress | Yes | Status filter + `buildVisitProgress` |
| Read own vehicles (garage) | Yes | Service role filter |
| Archive own vehicle | Yes | `archive-vehicle` + ownership check |
| Add / update own vehicle by plate | Yes | `add-vehicle`; blocks plate owned by other `customer_id` |
| Update phone / sync email | Yes | Own row only |
| Read loyalty stamps / milestones | Yes | Own `loyalty_stamps` + public milestones |
| Read own paid sales | Yes | `.eq('customer_id', userId)` |
| Branch queue counts (all cars) | Yes | Service role aggregates active bookings by branch |
| Read other customers | **No** | Portal scoped to `userId` |
| Mutate booking status | **No** | No portal action; ops API staff-only |
| Call BusyBee / provision / POS | **No** | Staff `staff_profiles` gate |

## Direct Supabase RLS (live)

| Table | Customer can |
|-------|----------------|
| `customers` | SELECT own row (`id = auth.uid()`) |
| `bookings` | SELECT own (`customer_id = auth.uid()`) |
| `vehicles` | **No** customer SELECT/UPDATE policy (portal only) |
| `sales` / `loyalty_ledger` / `customer_memberships` | **No** customer policies (portal only for sales/loyalty) |
| `contact_inquiries` / `complaints` | INSERT (anon+auth); no customer SELECT |
| `branches` / services / loyalty settings / milestones | Public read (catalog) |

## Auth identity model

- Preferred: `auth.users.id` === `customers.id` === `bookings.customer_id`
- Walk-in CRM rows may use a UUID **without** matching Auth user (provision path)
- Login identifiers: email, phone → synthetic `c{digits}@customers.hakumautocare.com`, or plate → vehicle lookup
- `AuthProvider` may synthesize `role: customer` from `user_metadata` when RLS/profile miss (ponytail fallback)
- Portal API **rejects** metadata-only role (`requireCustomer` checks `customers.role`)

## Explicit non-capabilities

- No membership management UI for customers (ops `/operations/memberships` only)
- No cancel/reschedule booking from account (request-only via `/book`)
- No plate PII beyond make/model/color from `/api/plate-lookup` (still enumerable)
- Ops home redirect: customer hitting `/operations` blocked by `ProtectedRoute` ops roles
