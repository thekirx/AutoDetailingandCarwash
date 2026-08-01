# Super Admin — open / deferred defects — 2026-08-01

Only **OPEN** or **deferred** items. CRITICAL/HIGH from [`../../super-admin-deep/03-defects-and-fixes.md`](../../super-admin-deep/03-defects-and-fixes.md) are Fixed unless listed.

| ID | Sev | Status | Summary | Action |
|----|-----|--------|---------|--------|
| SA-M4 | MED | Deferred | Console profit window mismatch vs Finance | Align window or label |
| SA-M5 | MED | Deferred | No dashboard / console export | Add export or remove promise |
| SA-M6 | MED | Deferred | People email/password edit UI incomplete (API exists) | Finish UI or hide |
| SA-M7 | MED | Deferred | My-tasks queue complete edge cases | Verify Mark done paths |
| OPS-M3 | MED | Deferred | Ops forgot-password lands on customer set-password | Accept bounce or dedicated ops path |
| RPT-P0-1 | P0 | OPEN | ReportsPage silent `.error` on expenses/crew/comps/books | Surface errors in UI |
| DB-P0-1 | P0 | OPEN | No queue UNIQUE / assign RPC in git | Migration + wire callers |
| PERF-P0-1 | P0 | OPEN | Eager App.jsx ~980KB chunks | React.lazy route split |
| AUTH-P0-1 | P0 | OPEN | getSession on PublicUtilityPage / NotificationBell / userSettings | Prefer getUser at trust edges |
| Crew geo / temp pwd | — | OPEN | Crew marked Partial | Server geo + complete temp pwd UX |
| Dashboard Partial | — | OPEN | Inventory Partial | Close gaps or document intentional |

Cross-cutting also in [`../00-MASTER-README.md`](../00-MASTER-README.md).
