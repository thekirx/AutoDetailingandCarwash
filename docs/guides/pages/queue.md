# Queue

**Route:** `/operations/queue`  
**Roles:** TL primary; SA/ASA/BA/Ops Lead  
**Shell:** Floor (TL) / Command

## Purpose
Advance tickets through wash/detail statuses.

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
