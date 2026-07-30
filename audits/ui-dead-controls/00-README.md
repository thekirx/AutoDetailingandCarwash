# UI dead / empty / redundant controls — deep audit

**Done definition:** Every interactive control either works end-to-end, is intentionally hidden when gated, or is removed as redundant. No forever-disabled primary CTAs that look operable.

## Ranked findings → status

| ID | Sev | Status | Fix |
|----|-----|--------|-----|
| OPS-H1 | HIGH | Fixed | Hide queue ticket edit panel when `!canManageQueue` |
| OPS-H2 | HIGH | Fixed | TL label `Move to final check` + cashier note (no fake POS promise) |
| OPS-H3 | HIGH | Fixed | Hide Mark redo unless redo lane role |
| OPS-H4 | HIGH | Fixed | CRM Ticket uses `canViewQueueOperations` (includes ASA) |
| PUB-1 | HIGH | Fixed | `/book` reads PPF `location.state` + matches service |
| PUB-2 | HIGH | Fixed | Disable forgot/setup email for phone/plate/synthetic |
| PUB-3 | HIGH | Fixed | Garage Book seeds `initialVehicle` |
| PUB-4 | MED | Fixed | Push Enable disabled when unsupported |
| PUB-5 | MED | Fixed | PublicLayout trusts DB `profile.role` only |
| PUB-6 | MED | Fixed | Install Got it → native install when available |
| OPS-M1 | MED | Fixed | Remove duplicate QuoteCard on Finance Reports tab |
| OPS-M4 | MED | Fixed | Handoff rows link to `/operations/pos` |
| OPS-M9 | MED | Fixed | Delete orphan `DashboardPage` / `CalendarPage` / `MasterlistPage` / `AdminPages` |
| OPS-L1/L2 | LOW | Fixed | Single Settings entry (footer / More) |
| PUB-12 | LOW | Fixed | Removed unused PublicMessage |

## Deferred (product / not broken buttons)

| ID | Notes |
|----|-------|
| OPS-M2 | Finance Reports vs ReportsPage overlap — keep both with clear roles |
| OPS-M3 | Ops forgot-password still lands on customer set-password (works via bounce) |
| OPS-M6 | Planning viewer for Admin — intentional Viewer badge |
| OPS-M7 | Membership weight Save SA-only — hide vs disable remaining polish |
| OPS-M8 | Crew vs People dual provision — both live; consolidate later |
| PUB-7 | Coating cards still generic /book (PPF path fixed; other cards optional query) |
| PUB-8/9 | Multiple Book / Push entry points — UX density, not broken |
| CUST-H2 | Phone-only reset still needs real email on file (product) |

## Verify

```bash
node --test tests/uiDeadControls.test.js
node --test tests/customerScope.test.js tests/adminScope.test.js tests/teamLeadScope.test.js
npm run build
```
