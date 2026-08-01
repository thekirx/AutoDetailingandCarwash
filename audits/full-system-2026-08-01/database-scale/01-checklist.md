# Database & scale checklist — 2026-08-01

Evidence: paste SQL result counts / migration filenames beside items when checked.

---

## 1. Queue number concurrency (DB-P0-1)

- [ ] Live table `bookings` (or queue source) has `UNIQUE (branch, queue_date, queue_number)` — **expected FAIL today**
- [ ] Constraint covers archived vs active policy (partial unique if archive allowed to reuse — document choice)
- [ ] `assign_daily_queue_number` (or equivalent) exists in `supabase/migrations/` — **expected FAIL / missing from git**
- [ ] Function is `SECURITY DEFINER` with explicit `search_path` and role checks
- [ ] New Ticket / public book / provision paths **only** allocate numbers via that RPC (no client-side max+1)
- [ ] Concurrent test: two sessions insert same branch+date → one succeeds, one retries next number
- [ ] `queue_number` type is consistent (**text vs int**) across table, views, RPCs, and UI parse logic
- [ ] Public queue views project number safely (no PII) — CUST-C1 Fixed; re-verify publication

### Failure mode if skipped
Two Team Leads create tickets → duplicate display numbers → floor chaos / wrong handoff.

---

## 2. ASA grants vs RLS / RPC (ASA-P0-1, ASA-M1, ASA-M2)

- [ ] Inventory: every ASA grant key in People UI has a matching server check
- [ ] `pos` grant enforced inside `complete_pos_sale` (or wrapper) — **OPEN ASA-M2**
- [ ] `finance_write` enforced on expenses INSERT/UPDATE/DELETE — **OPEN ASA-M1** (`is_admin()` style risk)
- [ ] `finance_view` enforced on expenses/sales SELECT for ASA
- [ ] `reports` grant enforced on Reports data RPCs/queries (not only `allowRoute`)
- [ ] `queue_all` still enforced on `sync_queue_assignments` (ASA-H1 Fixed — regression check)
- [ ] `planning_edit` enforced in plan_* RLS
- [ ] `rbac_edit` still required to persist `permission_grants` (ASA-C3 Fixed)
- [ ] Document intentional ungated surfaces (ASA-M3 CRM/Bookings)

### Failure mode if skipped
Revoking ASA `pos` in UI still allows POS RPC → **grant honesty failure**.

---

## 3. Dual ledgers / money paths

- [ ] Map writers: `sales`, `loyalty_ledger`, `loyalty_stamps`, POS complete, Finance manual, memberships
- [ ] Single source of truth documented for “customer loyalty balance”
- [ ] No double-credit path on POS + manual adjust without audit row
- [ ] Reports aggregations use same branch scope as Finance (SA-C3 Fixed — regression)
- [ ] Soft-deleted / voided sales excluded consistently
- [ ] Currency / NaN guards still present (SA-H10 Fixed)

---

## 4. Indexes — missing & overlapping

### Expected hot paths
- [ ] `bookings (branch, queue_date, queue_number)` — supports UNIQUE + lookups
- [ ] `bookings (branch, status, is_archived)` — floor board
- [ ] `queue_assignments (booking_id)` / `(staff_id, status)`
- [ ] `sms_events (created_at DESC)` and/or `(branch, created_at)`
- [ ] `sms_events (customer_id)` if filtered in CRM
- [ ] `sales (branch, sold_at)` / `(customer_id)`
- [ ] `staff_branch_assignments (staff_id)` / `(branch_slug)`
- [ ] `attendance_*` by branch + day if Crew scales

### Overlap / bloat
- [ ] `pg_indexes` review: drop exact duplicate indexes
- [ ] No redundant single-column index already covered by leading UNIQUE columns (document keep/drop)
- [ ] Write amplification acceptable on `bookings` + `sms_events` under load test

---

## 5. RLS recursion history

- [ ] Confirm no policy on `staff_profiles` that re-enters `staff_profiles` via helper without `SECURITY DEFINER` break
- [ ] `user_has_branch_access` / `current_user_role` / `asa_has_grant` do not recurse
- [ ] Empty Admin/ASA/TL scope still fail-closed (`NO_BRANCH_SCOPE`) — deep audits Fixed
- [ ] Live `EXPLAIN` on a scoped bookings SELECT for Admin does not stack-overflow / timeout

---

## 6. Missing base DDLs in git

- [ ] Diff live schema vs `supabase/migrations/` for: queue assign RPC, UNIQUE, any production-only functions
- [ ] Document every object that exists only in dashboard (drift list)
- [ ] Add migrations for drift **before** next production change
- [ ] CI or doc step: “no hotfix SQL without migration PR”

---

## 7. Public `WITH CHECK (true)` surfaces (CUST-H9)

- [ ] `contact_inquiries` — rate limit / CAPTCHA / length CHECK
- [ ] `complaints` — same
- [ ] `event_registrations` — same
- [ ] Anon INSERT on `bookings` still revoked (CUST-H8 Fixed — regression)
- [ ] Prefer Edge Function + service role over open table inserts where possible

---

## 8. `queue_number` text vs int

- [ ] Column type recorded: `text` | `int` | `numeric`
- [ ] App parse (`Number`, pad, sort) matches type
- [ ] Views cast consistently
- [ ] Migration plan if normalizing (expand → backfill → constrain → switch)

---

## 9. Scale readiness (ties to PERF-P0-1 / OPS-P0-1)

- [ ] Connection pooling (Supabase pooler) used by server
- [ ] No N+1 client fan-out on console snapshot for 50 users
- [ ] Rate limit backend is shared store (not process memory) — **OPS-P0-1 OPEN**
- [ ] Realtime: public queue does not republish full PII (CUST-C1 Fixed)
- [ ] Partition or archive strategy for `sms_events` / old bookings (document only OK)

---

## Sign-off

| Area | Pass? | Notes |
|------|-------|-------|
| Queue UNIQUE + RPC | [ ] | DB-P0-1 |
| ASA grant honesty | [ ] | ASA-P0-1 / M1 / M2 |
| Ledgers | [ ] | |
| Indexes | [ ] | |
| RLS recursion verify | [ ] | |
| DDL drift | [ ] | |
| Public WITH CHECK | [ ] | CUST-H9 |
| queue_number type | [ ] | |

**Database-scale go for multi-TL / 50+:** `[ ] YES` / `[x] NO` (default 2026-08-01)
