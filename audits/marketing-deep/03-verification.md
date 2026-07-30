# Marketing deep audit — verification

**Date:** 2026-07-30  
**Role:** `marketing`

## Commands (this session)

```text
node scripts/marketing-regression-check.mjs
→ RED exit 1 (pass 3 | fail 1) · GREEN exit 0 (pass 4 | fail 0)

node --test tests/marketingScope … teamLead staff admin asa
→ exit 0 · 33 pass · 0 fail

npm run build
→ exit 0 · vite built in ~23.6s
```

## Migration applied (remote)

`marketing_crm_scope` — bookings/sales/sms_events/customers/vehicles policies.

## Role audit sequence complete

SA → ASA → Admin → TL → Staff → Marketing packs under `audits/`.
