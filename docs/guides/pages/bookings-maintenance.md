# Bookings and Maintenance

**Route:** `/operations/bookings`  
**Shell:** Floor (Sales/Detailer/Marketing) / Command

## Purpose
Detailing kanban/calendar + paint maintenance schedules.

## Tabs
Board · Calendar · Maintenance (intervals, due list, send reminder)

Maintenance lists plates that need action. Notify client sends SMS/push to book paint maintenance. Set date marks the visit done. Search still finds already-notified upcoming cars. TL can open a paint-maintenance booking from the row.

## TL / Branch Admin floor board
TL and BA get a Queue-style Board instead of the kanban: status cards (Placeholder → Done + **Maintenance**) on top, then car cards for the picked stage (`?stage=` in the URL). Phone: 3-column cards, single-column list; tablet 5 / 2; desktop one row / 3.

- **TL** advances stages from the card (never into Payment — that handoff is POS).
- **BA** sees the pipeline read-only but owns reminders (Notify client / Remind again) for their branch.
- **Car arrived · Start intake** (TL, BA, OL, ASA, SA): creates a Paint Maintenance booking at **Vehicle intake**, priced by car size, and texts the client the status. A plate already open on the board shows *On board · stage* instead (server returns 409 on duplicates). Car without make/model on file → use New booking.

API: `POST /api/maintenance-schedules { id, action: 'arrive' }`; reminders are branch-scoped for non-all-branch roles.

Create/edit booking: catalog make/model auto-selects car size; price follows that size. Staff may override.

## Components
OpsTabList, StatusBadge, BookingFloorBoard (TL/BA), DetailingMaintenancePanel, ConfirmDialog (status move notifies client).
