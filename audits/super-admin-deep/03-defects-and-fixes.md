# Defects and fixes — Super Admin pass

| ID | Pri | Defect | Status |
|----|-----|--------|--------|
| SA-C1 | CRITICAL | POS `Link2` missing import → crash when loyalty linked | **Fixed** `PosPage.jsx` |
| SA-C2 | CRITICAL | Queue ticket action error unmounts whole page | **Fixed** loadError vs actionError |
| SA-C3 | CRITICAL | Reports best-sellers / crew / complaints unscoped | **Fixed** via sales ids + `applyBranchScope` |
| SA-C4 | CRITICAL | Demo passwords statically imported into client | **Fixed** DEV-only dynamic import |
| SA-H1 | HIGH | POS “today” used UTC slice | **Fixed** `getLocalCalendarDate` |
| SA-H2 | HIGH | Handoff cart used handoff UUID as service_id | **Fixed** `buildHandoffCartLine` |
| SA-H3 | HIGH | Multi-service final_price ignored | **Fixed** `queueApi.createQueueTicket` |
| SA-H4 | HIGH | Booking board missing floor statuses | **Fixed** columns + move options |
| SA-H5 | HIGH | SMS templates unused on send | **Fixed** template select + Use button |
| SA-H6 | HIGH | KPI branch array / fallback scope wrong | **Fixed** `resolveKpiRpcBranch` |
| SA-H7 | HIGH | Console silent partial errors | **Fixed** show `snap.errors` |
| SA-H8 | HIGH | Console staff ignore branch filter | **Fixed** staff scoped; products global (no branch col) |
| SA-H9 | HIGH | ASA promotion left branch assignments | **Fixed** clear on elevate |
| SA-H10 | HIGH | Finance NaN unit cost | **Fixed** validation |
| SA-M1 | MEDIUM | People “realtime” copy overclaim | **Fixed** copy |
| SA-M2 | MEDIUM | SMS events raw JSON | **Fixed** table |
| SA-M3 | MEDIUM | KPI `completed_today: 0` hardcoded | Softened (RPC field if present) |
| SA-M4 | MEDIUM | Console profit window mismatch | Deferred |
| SA-M5 | MEDIUM | No dashboard export | Deferred |
| SA-M6 | MEDIUM | People email/password edit UI | Deferred (API exists) |
| SA-M7 | MEDIUM | My-tasks queue complete missing | Deferred |
| SA-L1 | LOW | Orphan AdminLayout / DashboardPage | Documented only |

## Hypothesis that was correct (diagnose)

- POS crash: missing lucide import (`Link2`).
- Ticket UX: shared `error` state treated action failures as fatal load failures.
- Reports: `sale_line_items` has no branch; must join through `sales`.
- Demo credentials: static import survives DEV chip gate into prod chunks.
