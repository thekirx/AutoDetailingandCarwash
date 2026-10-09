# Sales

**Home:** `/operations/bookings`  
**Shell:** FloorAppShell  
**Device:** Phone / tablet  
**Scope:** All branches

## Dock

Bookings · Queue · CRM · History · (More: none)

## Daily flow

1. Bookings board: create detailing bookings and move stages  
2. Queue: watch every branch (filter by branch). Wash tickets are view only. Tap a detailing ticket to open it in the Bookings editor (status, service, price); closing returns to Queue  
3. CRM: view only. Look up customers, vehicles, visits, smart groups, and insights. No edit, add vehicle, message, or SMS  
4. History lookup by plate/phone  
5. Maintenance tab when relevant

## Enforced at

- Route gate: `allowRoute` (`queue` = `canViewQueueBoard`, `queue-new` denied, `crm` = `canAccessCrm`)  
- UI: `canEditQueueTicket` (detailing only), `canEditCrm` false hides CRM writes and the SMS tab  
- API: `/api/booking-status` refuses Sales on non-detailing bookings  
- DB: `bookings` insert/update RLS lets Sales write detailing-board services only

## Must never see

POS checkout, payroll, people, finance write, wash queue edits, new queue tickets, CRM edits or SMS sends.
