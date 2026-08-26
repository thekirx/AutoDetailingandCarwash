# Hakum principal audit

Living record of the fullstack leftover audit (Aug 2026). Update after each **Continue** slice.

| Doc | Purpose |
|-----|---------|
| [completed-slices.md](./completed-slices.md) | What was audited, fixed, and verified |
| [open-items.md](./open-items.md) | Remaining gaps and recommended next slice |
| [bugs-fixed.md](./bugs-fixed.md) | Regressions and data bugs corrected |
| [migration-ledger.md](./migration-ledger.md) | Repo vs live Supabase migration alignment |
| [intentional-by-design.md](./intentional-by-design.md) | Known seams that are not bugs |
| [roles-users.md](./roles-users.md) | Every role + live staff/customer roster |
| [advisors-snapshot.md](./advisors-snapshot.md) | Live Supabase security/performance advisors |

**Live project:** `lybxhpzzqqyqswvuwpxv.supabase.co`  
**Verification bar:** `node --test tests/*.test.js` + `npx vite build`  
**Test count baseline (2026-08-20 Slice U):** 780 passing  
**Live smoke:** `node scripts/_qa-live-smoke.mjs` (21/21 on Slice M)

## How to use this folder

1. Before a new slice, read **open-items.md** and pick the highest-impact seam.
2. After shipping, append to **completed-slices.md** and **bugs-fixed.md** if applicable.
3. Move resolved rows out of **open-items.md**.
4. Reconcile **migration-ledger.md** whenever SQL lands live.

## Audit scope (original goal)

Every major role/workflow seam: RBAC chrome vs routes, POS/payroll concurrency, public catalog vs inventory, inquiries inbox, ASA grants, RLS hot paths, and honest blockers for e2e-only checks.
