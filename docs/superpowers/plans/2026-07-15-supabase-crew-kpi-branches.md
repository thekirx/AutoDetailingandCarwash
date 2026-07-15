# Supabase Crew KPI and Dynamic Branches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply and verify one atomic Supabase migration that supports multi-crew assignment history, participation KPI credit, individual deployed time, idempotent payment handoff, dynamic branches, and branch-secure authorization.

**Architecture:** A single transactional migration performs catalog-driven preflight validation, additive/backward-compatible schema changes, data normalization, RPC/trigger replacement, RLS/grant hardening, and index creation. A separate SQL verification artifact runs production-realistic scenarios entirely inside transactions that roll back, followed by catalog comparison and Supabase advisors.

**Tech Stack:** PostgreSQL 17, Supabase Auth/RLS/PostgREST, PL/pgSQL, Supabase migration API, Supabase advisors.

## Global Constraints

- Work only on Supabase; do not modify the React frontend.
- Create the repository migration before applying it remotely, and apply that exact SQL without modification.
- Do not use `supabase db push`.
- Keep the migration transactional and abort fully on any preflight failure.
- Preserve all production data and historical assignment rows.
- Use `coalesce(for_payment_at, completed_at)` for branch operational throughput with inclusive `Asia/Manila` dates.
- Revoke privileged RPC execution from `public` and `anon`; grant only minimum required access.
- Verification data must always roll back.
- Do not declare completion until rollback scenarios and security/performance advisors have run.

---

## File Map

- Create: `supabase/tests/crew_kpi_branches_verification.sql` — rollback-only behavioral and catalog assertions.
- Create: the timestamped `supabase/migrations/*_crew_kpi_dynamic_branches.sql` path printed by `supabase migration new`; after application its prefix is aligned to the exact remote version without changing file contents.
- Modify: `docs/superpowers/plans/2026-07-15-supabase-crew-kpi-branches.md` — mark completed checkpoints during execution.

### Task 1: Build the rollback-only verification harness

**Files:**
- Create: `supabase/tests/crew_kpi_branches_verification.sql`

**Interfaces:**
- Consumes: live `bookings`, `services`, `customers`, `staff_profiles`, `queue_assignments`, `branches`, `queue_events`, `pos_handoffs`, `transactions`, and the ten public business RPCs.
- Produces: SQL assertions that raise a named exception on failure and end with `rollback`.

- [ ] **Step 1: Create catalog assertions that fail before migration**

The test begins with `begin;`, checks for the required assignment columns, constraints, partial index, branch columns/FKs, helper/RPC signatures, `security_invoker` views, and restricted grants, then ends with `rollback;`. Assertions use this pattern:

```sql
do $verify$
begin
  if to_regprocedure('public.sync_queue_assignments(uuid,uuid[])') is null then
    raise exception 'VERIFY: sync_queue_assignments is missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'queue_assignments'
      and indexdef ilike '%unique%booking_id, staff_id%where%status = ''active''%'
  ) then
    raise exception 'VERIFY: active assignment partial unique index is missing';
  end if;
end
$verify$;
```

- [ ] **Step 2: Add transactional fixture helpers**

Use `gen_random_uuid()` identifiers and existing valid service/customer rows. Create temporary branch, team-lead, and three staff-profile rows inside the transaction. Set the request identity with:

```sql
select set_config('request.jwt.claim.sub', test_team_lead_id::text, true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
```

Switch back with `reset role` before inserting privileged fixtures. Do not insert persistent fake data or commit.

For every simulated identity, assert that `(select auth.uid())`, `public.current_user_role()`, and `public.current_user_branch()` return the fixture UUID, role, and branch before invoking a business RPC.

- [ ] **Step 3: Add assignment lifecycle scenarios**

Assert:

```text
one selected crew -> one active row
three selected crew -> three active rows
duplicate UUID input -> still three active rows
same complete input retry -> same row IDs and no history growth
booking in_progress -> all null starts populated
existing started_at -> unchanged
late-added crew -> later started_at
deselected crew -> cancelled row retained with audit fields
cancelled crew -> no released credit
```

- [ ] **Step 4: Add payment, KPI, and throughput scenarios**

Create a final-checking booking with three active assignments whose individual start times represent 60, 40, and 20 minutes at release. Assert the first handoff releases three rows and creates one handoff, while the retry returns the same handoff and releases zero. Then assert:

```sql
select count(*) = 3
from public.get_crew_kpi(current_date, current_date, test_branch_slug)
where cars_handled = 1;
```

Also assert the three deployed durations remain distinct and `get_branch_throughput` returns exactly one completed vehicle.

- [ ] **Step 5: Add branch and authorization scenarios**

Assert third-branch creation, display-name update without slug change, booking FK acceptance, archival rejection with active work, successful archival after rollback-local cleanup, reactivation, team-lead cross-branch denial, admin/BossMich cross-branch authorization, and retained Bacoor/Batangas rows.

- [ ] **Step 6: Add Manila boundary scenarios**

Insert rollback-local records immediately before and after Philippine midnight and assert half-open boundaries include the correct local calendar date only.

- [ ] **Step 7: Prove the harness fails against the pre-migration schema**

Run the verification SQL through `execute_sql` before applying DDL.

Expected: failure beginning with `VERIFY:` because the new RPC/schema objects do not exist. A syntax or fixture error is not an acceptable red result.

### Task 2: Create the exact atomic migration

**Files:**
- Create: the timestamped `supabase/migrations/*_crew_kpi_dynamic_branches.sql` path printed by Step 1 and captured as `MIGRATION_FILE`.

**Interfaces:**
- Consumes: the live catalog audited on 2026-07-15 and the approved design specification.
- Produces: assignment lifecycle constraints/triggers, authorization helpers, ten public business RPCs (assignment sync, payment handoff, crew KPI, branch throughput, four branch-management functions, payment completion, and the authenticated staff work queue), dynamic branch relationships, corrected views/RLS/grants, and required indexes.

- [ ] **Step 1: Generate the repository migration filename before remote DDL**

Run:

```bash
supabase migration new crew_kpi_dynamic_branches
```

Expected: one empty timestamped SQL file under `supabase/migrations/`.

Capture the exact generated path immediately:

```bash
MIGRATION_FILE=$(find supabase/migrations -maxdepth 1 -name '*_crew_kpi_dynamic_branches.sql' -print | sort | tail -1)
test -n "$MIGRATION_FILE"
```

- [ ] **Step 2: Add a transactional preflight section**

Start with `begin;`. Use catalog queries to reject unknown assignment statuses and find the actual hardcoded branch check rather than assuming its name. Validate every distinct non-null branch in each targeted table:

```sql
if exists (
  select b.branch
  from public.bookings b
  left join public.branches br on br.slug = b.branch
  where b.branch is not null and br.slug is null
) then
  raise exception 'Unknown branch value found in public.bookings.branch';
end if;
```

Repeat with a table-specific error for queue events, handoffs, and both vehicle branch columns.

- [ ] **Step 3: Normalize and constrain assignments**

Add the three cancellation columns. Map only the documented legacy statuses. Rank duplicate active pairs and cancel all but the earliest row without deletion. Add named status/timestamp checks using `not valid` followed by `validate constraint` where useful for short lock duration. Create the partial unique index and missing assignment indexes.

- [ ] **Step 4: Repair booking and assignment timing triggers**

Replace `handle_queue_timestamps()` with explicit `set search_path = pg_catalog, public`. Preserve existing values with `coalesce`. Add one after-update booking trigger to initialize missing active assignment starts and one before-insert assignment trigger to start late additions only for an `in_progress` booking. Revoke direct trigger-function execution from API roles.

- [ ] **Step 5: Repair authorization helpers**

Replace helpers so active/unarchived `staff_profiles` are authoritative and `is_admin()` recognizes both `admin` and `BossMich`. Add `is_team_lead()` and `can_manage_branch(text)`. Give every definer function an explicit search path and explicit `auth.uid()` behavior. Revoke from `public`/`anon`; grant authenticated execute only where policy evaluation needs it.

- [ ] **Step 6: Implement assignment synchronization**

Create `sync_queue_assignments(uuid, uuid[])` with a booking `for update` lock, deduplicated `unnest`, complete validation before mutation, `on conflict do nothing`, cancellation updates only for active rows, no reactivation, no released-row changes, branch enforcement, and deterministic returned rows.

- [ ] **Step 7: Implement idempotent payment handoff**

Lock the booking. Permit the initial final-checking transition and for-payment retries. Reuse the unique handoff and preserve its original `handed_off_at`; never reset a completed handoff. Preserve the booking's original `for_payment_at` and every assignment's original `released_at`, release only active assignments with one shared release instant, avoid duplicate queue events, and return `booking_id`, `handoff_id`, `released_assignment_count`, and `handoff_created`.

Drop the conflicting `trg_create_pos_handoff`. Repair `complete_payment` so it performs financial completion only, does not mutate queue assignments, enforces branch-aware authorization, and is not executable by anonymous callers.

- [ ] **Step 8: Implement reporting RPCs**

`get_crew_kpi(date,date,text)` constructs:

```sql
range_start := input_start_date::timestamp at time zone 'Asia/Manila';
range_end := (input_end_date + 1)::timestamp at time zone 'Asia/Manila';
```

Aggregate completed durations per session, count distinct booking IDs per staff, calculate current active time separately, and enforce caller branch scope.

`get_branch_throughput(date,date,text)` filters `coalesce(for_payment_at, completed_at)` against the same half-open instants and counts distinct bookings once. A booking qualifies only when its state is `for_payment` or `completed`; cancelled and all pre-handoff states are excluded.

- [ ] **Step 9: Make branches dynamic**

Add branch audit/archive columns, backfill BAC/BTG, validate uppercase code and URL-safe slug, make code unique, discover/drop the fixed booking branch check, and add the five branch foreign keys with `on update cascade on delete restrict`.

Implement normalized create/update/archive/reactivate RPCs for BossMich/admin only. Archive rejection checks active booking statuses, active assignments joined through bookings, and pending handoffs.

- [ ] **Step 10: Replace targeted RLS and grants**

Drop every existing targeted policy by catalog-discovered policy name in a loop, then create non-overlapping policies for admin/BossMich, team leads, staff ownership, and safe anonymous booking/queue access. Prefer a minimal public reporting RPC or tightly scoped view that does not require anonymous access to the full `bookings` table. If a `security_invoker` queue view requires underlying access, grant only the exact safe columns and rows needed by that view; keep customer, plate, crew, KPI, assignment-history, and payment fields unavailable.

Revoke broad table privileges, delete/truncate access on historical tables, and unintended function execution. Restore only the exact authenticated/anonymous privileges required by policies, safe views, and RPCs.

- [ ] **Step 11: Add remaining indexes and commit the SQL transaction**

Create required indexes with `if not exists`, avoiding definitions already covered by leading columns of existing composite indexes. End with:

```sql
notify pgrst, 'reload schema';
commit;
```

- [ ] **Step 12: Validate the migration artifact before application**

Run:

```bash
git diff --check
rg -n "auth\.role\(|raw_user_meta_data|grant execute.*anon|grant execute.*public" "$MIGRATION_FILE"
```

Expected: no whitespace errors and no unsafe authorization patterns.

### Task 3: Apply the exact migration and align history

**Files:**
- Modify only the migration filename if the remote ledger assigns a different version.

**Interfaces:**
- Consumes: byte-for-byte contents of the repository migration.
- Produces: one recorded live migration and a matching repository filename/version.

- [ ] **Step 1: Read the completed migration file once**

Capture its full contents and checksum:

```bash
shasum -a 256 "$MIGRATION_FILE"
```

- [ ] **Step 2: Apply those exact contents through the Supabase migration API**

Call `apply_migration` once with name `crew_kpi_dynamic_branches` and the unmodified file contents. Do not call `execute_sql` for production DDL and do not use `db push`.

Expected: successful migration result containing a remote version.

- [ ] **Step 3: Align and verify migration history**

Capture the exact version returned by the migration API as `REMOTE_VERSION`. Before renaming, assert that no local migration already uses `${REMOTE_VERSION}_` and abort on conflict. If the generated local prefix differs, rename with `mv "$MIGRATION_FILE" "supabase/migrations/${REMOTE_VERSION}_crew_kpi_dynamic_branches.sql"` without changing contents. Recompute the checksum and confirm it is identical. Query the live migration list and assert exactly one matching entry. Never edit the applied migration afterward.

### Task 4: Run complete rollback verification

**Files:**
- Use: `supabase/tests/crew_kpi_branches_verification.sql`

**Interfaces:**
- Consumes: migrated production schema.
- Produces: a complete pass/fail report with no retained fixtures.

- [ ] **Step 1: Run catalog verification**

Execute catalog assertions for columns, constraints, FKs, indexes, trigger definitions, function security/search paths, policy predicates, view security options, and grants.

Expected: all assertions pass.

- [ ] **Step 2: Run assignment and timing verification**

Execute the one-crew, three-crew, duplicate-input, idempotent-sync, start transition, late-addition, cancellation, and history-preservation cases.

Expected: all assertions pass and the transaction rolls back.

- [ ] **Step 3: Run payment and reporting verification**

Execute initial and repeated handoff calls, three-crew KPI, distinct deployed durations, one-booking throughput, and Manila boundary cases.

Expected: three crew credits, one branch vehicle, zero retry inflation, all assertions pass, and rollback succeeds.

- [ ] **Step 4: Run branch/RLS verification**

Execute branch creation/rename/archive/reactivate plus team-lead denial and admin/BossMich access checks under simulated authenticated identities.

Expected: authorized actions pass, cross-branch team-lead calls fail with the intended authorization error, and rollback succeeds.

- [ ] **Step 5: Prove no test records remain**

Query all unique fixture slugs/identifiers after rollback.

Expected: zero rows.

### Task 5: Advisors and final live comparison

**Files:**
- Never modify an applied migration. If a directly related advisor finding requires a fix, create and apply a new corrective migration artifact through the same create-first/exact-SQL workflow.

**Interfaces:**
- Consumes: final live database.
- Produces: advisor results, catalog diff, and frontend integration contract.

- [ ] **Step 1: Run security advisors**

Fetch Supabase security advisors. Fix any error or warning introduced by, or directly related to, the targeted functions/views/RLS/grants. Record unrelated pre-existing findings and remediation URLs.

- [ ] **Step 2: Run performance advisors**

Fetch performance advisors. Fix duplicate/missing-index or duplicate-policy findings in the targeted tables. Record unrelated findings separately.

- [ ] **Step 3: Compare live schema to the migration**

Re-query targeted columns, constraints, indexes, functions, views, triggers, grants, and policies. Confirm branch/status aggregates and production row counts remain intact.

- [ ] **Step 4: Confirm repository scope**

Run:

```bash
git status --short
git diff --name-only HEAD
```

Expected: only database test/migration artifacts and implementation documentation changed; no `src/` frontend file changed.

- [ ] **Step 5: Prepare completion report**

Report initial problems, exact migration file/version, schema/RPC/view/RLS/grant/index changes, KPI/throughput formulas, every verification result, advisor output with links, remaining dashboard/manual steps, and exact frontend RPC signatures.
