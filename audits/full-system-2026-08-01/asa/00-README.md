# ASA — full-system pack

**Role:** `assistant_super_admin`  
**Home:** `/operations/console`  
**Scope:** `branches_all` (default) or `staff_branch_assignments` when false  
**Date:** 2026-08-01

## Nav

Same as SA **minus** Cars and Data Center. Planning is **viewer** unless `planning_edit`. Finance **view-only** by default (`finance_write` false). Queue redo **Yes**.

## Prior deep audit

[`../../asa-deep/`](../../asa-deep/) — CRITICAL scope/grant bugs **Fixed**. Residuals: ASA-M1/M2 + cross-cutting ASA-P0-1.

## Contents

| File | Purpose |
|------|---------|
| [`01-page-checklist.md`](./01-page-checklist.md) | Per-route checkboxes |
| [`02-open-defects.md`](./02-open-defects.md) | OPEN only |
| [`flows.html`](./flows.html) | Mermaid + status |

## Inventory

Same Ready/Partial as BossMich for shared pages; **No** cars/data-center; planning viewer; finance view-only default; ASA-M1/M2 open; queue redo Yes.
