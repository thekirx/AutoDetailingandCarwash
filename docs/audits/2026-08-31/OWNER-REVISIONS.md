# Owner revisions tracker — audit 2026-08-31

Source checklists: [`docs/OPS/NEW-REVISIONS-CHECKLIST.md`](../OPS/NEW-REVISIONS-CHECKLIST.md), [`docs/OPS/MONEY-CONTRACT.md`](../OPS/MONEY-CONTRACT.md).

**Last principal pass:** 2026-09-03 — find-bugs P0 closed (Reports paid/posted, seed schema, harness hygiene). Docs aligned to HEAD.

Status values: `open` · `resolved` · `wontfix` · `partial`

| ID | Page / area | Comment | Status | Resolved-in |
|----|-------------|---------|--------|-------------|
| Q1–Q8 | Queue / TL | Owner queue asks (accept, search, statuses, QA, FIFO, POS handoff) | resolved | prior / NEW-REVISIONS LIVE |
| D1–D9 | Detailing board | Tint/coating/PPF pipeline, photos, calendar | resolved | prior / NEW-REVISIONS LIVE |
| P1–P11 | POS | Handoff lock, methods, inventory deduct, owner SMS after accept | resolved | prior (P6 accepted partial) |
| P6 | POS creator ACL | Counter-sale lines not ACL’d per creator | wontfix | single-BA lounge; see NEW-REVISIONS |
| F1–F11 | Finance | P&L, vendors, quotes, corporate, reports, overview charts + **exports** | resolved | Overview CSV/Excel/PDF |
| S1–S5 | Salary / CA | BA draft ≠ BA confirm; CA ≠ sales | resolved | money contract hybrid |
| E1–E3 | Attendance / My Pay | Geo clock, late weight, My Pay | resolved | attendance Geo + compensation |
| ATT-LATE | Attendance / Payroll | Late pay must use Manila wall clock + per-branch hours | resolved | `c23cb0f` + this audit |
| SMS-OFF | CRM SMS | Shop gate was off pending BrandTxt IP whitelist | resolved | 2026-09-03 — whitelist `180.190.249.189`; gate **ON**; live sends to `09625294043` verified |
| FIN-OWNER | Finance Overview | Owner needs clear P&L + expenses + branch sales + export | resolved | Overview charts + export strip |
| UX-SHOTS | All pages | Take pictures for judging / revising | resolved | 80 PNGs re-captured after auth fix (`1d5d992`) |
| SEED-LIVE | Data | Full live insert of 60+ sales | partial | Dry-run fixture authoritative. Live mode: operating hours upsert + tagged expenses (schema fixed 2026-09-03). Sales/attendance/shift closes **not** live-inserted — intentional YAGNI until ops asks |
| VIS-REVIEW | Screenshots | Human visual pass on desktop/mobile PNGs | resolved | SHOT-AUTH / AC-PULSE / TAB-MOBILE |

## Residuals noted during codebase map

| ID | Page / area | Comment | Status | Resolved-in |
|----|-------------|---------|--------|-------------|
| FB-PL | Floor board | Revenue-only → expenses + net | resolved | expense_minor + net_minor tiles |
| AC-PROFIT | Admin Console | profitMinor hidden → Sample revenue/expenses/profit | resolved | `1d5d992` |
| FB-CHEM | Floor chemical | Stub until Sunday recon | resolved | honest empty copy — not a bug |
| KPI-CHART | KPI page | No Recharts on KPI | wontfix | Finance Overview owns owner charts |

## Findings from audit + 2026-09-03 principal find-bugs

| ID | Page | Comment | Status | Resolved-in |
|----|------|---------|--------|-------------|
| SHOT-AUTH | screenshot harness | `/operations/login` counted as authed | resolved | `isOpsAuthedUrl` |
| AC-PULSE | Admin Console | Period profit vs Today ₱0 mislabel | resolved | Sample* labels |
| TAB-MOBILE | Ops tabs | Mobile labels crushed | resolved | overflow-x-auto + shrink-0 |
| FIN-VS-CONSOLE | Books pulse | Console ≠ Finance month window | resolved | Footnote (by design) |
| FIN-REPORTS-APPROVED | Finance Reports | Fallback summed `approved` expenses — drift vs `finance_daily_pl` | resolved | 2026-09-03 — paid+posted only |
| SEED-SCHEMA | seed-audit-data | Live insert used `amount_minor` / `expense_date` (nonexistent columns) | resolved | 2026-09-03 — `total_minor` + `title` + `unit_cost_minor` |
| SHOT-VITE-ENV | screenshot harness | `VITE_AUDIT_*` credential fallback | resolved | 2026-09-03 — `AUDIT_EMAIL` / `AUDIT_PASSWORD` only |

## Still open (ops / config — not product gaps)

| ID | Item | Why open |
|----|------|----------|
| OPS-E2E | Browser smoke TL → POS → EoS → Finance accept → owner SMS → SA payroll | Named in NEW-REVISIONS; needs live env |
| OWNER-SMS-ENV | `OWNER_SMS_PHONE` set for daily close SMS | Code LIVE; confirm env on Vercel |
| CHEM-RECON | Sunday recon BA → SA approve | Floor chemical bars need real recon rows |
| VERCEL-SMS-IP | BrandTxt whitelist for Vercel static egress | Office IP works; production SMS needs Pro static IPs |

## How to mark a revision done

1. Fix in product (smallest vertical slice).
2. Add/adjust a seam test under `tests/*Audit.test.js` or existing suite.
3. Re-screenshot the page: `node scripts/screenshot-audit.mjs` (scoped path if needed).
4. Set Status = `resolved` and Commit SHA in Resolved-in.
