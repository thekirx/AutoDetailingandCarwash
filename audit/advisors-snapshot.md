# Advisors snapshot (live)

**Checked:** 2026-08-20 · `get_advisors` security + performance via Supabase MCP.

## Security — intentional / accepted

| Finding | Tables / objects | Audit stance |
|---------|------------------|--------------|
| SECURITY DEFINER views | `public_queue_numbers`, `public_queue_floor`, `public_queue_counts` | Intentional kiosk seam (no PII) — see `intentional-by-design.md` |
| RLS enabled, no policies | `queue_number_counters`, `queue_number_counters_persistent` | Service-role / DEFINER allocator only; clients must not touch |
| Auth leaked-password protection off | Auth project setting | Ops toggle in Supabase dashboard (not app code) |

## Security — fixed this pass

| Finding | Fix |
|---------|-----|
| `enforce_staff_attendance_geofence` executable by anon/authenticated | REVOKE ALL — trigger-only (`revoke_geofence_rpc`) |
| `haversine_meters` mutable search_path | `SET search_path = public, pg_temp` |

## Security — remaining WARN (expected for app RPCs)

Many `authenticated` SECURITY DEFINER RPCs (`complete_pos_sale`, `run_payroll`, queue transitions, etc.) are intentional: body checks role via `is_staff` / grants. Do not mass-revoke without a per-RPC audit.

Public ops form RPCs (`get_public_ops_form`, `submit_public_ops_form`) are intentional anon entrypoints.

## Performance

| Finding | Action |
|---------|--------|
| `unindexed_foreign_keys` | **Closed** — hot path (O) + remaining (P); live count **0** |
| `auth_rls_initplan` | **Closed** — branch/birthday (O) + blogs/notifications (P); live count **0** |
| `unused_index` (~101 INFO) | Parked OPT-08 — confirm with `pg_stat_user_indexes` before DROP |
| `multiple_permissive_policies` | **Closed** — Slices R–U; live count **0** |

## Remediation docs

- https://supabase.com/docs/guides/database/database-linter
- https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
