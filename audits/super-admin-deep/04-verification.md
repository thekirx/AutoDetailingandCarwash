# Verification — Super Admin deep audit

## Commands (this session)

```bash
node --test tests/posSale.test.js tests/crmPart7.test.js tests/part8.test.js tests/localCalendarDate.test.js tests/permissions.test.js tests/queueLogic.test.js tests/demoAccounts.test.js tests/bookingsBoardContrast.test.js
npm run build
rg -l "HakumBoss2026" dist   # expect no matches
```

## Results

| Check | Exit | Evidence |
|-------|------|----------|
| Focused tests | **0** | 50 pass / 0 fail |
| `npm run build` | **0** | vite built; PWA generated |
| Demo passwords in `dist/` | **absent** | `NO_PASSWORD_IN_DIST` |

## Realtime (SA) — confirmed in code

Live: Dashboard, Queue, Ticket, My Tasks, Crew attendance, POS sales/handoffs, Bookings, Planning.

Poll/load only: Console, People, Branches, Cars, Audit, Finance, CRM, SMS, Reports, KPI, Memberships.

## Data authenticity

No fabricated sales/queue/customer rows found on SA surfaces. Acceptable constants: payment methods, column labels, SMS types. Floor vehicle sizes fall back only when DB empty.
