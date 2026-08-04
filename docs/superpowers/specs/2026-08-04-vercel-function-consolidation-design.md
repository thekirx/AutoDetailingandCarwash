# Vercel Function Consolidation Design

## Goal

Reduce the production Vercel deployment from 15 functions to 6 functions without changing public API URLs, UI behavior, response shapes, authorization, or secret handling.

## Root Cause

This Vite project uses Vercel's filesystem function convention. Every JavaScript file at the top level of `api/` is compiled as a separate Vercel Function. The deployed commit contains these 15 entrypoints:

| Public route | Entrypoint | Implementation |
| --- | --- | --- |
| `/api/booking-status` | `api/booking-status.js` | `server/bookingStatus.mjs` |
| `/api/busybee` | `api/busybee.js` | `server/busybee.mjs` plus authorization in the entrypoint |
| `/api/customer-auth-lookup` | `api/customer-auth-lookup.js` | `server/customerAuthLookup.mjs` |
| `/api/customer-portal` | `api/customer-portal.js` | `server/customerPortal.mjs` |
| `/api/customer-signup` | `api/customer-signup.js` | `server/customerSignup.mjs` |
| `/api/data-center` | `api/data-center.js` | `server/dataCenter.mjs` |
| `/api/notify-booking` | `api/notify-booking.js` | `server/notifyBookingApi.mjs` |
| `/api/plate-lookup` | `api/plate-lookup.js` | `server/publicPlateLookup.mjs` |
| `/api/provision-customer` | `api/provision-customer.js` | `server/provisionCustomer.mjs` |
| `/api/provision-staff` | `api/provision-staff.js` | `server/provisionStaff.mjs` |
| `/api/public-book` | `api/public-book.js` | `server/publicBook.mjs` |
| `/api/push-subscribe` | `api/push-subscribe.js` | `server/pushApi.mjs` |
| `/api/send-finance-quote` | `api/send-finance-quote.js` | `server/sendFinanceQuote.mjs` |
| `/api/send-push` | `api/send-push.js` | `server/pushApi.mjs` |
| `/api/update-staff` | `api/update-staff.js` | `server/provisionStaff.mjs` |

## Architecture

Replace the 15 public entrypoint files with six domain gateway entrypoints:

1. `api/customer.js`: customer auth lookup, signup, portal, and provisioning.
2. `api/staff.js`: staff provisioning and updates.
3. `api/bookings.js`: public booking, booking status, and plate lookup.
4. `api/notifications.js`: booking notifications, BusyBee SMS, push subscription, and push delivery.
5. `api/finance.js`: finance quotation email.
6. `api/data-center.js`: Super Admin data-center operations.

The existing URLs remain unchanged. `vercel.json` rewrites each legacy `/api/...` URL to the appropriate gateway and appends a fixed internal `operation` query parameter. Vercel must preserve every original query parameter while adding `operation`; for example, `/api/plate-lookup?plate=ABC123` must reach the bookings gateway with both `operation=plate-lookup` and `plate=ABC123`.

Each gateway uses an explicit, fixed allowlist that maps its supported operation names to statically imported handlers. It must not dynamically import a module or construct a file path from request input. A caller-supplied `operation` value must not select a handler from another gateway. Rewrites set the operation for public legacy routes, and gateway validation rejects missing, duplicate, unknown, or cross-domain operation values with JSON `404`.

The gateway selects the existing handler and supplies the same helper functions each old wrapper supplied. Unsupported methods continue to be handled by the existing domain handlers.

The Vite development middleware keeps mounting the legacy URLs directly. Production and local development therefore retain the same browser-facing contract while sharing the existing server implementations.

## Supabase and Security Boundaries

No service-role operation moves into browser code. Auth Admin provisioning, cross-customer reads, data export/import/purge, SMS, email, and VAPID delivery remain server-side.

Some operations superficially resemble ordinary Supabase client CRUD but are not safe to remove as complete endpoints:

- Push subscription rows have own-row RLS, but the server derives trusted `role` and `branch_slug` values. Direct browser writes would permit target-group spoofing unless a database trigger first replaced those values.
- Customer portal queries include protected aggregates and cross-table checks beyond the customer's own RLS-visible rows.
- Booking status updates can use the authenticated Supabase client, but SMS, inbox, and push fan-out still require server-side secrets and privileged reads.

The existing Supabase `send-sms` Edge Function is not used as a replacement because it does not implement the application's staff-role and branch authorization model. No Edge Function migration is necessary to meet the Vercel limit, and adding one would create a deployment dependency without reducing application behavior or secret exposure.

## Error Handling and Compatibility

- Preserve request methods, bodies, query strings, bearer headers, CORS headers, status codes, and JSON response shapes by delegating to the unchanged handlers.
- Preserve all caller query parameters when a rewrite appends the fixed internal operation value.
- Reject attempts to override, duplicate, or cross-route the internal operation value.
- Preserve the original site-origin calculation for customer and staff provisioning.
- Keep BusyBee authorization in server code rather than exposing provider credentials.
- Keep all existing frontend `fetch('/api/...')` calls unchanged.
- Keep the SPA fallback excluding `/api/` paths.

## Testing and Verification

1. Add tests that assert all 15 legacy routes map to the expected six gateways with fixed operation values.
2. Add rewrite tests proving original query parameters survive alongside the appended operation value.
3. Add gateway dispatch tests that verify each legacy operation selects only its allowlisted handler and that missing, duplicate, unknown, overridden, and cross-domain operations return `404`.
4. Run the full test suite and lint.
5. Run `npm run build`.
6. Run `vercel build --prod` and count `.vercel/output/functions/*.func` directories. The required final count is 6 and must not exceed 12.

## Non-Goals

- No UI, copy, navigation, or styling changes.
- No database schema or RLS changes.
- No change to API URLs or payloads.
- No deployment, push, or Supabase Edge Function publication as part of this change.
