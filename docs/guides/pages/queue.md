# Queue

**Route:** `/operations/queue`  
**Roles:** TL primary; SA / ASA (queue_all) / Ops Lead — **Branch Admin is denied**  
**Shell:** Floor (TL) / Command

## Purpose
Advance same-day service and package tickets. Detailing (incl. paint maintenance arrivals) stays on Bookings, which uses the same status-card + car-card layout for TL/BA. Team Lead creates and advances; Branch Admin watches the branch from Bookings and collects payment at POS, not from the Queue board.

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
