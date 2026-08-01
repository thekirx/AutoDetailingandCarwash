# Super Admin (BossMich) — full-system pack

**Role:** Super Admin (`BossMich`)  
**Home:** `/operations/console`  
**Scope:** All branches (`getBranchScopeList` → `null`)  
**Date:** 2026-08-01

## Nav (full ops matrix)

Console · Planning · People · Branches · Cars · Audit · Data Center · Dashboard · Queue · Queue New · Queue Ticket · Crew · KPI · My Tasks · POS · Finance · CRM · Bookings · Reports · Memberships · Login

## Prior deep audit

[`../../super-admin-deep/`](../../super-admin-deep/) — CRITICAL/HIGH mostly **Fixed**. This pack = residual Partials + page checklists.

Also: [`../../ui-dead-controls/`](../../ui-dead-controls/)

## Contents

| File | Purpose |
|------|---------|
| [`01-page-checklist.md`](./01-page-checklist.md) | Every route checkbox pass |
| [`02-open-defects.md`](./02-open-defects.md) | OPEN / deferred only |
| [`flows.html`](./flows.html) | Mermaid nav + Ready/Partial table |

## Inventory (this pass)

| Page | Ready? |
|------|--------|
| console | Partial (SA-M4/M5) |
| planning | Yes |
| people | Partial (SA-M6) |
| branches | Yes |
| cars | Yes |
| audit | Yes |
| data-center | Yes |
| dashboard | Partial |
| queue / new / :id | Yes |
| crew | Partial (geo / temp pwd) |
| kpi | Yes |
| my-tasks | Yes |
| pos / finance / crm / bookings / memberships | Yes |
| reports | Partial (silent `.error`) |
| login | Partial (OPS-M3) |
