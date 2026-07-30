# Super Admin (BossMich) — Deep Audit

**Role:** Super Admin (`BossMich`)  
**Home:** `/operations/console`  
**Scope:** All branches (`getBranchScopeList` → `null`)  
**Nav:** Full ops matrix via `getOperationsNav` / every `allowRoute` key  

## Done definition

1. Every SA route inventoried (buttons, modals, validation, data source, realtime).
2. Dummy/hardcoded operational data removed or flagged; critical/high defects fixed.
3. Tests + production build green with fresh evidence.

## Contents

| File | Purpose |
|------|---------|
| `01-route-matrix.md` | Routes, gates, nav |
| `02-page-findings.md` | Per-page audit |
| `03-defects-and-fixes.md` | Prioritized defects + fix status |
| `04-verification.md` | Commands + results |

## TDD seams (confirmed for this pass)

1. `buildPosSalePayload` / handoff cart line id — never use handoff UUID as `service_id`
2. Reports line-item aggregation — scoped via parent `sales.branch`
3. Queue ticket — load errors ≠ action errors (page must stay mounted)
4. POS “today” — `getLocalCalendarDate()` (Asia/Manila)
5. Demo credentials — DEV-only dynamic import (not in prod bundle)

## Out of scope this pass

- ASA / Admin / TL / Staff / Marketing full audits (next folders)
- Architectural realtime for Finance/CRM/Reports (documented only)
