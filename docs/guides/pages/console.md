# Console

**Route:** `/operations/console`  
**Roles:** SA, ASA (grant), BA as allowed  
**Shell:** Command

## Purpose
Role-aware home: today pulse, exceptions, quick actions.

## Layout
```
[PageHeader Console]
[StatCards: sales | queue | open issues | attendance]
[Two-col: exceptions list | quick actions]
```

## Components
PageHeader, StatCard, DataTable (exceptions), Button.

## States
Loading skeletons · Empty "All clear" · Error retry.

## Responsive
1-col under 768; 2-col desktop.
