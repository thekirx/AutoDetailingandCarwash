# People and Roles

**Route:** `/operations/people`  
**Shell:** Command  
**Roles & Permissions:** ASA grants matrix in this page (no separate route)

## Purpose
Staff provisioning + assistant grant matrix.

## Tabs
Crew · Team Leads · Admins · Office. Create account is a modal. Directory search/filter plus attendance dashboard. Super Admin can tag a supervisor (reports-to).

`/operations/crew` redirects here to Attendance — hire lives on People, not a second crew page.

## Layout
```
[Tab strip]
[Search / filters]
[Staff DataTable or cards]
[Create account modal]
[Selected user Sheet]
[Grants matrix by ASSISTANT_GRANT_GROUPS]
```

## Components
DataTable, ResponsiveSheet, grant toggles, ConfirmDialog.
