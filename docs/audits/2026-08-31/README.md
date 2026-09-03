# Full System Audit — 2026-08-31

**Branch:** `main`  
**Audit window:** 2026-08-31 (Asia/Manila)  
**Principal follow-up:** 2026-09-03 (find-bugs P0 + docs honesty)  
**Plan:** [docs/plans/2026-08-31-full-system-audit.md](../plans/2026-08-31-full-system-audit.md)  
**Tracker:** [`OWNER-REVISIONS.md`](./OWNER-REVISIONS.md)

## Honest status (2026-09-03)

| Layer | Status |
|-------|--------|
| Owner feature checklist (queue → payroll → P&L) | **Complete** for engineering DoD — see NEW-REVISIONS |
| Audit harness + real authed screenshots | **Pass** (`1d5d992` fixed login false-green) |
| Money contract on Console / Floor / Overview / Reports | **Aligned** to `finance_daily_pl` (paid + posted) |
| Live DB month seed (60+ sales) | **Partial** — dry-run fixture is CI truth; live = hours + tagged expenses only |
| Production cutover E2E + SMS env | **Open** — ops, not missing UI slices |

## Done definition

| Criterion | Result |
|-----------|--------|
| Multi-branch seed fixture (Bacoor + Imus) | Pass — `node scripts/seed-audit-data.mjs --dry-run` |
| Attendance / payroll / POS / shift / finance / KPI audits | Pass — see `test-results.txt` (suite grown beyond original 50) |
| Finance Overview owner exports (CSV / Excel / PDF) | Wired |
| Screenshots desktop + mobile | **80** PNGs in `screenshots/` (re-captured after auth fix) |
| Owner revisions tracker | `OWNER-REVISIONS.md` |

## Test summary

Latest principal verify (2026-09-03) — run:

```
node --test tests/seedAudit.test.js tests/attendanceAudit.test.js
  tests/posFlowAudit.test.js tests/shiftCloseAudit.test.js tests/payrollAudit.test.js
  tests/financeAudit.test.js tests/reportsAudit.test.js tests/frontendAudit.test.js
  tests/adminConsoleProfit.test.js tests/floorBoardPlPulse.test.js
  tests/screenshotAuth.test.js tests/busybeeHealth.test.js
```

Expect: **0 fail**, exit **0**. Exact counts live in [`test-results.txt`](./test-results.txt).

Seed counts: [`seed-fixture-summary.json`](./seed-fixture-summary.json)  
Screenshot manifest: [`screenshots-manifest.json`](./screenshots-manifest.json) — must show `"authed": true` and ops URLs **not** `/operations/login`.

## Module status

| Module | Status | Evidence |
|--------|--------|----------|
| Seed / fixtures | Pass (dry-run) | `src/lib/auditFixtures.js`; live expenses map to `total_minor` |
| Attendance | Pass | late weights, multi-branch hours, absent = 0 |
| POS / queue | Pass | paid totals A1, detailer ids, CA ≠ sales |
| Shift close | Pass | accept/lock gate, salary_draft_extras, variance |
| Payroll | Pass | wash pool literals, ceramic, CA deduct |
| Finance | Pass | P&L rollup, Overview exports; Reports fallback = paid+posted |
| KPI / Reports | Pass | retention, floor board + reports wiring |
| Frontend | Pass | no console.log in hubs, Reports→Finance redirect |
| Console / Floor P&L pulse | Pass | Sample* cards; expense_minor + net_minor |

## Screenshot gallery

Captured as Super Admin against `http://127.0.0.1:4173` (Vite preview).

Naming: `{route}--{tab?}--{desktop|mobile}.png`

Key owner surfaces:

- `finance--overview--desktop.png` / `finance--pl--desktop.png` / `finance--reports--desktop.png`
- `payroll--desktop.png` / `dashboard--desktop.png` / `console--desktop.png`
- `attendance--register--desktop.png` / `pos--desktop.png`

Re-run (credentials are **Node-only** — do not use `VITE_AUDIT_*`):

```bash
npm run build && npm run preview -- --host 127.0.0.1 --port 4173
BASE_URL=http://127.0.0.1:4173 AUDIT_EMAIL=… AUDIT_PASSWORD=… node scripts/screenshot-audit.mjs
```

## Money path (locked)

See [`docs/user-stories/shop-day-flow.md`](../user-stories/shop-day-flow.md) and [`docs/OPS/MONEY-CONTRACT.md`](../OPS/MONEY-CONTRACT.md).

```
Clock → TL wash / Sales detailing → POS paid → EoS → Finance accept → Floor payroll → P&L
```

**Expense books rule:** P&L / Floor / Console / Reports fallback use **`paid` + `posted` only**. `approved` (unpaid) is pending, not books.

## Known residuals

1. **SEED-LIVE (partial):** Dry-run fixture is authoritative for seam tests. Live script upserts `branch_operating_hours` and inserts tagged `expenses` (schema-correct as of 2026-09-03). Full sales/attendance/shift-close live insert is **not built** until ops asks.
2. Shop SMS remains **off** until BusyBee IP whitelist is intentionally re-enabled.
3. Visual pass closed — re-run harness after UI changes (see command above).
4. P6 counter-sale creator ACL is **wontfix** (single-BA lounge). KPI trend charts stay on Finance Overview only.
5. Ops cutover E2E + `OWNER_SMS_PHONE` — see NEW-REVISIONS checklist (open checkboxes).

## Owner revisions

Track open/resolved items in [`OWNER-REVISIONS.md`](./OWNER-REVISIONS.md).
