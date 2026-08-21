# Open audit items

Prioritized backlog. Pick top item on next **Continue**.

## Principal leftover audit — clear

Roles/users current in [`roles-users.md`](./roles-users.md). FK + InitPlan closed (O–P). Indexes (Q). Permissive RLS merges R–U — **`multiple_permissive_policies` = 0**.

## Optional follow-ups

| ID | Item | Notes |
|----|------|-------|
| OPT-01 | Homepage CMS for hero/cards | Static `publicHomeContent.js` by design |
| OPT-02 | Rename duplicate repo migration prefixes | Docs only |
| OPT-03 | Clean orphan `branch_operating_hours` migration row | Live name only |
| OPT-05 | Enable Auth leaked-password protection | Supabase dashboard toggle (no MCP) |
| OPT-08 | Remaining unused_index INFO (~101) | Only after sustained `pg_stat_user_indexes` |

## Closed this continue (Slice U)

| ID | Resolution |
|----|------------|
| B-37 | Sales read requires ASA `finance_view` |
| B-38 | Loyalty write requires `memberships` grant |
| B-39 | Catalog write no longer BA via `is_admin` |
| B-40 | Memberships write SA/ASA+memberships only |
| OPT-09 | **Closed** — multiple_permissive_policies **0** |

## Recommended next

**OPT-05** (Auth dashboard leaked-password toggle), **OPT-01** homepage CMS (product), or **OPT-08** unused indexes after usage proof. Hospitality ops W1–W7 shipped (Slice V). Say **continue**.

## Closed this continue (Slice V — hospitality)

| ID | Resolution |
|----|------------|
| W1–W6 | Shift close, payroll custom/packages/adj, My pay, notes, roles, ASA expense reports |
| OPT-05/08 | Documented deferred (dashboard / stats-backed only) |
