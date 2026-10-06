# Queue

**Route:** `/operations/queue`  
**Roles:** TL primary; SA/ASA/BA/Ops Lead  
**Shell:** Floor (TL) / Command

## Purpose
Advance same-day service and package tickets. Detailing (incl. paint maintenance arrivals) stays on Bookings, which uses the same status-card + car-card layout for TL/BA. Branch Admin may watch; Team Lead creates and advances.

## Layout
```
[PageHeader + New]
[FilterBar branch/status/search]
[Board or list]
```

## Components
StatusBadge, FilterBar, ResponsiveSheet (ticket), ConfirmDialog (void).

## Task flow
Scan → tap ticket → advance status → optional SMS/push.
