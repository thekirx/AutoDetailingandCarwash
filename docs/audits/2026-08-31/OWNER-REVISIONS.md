# Owner revisions tracker — audit 2026-08-31

Source checklists: [`docs/OPS/NEW-REVISIONS-CHECKLIST.md`](../OPS/NEW-REVISIONS-CHECKLIST.md), [`docs/OPS/MONEY-CONTRACT.md`](../OPS/MONEY-CONTRACT.md).

Status values: `open` · `resolved` · `wontfix` · `partial`

| ID | Page / area | Comment | Status | Resolved-in |
|----|-------------|---------|--------|-------------|
| Q1–Q8 | Queue / TL | Owner queue asks (accept, search, statuses, QA, FIFO, POS handoff) | resolved | prior / NEW-REVISIONS LIVE |
| D1–D9 | Detailing board | Tint/coating/PPF pipeline, photos, calendar | resolved | prior / NEW-REVISIONS LIVE |
| P1–P11 | POS | Handoff lock, methods, inventory deduct, owner SMS after accept | resolved | prior (P6 accepted partial) |
| P6 | POS creator ACL | Counter-sale lines not ACL’d per creator | wontfix | single-BA lounge; see NEW-REVISIONS |
| F1–F11 | Finance | P&L, vendors, quotes, corporate, reports, overview charts + **exports** | resolved | this audit (Overview CSV/Excel/PDF) |
| S1–S5 | Salary / CA | BA draft ≠ BA confirm; CA ≠ sales | resolved | money contract hybrid |
| E1–E3 | Attendance / My Pay | Geo clock, late weight, My Pay | resolved | attendance Geo + compensation |
| ATT-LATE | Attendance / Payroll | Late pay must use Manila wall clock + per-branch hours | resolved | `c23cb0f` + this audit |
| SMS-OFF | CRM SMS | Keep shop SMS off until whitelist intentional | resolved | shop gate off |
| FIN-OWNER | Finance Overview | Owner needs clear P&L + expenses + branch sales + export | resolved | Overview charts + export strip |
| UX-SHOTS | All pages | Take pictures for judging / revising | resolved | 80 PNGs re-captured after auth fix |
| SEED-LIVE | Data | Full live insert of 60+ sales optional | open | fixture dry-run complete; expand live seed if ops want DB population |
| VIS-REVIEW | Screenshots | Human visual pass on desktop/mobile PNGs | resolved | this session — findings below |

## Residuals noted during codebase map (not in this audit’s build scope)

| ID | Page / area | Comment | Status | Resolved-in |
|----|-------------|---------|--------|-------------|
| FB-PL | Floor board (`/operations/dashboard`) | Revenue + payment mix only — no expenses, net profit, or margin tiles; owner must open Finance | resolved | expense_minor + net_minor tiles |
| AC-PROFIT | Admin Console | `profitMinor` computed in `adminApi` but not rendered — only “Today revenue” shown | resolved | Sample revenue/expenses/profit cards |
| FB-CHEM | Floor board chemical usage | Stub until Sunday recon data exists | resolved | intentional empty state (copy clarified) — not a bug |
| KPI-CHART | KPI page | Tables/stat tiles only — no Recharts trend charts | wontfix | Finance Overview already owns owner charts; avoid duplicate chart surface |

## New findings from this audit (visual + harness)

| ID | Page | Comment | Status | Resolved-in |
|----|------|---------|--------|-------------|
| SHOT-AUTH | screenshot harness | `url.includes('/operations')` treated `/operations/login` as authed — all ops PNGs were login wall | resolved | `isOpsAuthedUrl` + cookie dismiss + login-wall fail in shot() |
| AC-PULSE | Admin Console | “Period profit” beside “Today revenue” with ₱0 today / ₱6k profit — sample window mislabeled | resolved | Sample revenue card + Sample labels; expenses = paid/posted |
| TAB-MOBILE | Ops tabs | Mobile tab labels truncated / crammed (`flex-1`) | resolved | `overflow-x-auto` + `shrink-0` on OpsTabList; shorter console labels |
| FIN-VS-CONSOLE | Books pulse | Console ≠ Finance month window by design (recent rows vs reporting period) | resolved | Footnote states not Finance window |

## How to mark a revision done

1. Fix in product (smallest vertical slice).
2. Add/adjust a seam test under `tests/*Audit.test.js` or existing suite.
3. Re-screenshot the page: `node scripts/screenshot-audit.mjs` (scoped path if needed).
4. Set Status = `resolved` and Commit SHA in Resolved-in.
