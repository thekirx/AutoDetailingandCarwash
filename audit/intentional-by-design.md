# Intentional by design

Documented so future audits do not re-file these as bugs.

| Seam | Why |
|------|-----|
| Public queue DEFINER views | Kiosk shows queue number only; no PII leak — advisor ERROR is accepted |
| Geofence as DB trigger (not RPC) | Clients must not call `enforce_staff_attendance_geofence`; EXECUTE revoked |
| Homepage static service cards | Marketing art/copy in `publicHomeContent.js`; live names/prices on `/services` via Inventory |
| Repo synthetic migration timestamps | Supabase MCP apply uses wall-clock versions; ledger maps repo file → live name |
| Duplicate `20260819140000_*` repo prefixes | Two different SQL files; live applied under distinct versions — leave filenames alone |
| Orphan live migration `branch_operating_hours` | Name recorded without creating table; real table from `branch_operating_hours_table` |
| Mobile Detailing inactive in Inventory | Matches homepage `available: false` until SA activates |
| Ceramic tier names (PREMIUM/PLATINUM) | Marketing packages; not separate Inventory SKUs |
| Crew **My pay** vs Payroll confirm | Wash-pool salary posts only from Payroll confirm; Crew tab / My pay **Estimate — unpaid** is not posted pay |
| Custom roles Option A | `role_definitions` + `custom_role_key`; `profile_role` enum unchanged |
| Shift end time is BA-editable | Closing is not fixed to branch hours; BA/ASA/SA set `shift_ended_at` on End of shift |
| Commission default 15th & month-end | `payout_frequency = semimonthly`; Payroll custom range still overrides anytime |
| Customer notes have no branch column | Guest notes are customer/plate global for CRM hospitality |
| Shift close in Finance Reports | Read-only attestation filter; P&L still POS sales + paid/posted expenses |
| Investor / SA null branch scope | All-site readers by role |
| `ProtectedRoute` loading on `user && !profile` | Prevents unauthorized flicker; not a hang |
| Branch Admin no Finance nav but POS expenses | `canWriteFinance` true for POS expense tab; `allowRoute('finance')` false |
| Branch Admin cannot write Inventory catalog | RLS matches `canManageServices` (SA / ASA services_merch\|pos) |
| Marketing always has CRM + bookings | Role contract; not ASA grant-scoped |
| Marketing cannot write `events` via RLS | No Content / Planning-edit UI; published events remain public-readable |
| Detailers use Bookings for detailing | Queue is services/packages only; detailing pipeline is `/operations/bookings` |
