# Database & scale track — 2026-08-01

**Scope:** Postgres schema honesty, RLS/grants, indexes, and concurrency assumptions that block multi-TL floor and 50+ user scale.

**Prior fixes (do not re-litigate without regression):** Admin/ASA/TL/Staff/Marketing/Customer RLS CRITICAL items in `audits/*-deep/`. Historical RLS recursion on staff/branch helpers was addressed in earlier migrations — re-verify only.

**Related:** [`../00-MASTER-README.md`](../00-MASTER-README.md) P0 backlog · [`01-checklist.md`](./01-checklist.md) · [`flows.html`](./flows.html)

---

## Why this pack exists

Role UIs can look Ready while the database still allows:

1. Duplicate daily queue numbers under concurrent TL inserts  
2. ASA grant toggles that the RPC layer ignores  
3. Dual financial/ledger paths that drift  
4. Index bloat / missing indexes that hurt at 50+ sessions  
5. Policies with `WITH CHECK (true)` on public insert surfaces  

---

## Focus areas (summary)

| Topic | Status | P0? |
|-------|--------|-----|
| Queue `UNIQUE(branch, queue_date, queue_number)` | **Missing** | Yes — DB-P0-1 |
| `assign_daily_queue_number` RPC | **Missing from git** | Yes — DB-P0-1 |
| Dual ledgers (loyalty / sales / stamps) | Needs reconciliation checklist | P2 |
| Overlapping indexes | Needs catalog review | P2 |
| RLS recursion history | Fixed historically; re-verify | P1 verify |
| ASA grants vs RLS/RPC | UI-only for pos/finance/reports | Yes — ASA-P0-1 |
| Missing base DDLs in repo | Gaps vs live project | P1 |
| `sms_events` indexes | Review / add | P1 |
| Public `WITH CHECK (true)` | contact/complaints/events | CUST-H9 |
| `queue_number` text vs int | Type honesty | P2 |

---

## How to run

1. Walk [`01-checklist.md`](./01-checklist.md) against **live** Supabase (SQL editor) and **git** `supabase/migrations/`.  
2. Record pass/fail next to each checkbox.  
3. Use [`flows.html`](./flows.html) for the dependency graph (queue assign → UNIQUE → multi-TL).
