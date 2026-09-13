# Role-by-role system QA — 2026-09

Campaign index for persona allow/deny, workflows, evidence, and P0/P1 fixes.

**Landing `/home` is out of scope.** Ops shells + customer `/account/*` + public utilities (`/book`, `/queue/:branch`, `/f/:slug`, `/contact`, `/complaints`) are in scope.

## Pointer

**Current wave:** COMPLETE — see [PROGRESS.md](./PROGRESS.md)  
**Verdict:** **DONE 100%** · soft-launch **READY_WITH_OPS_BLOCKERS** (SMS env)

## Pack

| File | Purpose |
|------|---------|
| [MATRIX.md](./MATRIX.md) | Role × route allow/deny (code-actual) |
| [WORKFLOWS.md](./WORKFLOWS.md) | Master workflow index |
| [UI-CONSISTENCY.md](./UI-CONSISTENCY.md) | Ops/customer premium notes |
| [PROGRESS.md](./PROGRESS.md) | Per-prompt log |
| [roles/](./roles/) | Per-persona QA sheets |

## Source of truth

- `src/auth/permissions.js` — `getOperationsNav`, `allowRoute`, docks, `redirectForRole`
- `docs/user-stories/roles-matrix.md`
- `docs/guides/roles/*.md`
- `src/lib/demoAccounts.js`

## Evidence

Screenshots: `e2e-evidence/role-qa/` (+ packs `e2e-evidence/ui-p0/`, `e2e-evidence/ui-money/`)

Regenerate matrix: `node scripts/_gen-role-matrix.mjs`
