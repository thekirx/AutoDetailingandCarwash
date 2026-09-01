# Full System Audit — 2026-08-31

**Branch:** `main`  
**Commit:** `c23cb0f` (+ audit worktree changes)  
**Date:** 2026-08-31 (Asia/Manila)  
**Plan:** [docs/plans/2026-08-31-full-system-audit.md](../plans/2026-08-31-full-system-audit.md)

## Done definition

| Criterion | Result |
|-----------|--------|
| Multi-branch seed fixture (Bacoor + Imus) | Pass — `node scripts/seed-audit-data.mjs --dry-run` |
| Attendance / payroll / POS / shift / finance / KPI audits | **50/50** pass — see `test-results.txt` |
| Finance Overview owner exports (CSV / Excel / PDF) | Wired |
| Screenshots desktop + mobile | **80** PNGs in `screenshots/` |
| Owner revisions tracker | `OWNER-REVISIONS.md` |

## Test summary

```
Command: node --test tests/seedAudit.test.js tests/attendanceAudit.test.js
  tests/posFlowAudit.test.js tests/shiftCloseAudit.test.js tests/payrollAudit.test.js
  tests/financeAudit.test.js tests/reportsAudit.test.js tests/frontendAudit.test.js
Result: 50 pass · 0 fail · exit 0
```

Full log: [`test-results.txt`](./test-results.txt)  
Seed counts: [`seed-fixture-summary.json`](./seed-fixture-summary.json)  
Screenshot manifest: [`screenshots-manifest.json`](./screenshots-manifest.json)

## Module status

| Module | Status | Evidence |
|--------|--------|----------|
| Seed / fixtures | Pass | `src/lib/auditFixtures.js`, `scripts/seed-audit-data.mjs` |
| Attendance | Pass | late 0.875 / 0.6875, multi-branch hours, absent = 0 |
| POS / queue | Pass | paid totals A1, detailer ids, CA ≠ sales |
| Shift close | Pass | accept/lock gate, salary_draft_extras, variance |
| Payroll | Pass | wash pool literals 37333/32667, ceramic 95000, CA deduct |
| Finance | Pass | P&L rollup, expense bars, branch sales, Overview exports |
| KPI / Reports | Pass | retention buckets, floor board + reports wiring |
| Frontend | Pass | no console.log in hubs, Reports→Finance redirect |

## Screenshot gallery

Captured as Super Admin against `http://127.0.0.1:4173` (Vite preview).

Naming: `{route}--{tab?}--{desktop|mobile}.png`

Key owner surfaces:

- `finance--overview--desktop.png` / `finance--pl--desktop.png` / `finance--reports--desktop.png`
- `payroll--desktop.png`
- `attendance--register--desktop.png`
- `kpi--crew--desktop.png` / `kpi--sales--desktop.png`
- `pos--desktop.png` / `dashboard--desktop.png`
- Public: `public--home--desktop.png`, `public--book--desktop.png`, …

Re-run:

```bash
npm run build && npm run preview -- --host 127.0.0.1 --port 4173
BASE_URL=http://127.0.0.1:4173 AUDIT_EMAIL=… AUDIT_PASSWORD=… node scripts/screenshot-audit.mjs
```

## Money path (locked)

See [`docs/user-stories/shop-day-flow.md`](../user-stories/shop-day-flow.md) and [`docs/OPS/MONEY-CONTRACT.md`](../OPS/MONEY-CONTRACT.md).

```
Clock → TL wash / Sales detailing → POS paid → EoS → Finance accept → Floor payroll → P&L
```

## Known residuals

1. Live DB seed of full sales/attendance month is optional — dry-run fixture is authoritative for seam tests; live mode upserts operating hours + tagged expenses only (`SEED-LIVE` still open if ops want DB population).
2. Shop SMS remains **off** until BusyBee IP whitelist is intentionally re-enabled.
3. Visual pass completed this session — see `OWNER-REVISIONS.md` (SHOT-AUTH, AC-PULSE, TAB-MOBILE). Re-run harness after UI changes:
   `BASE_URL=http://127.0.0.1:4173 AUDIT_EMAIL=… AUDIT_PASSWORD=… node scripts/screenshot-audit.mjs`
4. P6 counter-sale creator ACL is **wontfix** (single-BA lounge). KPI trend charts remain on Finance Overview only.

## Owner revisions

Track open/resolved items in [`OWNER-REVISIONS.md`](./OWNER-REVISIONS.md).
