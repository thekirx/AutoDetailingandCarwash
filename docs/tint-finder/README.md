# Tint Finder

The finder lives at `/services/tint`, using the existing Hakum marketing layout and brand tokens. It implements the supplied Tint Finder Developer Handover version 1.3 (October 4, 2026).

## Launch

1. Apply `supabase/migrations/20261005130000_tint_finder.sql` using the project’s normal migration process. It creates the catalog and private request inbox and seeds the handover’s exact catalog and rules.
2. Deploy the branch with the existing public inquiry API environment variables. `SUPABASE_SERVICE_ROLE_KEY` stays server-side.
3. Sign in as Super Admin and open **Settings → Tint Finder** (`/operations/settings/tint-finder`). Check prices, film specs, recommendation rules and supplier benefit claims.
4. Confirm the exact films against the Skin Cancer Foundation recommended product list before checking any verified package or enabling the seal. The default is disabled; the results display the seal only when every recommended package is marked verified.
5. Test a request against a staging database and confirm it appears in the inbox. A request is a sales lead, not a confirmed appointment or an automatic insertion into the booking calendar.

Production database changes have not been applied by this implementation.

## Behavior and data

- Four questions, followed by recommended options only. Night driving is retained but does not score. Back preserves previously submitted answers.
- The catalog seed is `src/data/tintFinderConfig.json`. Customer visits read the shared settings table. If unavailable, the finder can display reference information from the seed; the server refuses bookings without a valid saved catalog.
- Super Admins can edit package names, warranty, vehicle prices, film specs, option film pairings, recommendation ordering, benefits, personalized benefit order and certification visibility through form controls. Saving validates all eyesight/priority coverage, package consistency, Clear Bluish placement and percentage/price ranges.
- The result shows placement, separate specs for each zone, selected vehicle price, the package price table, warranty, five disclaimers and personalized benefits.
- The nine icons and seal are the original embedded PNGs extracted from the supplied DOCX, without alteration. The lime artwork is preserved within the requested black panel.
- Booking requests collect name, Philippine mobile number, active public branch, preferred date and vehicle model, plus all answers, selected option and acknowledgment. The API calculates a trusted recommendation snapshot from the current catalog and validates the branch; client-supplied prices are ignored.
- Requests are stored in `tint_finder_leads`, viewable by Super Admins in the same settings page, with New / Contacted / Closed status. Staff notifications are best effort; saving a request does not depend on push delivery.
- “Message us” opens a draft addressed to the existing sales email with the selected package, film zones, vehicle category and reference price. The customer sends it.
- No customer quiz analytics, share service or upsell has been added; those are optional or later additions in the handover.

## Verification

```sh
npm test
node --test tests/tintFinder.browser.test.js
npm run build
```

Browser tests default to `http://127.0.0.1:5173`; override with `PUBLIC_TEST_URL`. They use mocked catalog/branch/intake responses, never submit real booking requests, and cover 1440px, 390px and 320px widths. API tests mock Supabase HTTP and cover trusted pricing, spam checks, acknowledgment, invalid options, unavailable branches and persistence failure.

The migration was executed in an isolated local PostgreSQL database with a minimal branch table and a test implementation of `is_super_admin()`. Grant and policy checks confirmed public catalog reads, no anonymous lead access or inserts, no non-admin edits or lead reads, and Super Admin reads/updates. Live Supabase authentication, push delivery and the deployed admin form still require staging verification after applying the migration.
