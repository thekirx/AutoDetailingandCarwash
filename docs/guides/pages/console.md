# Console

> **Retired — route removed.** `/operations/console` no longer exists in `src/App.jsx`. Super Admin and the Assistant Super Admin now land on the **Floor Board** (`/operations/dashboard`). Branch Admin has no console surface at all.

**Route:** ~~`/operations/console`~~ — **removed**  
**Roles:** ~~SA, ASA (grant), BA as allowed~~ → Floor Board is SA / ASA; Branch Admin lands on POS  
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
