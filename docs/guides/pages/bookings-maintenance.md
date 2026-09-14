# Bookings and Maintenance

**Route:** `/operations/bookings`  
**Shell:** Floor (Sales/Detailer/Marketing) / Command

## Purpose
Detailing kanban/calendar + paint maintenance schedules.

## Tabs
Board · Calendar · Maintenance (intervals, due list, send reminder)

Maintenance lists plates that need action. Notify client sends SMS/push to book paint maintenance. Set date marks the visit done. Search still finds already-notified upcoming cars. TL can open a paint-maintenance booking from the row.

Create/edit booking: catalog make/model auto-selects car size; price follows that size. Staff may override.

## Components
OpsTabList, StatusBadge, DetailingMaintenancePanel, ConfirmDialog (status move notifies client).
