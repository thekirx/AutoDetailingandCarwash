# Queue

**Route:** `/operations/queue`  
**Roles:** TL primary; SA/ASA/BA/Ops Lead  
**Shell:** Floor (TL) / Command

## Purpose
Advance same-day service and package tickets. Detailing stays on Bookings. Branch Admin may watch; Team Lead creates and advances.

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
