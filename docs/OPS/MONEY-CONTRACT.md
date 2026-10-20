# Hakum Operations & Finance — Money Contract

> **Rewritten for the Daily Sheet (2026-10-06).** End of shift, Finance accept and floor payroll were retired on 2026-10-01. The Branch Admin submits one Daily Sheet per branch per day; SA / ASA approval posts its expenses and salaries once as paid `expenses`. "Paid POS is the income truth" still holds. Operating guide: [docs/daily-sheet/README.md](../daily-sheet/README.md). Decision IDs are kept so older references still resolve; retired ones are marked **Retired**.

**Locked:** 2026-08-23 · **Rewritten:** 2026-10-06  
**Source:** Owner questionnaire + principal fullstack decisions  
**Status:** Binding for POS, Daily Sheet, Finance product copy and behavior

---

## Product triangle (Daily Sheet era)

| System | Owns | Does not own |
|--------|------|--------------|
| **POS** | Paid tickets (all methods), merch, **Daily Sheet** fill-in and submit | Approving books, rewriting history |
| **Finance** | Approve / return / reopen Daily Sheets, P&L from **paid POS + posted expenses** | Changing sales totals, inventing income |
| **Daily Sheet pay** | Suggested crew pay + BA overrides (reason required); posts on approve | Separate floor-payroll wizard (retired) |

```
Paid POS (services / packages / detailing / merch)
    → Daily Sheet (BA: expenses, pay, cash advances, float, counted cash)
    → SA / ASA approve  →  web push to BA + posted expenses / salaries
    → Finance P&L / Floor Board (paid POS truth)
```

---

## Locked answers (owner)

### Day money & report

| ID | Decision |
|----|----------|
| A1 | **Total sales** = every **paid POS** ticket that day (wash, packages, detailing, merch; cash / GCash / card). Not cash-advance repayments. Sales on the sheet fill in from paid POS and cannot be typed. |
| A2 | Queue App Sales = Car Wash Sales (same forever). |
| A3 | Merch only via POS merch tab. |
| A4 | Downpayments are full POS sales when taken (not typed-only). |
| A5 | Expense lines on a draft or submitted sheet count in the sheet's P&L totals; they reach the books only when the sheet is **approved**. Each expense picks **cash** or **GCash** (`paid_from`). Only **cash** expenses reduce expected drawer cash; GCash expenses do not. |

### Cash advances

| ID | Decision |
|----|----------|
| B1 | Cash advances are **not costs**. A *Given out* line (`ca_release`) lowers expected cash; it never changes total expenses or profit. |
| B2 | A *Paid back* line (`ca_repay`) raises expected cash, **not** total sales. One line per person. |
| B3 | Crew request an advance in **Planner → Forms → Cash advance**. Super Admin or Assistant Super Admin approves it and a code is minted. The sheet chip appears only after that. *Given out* is saved only when the Branch Admin types that code and the amount matches. |
| B4 | **Retired** — payroll-wizard CA deduct. Advances and repayments are sheet lines only; there is no auto-deduct from pay. |
| B5 | Prefer settling a prior advance before a new one (BA judgement; not enforced). |

### Crew pay on the sheet

| ID | Decision |
|----|----------|
| C1 | Suggested wash pay = car wash sales × wash pool %, split by attendance weight. Detailing splits (ceramic crew + assigned detailer) are their own lines, not extra wash pay. |
| C2 / I2 | **One pay path.** The salary lines on the approved Daily Sheet are the pay record. There is no second floor-payroll confirm. |
| C3 | Every person who clocked in gets a salary row with a suggested amount from **Settings → Daily sheet rules** (`compensation_settings`). Team Leads get their daily rate (`staff_profiles.daily_rate_minor`). |
| C4 | The Branch Admin may change a suggested amount; each change needs a reason, and Submit stays locked until every changed row has one. The approver sees suggested vs entered and the reason. |
| C5 | Optional nullable `salary_pct` on catalog services / packages may adjust the **suggestion** only. Never auto-pay from catalog %. |
| Detailing | Every detailing job can produce **manual ceramic / detailing expense** output (existing ceramic keys). |
| C6 | Only Super Admin or an ASA with `finance_write` can set a daily rate (trigger `staff_profiles_guard_daily_rate`) or edit Daily sheet rules. |

### Sheet ↔ approval

| ID | Decision |
|----|----------|
| D1 | Submit → web push to SA / ASA (`sheet_submitted`). Approve or return → web push to the submitting BA (`sheet_reviewed`). Crew are paid only after **approve**. |
| D2 | **Retired** — "close attested ₱ vs POS proof ₱" on pending floor. The sheet itself shows paid POS sales next to the drawer count. |
| D3 | **Retired** — `pending_floor_optional` gate. Nothing can be paid before approval, so there is no separate gate. |
| D4 | Submit is allowed once every section is complete (expenses, pay, advances, drawer); the missing list under the button says what is left. |
| E1 | Wash pool = paid wash-eligible sales × pool % × attendance weight. |
| E2 | Wash pool = **bay crew** (`staff`) with attendance weight > 0. Detailer, Team Lead, admin, sales, marketing excluded from the pool. A BA shares only if clocked as bay crew. |
| E3 | Ceramic / detailing from ceramic expense keys on paid detailing. |
| E4 | **Retired** — accumulate-days payroll runs. Each day's pay is on that day's sheet. |
| G4 | One sheet per branch per day; SA switches branch. |
| G5 | **Retired** — separate floor / fixed wizards. Monthly salaries (office, Branch Admins) are **Bills** in Finance under account 14. |
| I1 | Pay is released the same day once the sheet is approved, not automatically. |
| I3 | The sheet is ops + owner glance; Finance P&L still keys off **paid POS**, not sheet overrides. |

---

## Principal decisions (where owner deferred)

| ID | Choice | Why |
|----|--------|-----|
| F1 | Approve = attestation + post expense and salary lines once as paid `expenses`. Approving again posts nothing new. Never rewrites sales. | Trust boundary stays on RPCs (`review_daily_sheet`). |
| F5 | **Reopen** (`reopen_daily_sheet`) is Super Admin only. It voids the sheet's posted lines and sets it to *Returned* so the BA can fix and resubmit. | A wrong attestation can be replaced without double-posting. |
| F2 | P&L income = **paid POS sales only**. Expenses on books = **paid / posted** rows (`finance_daily_pl`). | Sheet overrides are drawer stories, not invented revenue. `approved` unpaid bills are pending, not P&L. |
| F3 | Drafts allowed on the sheet; nothing posts until approve. | Matches A5 and BA speed. |
| F4 | **Retired** — "Floor coverage" column. Sheet status (Draft / Submitted / Approved / Returned) replaces it. | |
| G1 | BA = merch + Pay queue + Daily Sheet. | Less wrong tickets; SA / ASA for walk-in bay / detailing. |
| G2 | Daily Sheet submit: BA (own branches) + SA / ASA. Team Lead denied. | |
| G3 | Approve / return: SA + ASA with `finance_view` only. Branch Admin never approves a sheet. | Mirrors SQL `daily_sheet_can_review()` (migration `20261001090000_daily_sheet.sql`) and `src/lib/dailySheet.js` `canReviewDailySheet`. |

### Who may do what

| Who | May do | Must not |
|-----|--------|----------|
| **Branch Admin** | Fill in and submit the sheet for own branches; change suggested pay with a reason; record advances | Approve a sheet; set daily rates; invent sales |
| **SA / ASA (`finance_view`)** | Approve or return sheets | Approve without reviewing; edit paid POS totals |
| **SA / ASA (`finance_write`)** | Edit Daily sheet rules and set daily rates (C6) | Approve a sheet (that grant is `finance_view`) |
| **Super Admin only** | Reopen an **approved** sheet (voids its posted lines) | — |

---

## Drawer formula (locked)

Sir’s sheet (`FOrmulas.md`, written up in [docs/daily-sheet/FORMULAS.md](../daily-sheet/FORMULAS.md)):

```
cash_left   = pos_cash + ca_repaid_cash − expenses_cash − salaries_cash − ca_released_cash
gcash_left  = pos_gcash + ca_repaid_gcash − expenses_gcash − salaries_gcash − ca_released_gcash
expected_cash = opening_float + cash_left
over_short    = counted_cash − expected_cash
total_expenses = daily_expenses + salaries        (cash advances excluded)
net_profit    = net_sales − total_expenses
```

- Credit card, debit card, and bank transfer are in total sales and in the payment rows. They are not in cash left or GCash left.
- A salary or cash-advance line with Paid from GCash moves that channel, not the till.
- When every salary and cash advance is cash (the old default), expected cash matches the previous float formula.
- Source: `src/lib/sheetFormulas.js` via `computeSheetTotals`. Server twin `daily_sheet_server_totals` is applied on `lybxhpzzqqyqswvuwpxv` (20 Oct 2026).

---

## Honesty flags

| Setting | Contract |
|---------|----------|
| `pending_floor_optional` | **Retired** — no floor-payroll gate exists |
| `cash_advance_auto_deduct` | **Retired** — advances are sheet lines; nothing deducts from pay automatically |

---

## Data distribution (principal)

| Fact | Source of truth | Consumers |
|------|-----------------|-----------|
| Paid ticket ₱ | `sales` + `sale_line_items` (branch-scoped) | POS Today, Daily Sheet money in, Finance P&L, Floor Board |
| Day story | `daily_sheets` (one row / branch / day) + `daily_sheet_lines` (`expense`, `salary`, `ca_release`, `ca_repay`) | POS → Daily sheet, Finance → Daily sheets |
| Posted cost | `expenses` (status `paid`, keyed per sheet line on approve) + Finance Bills | P&L (`finance_daily_pl`) |
| Pay suggestion | `compensation_settings` + `staff_attendance` + `staff_profiles.daily_rate_minor` | Sheet salary rows |
| CA request | `ops_form_submissions` (cash_advance) | Sheet chip → `ca_release` line |
| Legacy history | `shift_close_reports`, `payroll_runs` (read-only, locked) | Finance → More → Old shift closes |

**Branch rule:** every money read/write filters by branch (or SA "all" via scope list). One sheet per branch per day.

**Notify path:** Daily Sheet submit / approve → client calls `/api/notify-ops-event` (`sheet_submitted` → SA / ASA, `sheet_reviewed` → the submitting BA) → inbox + web push. No owner SMS. Nothing auto-pays.

---

## Related docs

- [docs/daily-sheet/README.md](../daily-sheet/README.md) — operating guide, formulas, verification
- [docs/qa/SHOP-DAY-RUNBOOK.md](../qa/SHOP-DAY-RUNBOOK.md) — one Manila day, step by step
- Archive only (retired path): [docs/POS/](../POS/README.md) · [docs/PAYROLL/](../PAYROLL/README.md)
