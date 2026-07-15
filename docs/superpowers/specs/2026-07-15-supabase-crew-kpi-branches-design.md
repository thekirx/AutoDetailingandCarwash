# Supabase Crew KPI and Dynamic Branches Design

## Scope

This database-only change prepares Supabase project `lybxhpzzqqyqswvuwpxv` for multi-crew queue assignments, participation-based crew KPIs, individual deployed time, idempotent payment handoff, dynamic branches, and branch-scoped authorization. It does not change the React frontend.

The implementation is one atomic SQL migration. The migration must preserve every existing production row and abort completely if any preflight check fails.

## Production Baseline

- The project runs PostgreSQL 17.6 with database timezone UTC.
- Repository migration history and the live migration ledger have drifted: twelve SQL files exist locally, while only four migrations are recorded remotely.
- The repository is not linked through the local Supabase CLI. `supabase db push` must not be used because it could replay older repository files.
- Live branch values currently resolve to `bacoor` or `batangas`; no unknown non-null values were found in the targeted branch columns.
- `queue_assignments` currently contains two released rows, both with null `started_at`, and no duplicate active `(booking_id, staff_id)` pairs.
- The live schema has no assignment-status check, cancellation audit columns, timestamp checks, or partial active-assignment unique index.
- Existing queue/payment functions and policies are inconsistent with later repository migrations. In particular, anonymous execution and broad table grants remain on sensitive objects.
- `public_queue_counts` and `public_queue_numbers` are not `security_invoker` views and are reported by the Security Advisor.

## Migration Delivery

1. Create the migration file first with `supabase migration new <name>`.
2. Put the complete SQL in that repository file before any remote DDL is executed.
3. Apply the exact file contents, without modification, through the connected Supabase migration API.
4. Do not use `supabase db push`.
5. Confirm the remote migration ledger version and make the repository filename match that version if the migration API assigns a different version.
6. Compare the final live catalog with the migration and retain no uncommitted temporary verification data.

The migration uses a top-level transaction. Preflight failures raise exceptions before persistent changes can commit.

## Assignment Lifecycle

`public.queue_assignments.status` has exactly three valid values:

- `active`
- `released`
- `cancelled`

Legacy values are normalized as follows:

- `assigned` and `in_progress` become `active`.
- `completed` becomes `released`.
- Existing valid values remain unchanged.
- Any other non-null value aborts the migration instead of being silently rewritten.

The migration adds nullable `cancelled_at timestamptz`, `cancelled_by uuid`, and `cancellation_reason text`. `cancelled_by` references `auth.users(id)` with `on delete set null` when existing data permits the foreign key.

Before creating the partial unique index, duplicate active rows are ranked by the earliest usable assignment timestamp, then `created_at`, then `id`. The first row remains active. Later duplicates become cancelled with `cancelled_at = now()` and cancellation reason `Duplicate active assignment cleaned during migration`. No row is deleted and released/cancelled history is never rewritten.

The unique rule applies only to active rows:

```sql
unique (booking_id, staff_id) where status = 'active'
```

Nullable legacy timestamps remain allowed. Checks reject `released_at < started_at`, `completed_at < started_at`, and `cancelled_at < created_at` whenever both sides are non-null.

## Assignment Timing

The existing booking timestamp trigger is extended so the first transition to `in_progress` preserves or initializes both:

```text
in_progress_at = coalesce(in_progress_at, now())
actual_start   = coalesce(actual_start, in_progress_at, now())
```

An after-update trigger starts every active assignment with a null `started_at` from the booking's `in_progress_at`, falling back to the statement timestamp. Existing assignment start times are never reset.

Assignments inserted while the booking is already `in_progress` receive their own current insertion time. Assignments created while waiting keep `started_at` null. Assignment synchronization is rejected once a booking is beyond the editable waiting/in-progress workflow, except that an identical retry returns the existing active list without mutation.

Completed deployed duration is always:

```sql
coalesce(released_at, completed_at) - started_at
```

No booking creation, waiting, ticket, payment, or other crew timestamp participates in this duration.

## Authorization Helpers

Authorization reads current data from `staff_profiles`, not JWT user metadata. Inactive or archived staff profiles have no operational authorization.

The migration repairs or creates helpers equivalent to:

- `current_user_role()`
- `current_user_branch()` / the compatible existing `current_user_branch_slug()`
- `is_admin()` for `BossMich` or `admin`
- `is_team_lead()`
- `can_manage_branch(text)`

Helpers have an explicit search path and avoid recursive RLS by using narrowly scoped `security definer` access where necessary. Execution is revoked from `public` and `anon`. Only functions required by authenticated policies receive authenticated execute permission.

## Assignment Synchronization RPC

```text
public.sync_queue_assignments(input_booking_id uuid, input_staff_ids uuid[])
```

The function is transactional, idempotent, `security definer`, and uses an explicit search path. It:

1. Requires `auth.uid()`.
2. Allows BossMich, admin, or a team lead.
3. Locks and validates the booking.
4. Restricts team leads to their own branch.
5. Deduplicates the input array and treats null as an empty selection.
6. Validates that every selected ID is an active, unarchived `staff` profile assigned to the booking branch.
7. Inserts only missing active assignments.
8. Never reactivates cancelled rows or changes released rows.
9. Cancels active assignments absent from the submitted complete selection, setting the cancellation audit fields.
10. Starts newly inserted assignments immediately only when the booking is already `in_progress`.
11. Returns the final active assignment rows in deterministic order.

Concurrent calls serialize on the booking row. The partial unique index protects the final active pair invariant during concurrent or realtime refresh retries.

## Payment Handoff

```text
public.send_queue_ticket_to_payment(input_booking_id uuid)
```

The repaired function:

1. Requires an authenticated BossMich, admin, or team lead.
2. Locks the booking and restricts team leads to their branch.
3. Accepts the initial `final_checking` call and an idempotent retry after the booking is already `for_payment`.
4. Reuses the unique `pos_handoffs.booking_id` row and preserves the original `handed_off_at` and `for_payment_at`.
5. Does not reset an already completed handoff to pending.
6. Preserves one transaction/handoff relationship per booking instead of creating retry duplicates.
7. Releases only active assignments.
8. Sets `released_at` once and sets `completed_at` from the same release timestamp when missing.
9. Leaves released and cancelled assignments unchanged.
10. Emits at most one operational transition event for the initial handoff.
11. Returns booking ID, handoff ID, released assignment count, and a created-versus-reused flag.

The conflicting automatic POS-handoff trigger is removed so the RPC is the single transactional owner of handoff creation. `complete_payment` is repaired so it cannot write legacy assignment statuses, repeat operational KPI credit, or execute anonymously. Financial completion remains distinct from operational handoff.

## Crew KPI RPC

```text
public.get_crew_kpi(
  input_start_date date,
  input_end_date date,
  input_branch_slug text default null
)
```

The RPC uses inclusive Philippine dates by constructing a half-open UTC instant range from midnight `Asia/Manila` on the start date through midnight after the end date.

Completed records are filtered using `coalesce(released_at, completed_at)` within that range and require released status plus non-null start and end timestamps.

Per staff and booking:

- `cars_handled` is `count(distinct booking_id)`.
- All valid released sessions are summed for `completed_deployed_seconds`.
- Multiple crew assigned to the same booking each receive one full car credit.
- Repeated sessions for one staff member and booking add duration but do not add car credit.
- `average_completed_seconds` is total completed seconds divided by distinct handled cars, returning zero when the denominator is zero.
- Active jobs and active deployed seconds are reported separately from completed work.
- Cancelled assignment counts use cancellation timestamps inside the selected range.

BossMich/admin can query all or one branch. Team leads are forcibly restricted to their stored branch. Staff do not receive general KPI access in this phase.

## Branch Throughput RPC

```text
public.get_branch_throughput(
  input_start_date date,
  input_end_date date,
  input_branch_slug text default null
)
```

Operational completion uses:

```sql
coalesce(bookings.for_payment_at, bookings.completed_at)
```

The timestamp is converted through `Asia/Manila` date boundaries. Each `bookings.id` is counted once. Waiting, in-progress, final-checking, and cancelled bookings do not count. Repeated payment-handoff calls cannot increase throughput because the booking ID and original `for_payment_at` are preserved.

`completed_vehicle_count` is operational throughput. Paid vehicles and completed transactions remain separate financial KPIs and are not derived from crew credits.

## Dynamic Branches

`public.branches` gains:

- `code text`
- `is_archived boolean not null default false`
- `archived_at timestamptz`
- `created_by uuid`
- `updated_by uuid`

Existing codes are backfilled as `BAC` and `BTG`. Codes are unique uppercase strings of two through five characters. Slugs are stable, unique lowercase URL-safe identifiers. Display names may change without changing slugs. Branch rows are archived, never deleted.

Before foreign keys are added, a preflight block checks every distinct non-null branch value in:

- `bookings.branch`
- `queue_events.branch`
- `pos_handoffs.branch`
- `vehicles.first_branch`
- `vehicles.last_branch`

Any missing branch aborts the migration and reports the table/value. The hardcoded booking branch check is discovered through PostgreSQL catalogs and removed. Validated foreign keys reference `branches.slug` with `on update cascade on delete restrict`.

Branch management RPCs are:

- `create_branch(name text, slug text, code text, address text)`
- `update_branch(input_branch_slug text, name text, code text, address text, is_active boolean)`
- `archive_branch(input_branch_slug text)`
- `reactivate_branch(input_branch_slug text)`

Only BossMich/admin may execute them. Inputs are normalized and validated in the database. Archival is rejected while active bookings, active assignments, or pending handoffs exist for the branch.

## RLS and Grants

RLS remains enabled on all targeted public tables. Policies are replaced by exact catalog-discovered names rather than assumed names.

- BossMich/admin: all-branch operational visibility and management allowed by policy/RPC purpose.
- Team leads: branch-scoped booking, assignment, event, handoff, attendance, staff-pool, and KPI access.
- Staff: own assignments and only the booking fields/rows needed for work; no general customer, payment, KPI, or assignment-history visibility.
- Anonymous: only active branches, strict public booking submission compatibility, and explicitly safe public queue views/RPCs.

Broad anonymous table privileges are revoked. Authenticated grants are reduced to operations actually supported by RLS or RPCs. Delete and truncate are not exposed for historical operational tables.

Existing public queue views are converted to `security_invoker = true`. Anonymous underlying booking access is limited with column grants and an RLS predicate to the safe active queue rows required by those views. Sensitive customer, plate, crew, KPI, assignment-history, and payment fields remain unavailable.

Every privileged RPC has execute revoked from `public` and `anon`, then granted only to `authenticated`. Trigger functions and internal helpers that are not API endpoints have direct execute revoked from API roles.

## Indexes

The migration compares existing index definitions and adds only missing useful coverage for the required assignment, booking, staff, event, handoff, and branch access patterns. Existing equivalent composite indexes satisfy redundant single-column requirements where PostgreSQL can use their leading columns. The partial unique active-assignment index is always present after migration.

## Verification

Verification is performed with SQL transactions that always roll back. Test data uses unique generated identifiers and leaves no rows behind.

The verification matrix covers:

1. One crew assignment and three distinct crew assignments for one booking.
2. Duplicate input UUID removal and idempotent assignment synchronization.
3. Starting a booking and populating all missing assignment start times without resetting existing times.
4. Adding a crew member after progress begins and observing a later personal start time.
5. Cancelling a deselected crew assignment without deleting history or awarding credit.
6. Payment handoff releasing all and only active assignments.
7. Repeated handoff returning the same handoff, zero new releases, no new event, and no extra KPI or throughput.
8. Three crew each receiving one car credit and individual deployed durations for one booking.
9. Branch throughput increasing by exactly one for that booking.
10. Dynamic third-branch creation, booking acceptance, display-name rename, and stable historical linkage.
11. Team-lead cross-branch denial and BossMich/admin cross-branch access.
12. Bacoor and Batangas preservation.
13. Inclusive `Asia/Manila` date-boundary behavior.
14. Constraint, index, function, view, grant, and policy catalog checks.

After functional verification, security and performance advisors are rerun. Targeted findings introduced by or directly related to this migration are fixed before completion. Any unrelated pre-existing advisor findings are documented with remediation links rather than silently expanding this task into unrelated schema work.

## Success Criteria

- The exact repository migration is applied once and recorded remotely.
- Production data and assignment history are preserved.
- Assignment, payment, KPI, throughput, branch, RLS, and grant requirements pass rollback-only verification.
- No frontend file changes exist.
- The final report names the migration/version, catalog changes, verification outcomes, advisor results, RPC signatures, and later frontend integration work.
