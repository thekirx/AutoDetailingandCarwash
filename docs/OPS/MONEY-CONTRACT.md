# Hakum Operations & Finance — Money Contract

**Locked:** 2026-08-23  
**Source:** Owner questionnaire + principal fullstack decisions  
**Status:** Binding for POS, Payroll, Finance product copy and behavior

---

## Product triangle

| System | Owns | Does not own |
|--------|------|--------------|
| **POS** | Paid tickets (all methods), merch, day expenses, CA repayments, End of shift attestation, Bacoor-style report | Paying crew, rewriting history |
| **Finance** | Accept/reject/lock close, P&L from **paid POS + expenses**, shift review | Changing sales totals, auto-running payroll |
| **Payroll** | Floor pay from **paid POS proof + attendance + ceramic keys**; fixed packages; **manual** CA deduct | Inventing pay from close attestation ₱ |

```
Paid POS (services / packages / detailing / merch)
    → Bacoor report + EoS (drawer attestation)
    → Finance accept  →  notify SA/ASA + Pending floor (hard gate)
    → SA/ASA confirms floor payroll (same night preferred)
```

---

## Locked answers (owner)

### Day money & report

| ID | Decision |
|----|----------|
| A1 | **Total sales** = every **paid POS** ticket that day (wash, packages, detailing, merch; cash/GCash/card). Not CA repayments. |
| A2 | Queue App Sales = Car Wash Sales (same forever). |
| A3 | Merch only via POS merch tab. |
| A4 | Downpayments are full POS sales when taken (not typed-only). |
| A5 | Draft day expenses **count** in Total expenses and cash left. |

### Cash advances

| ID | Decision |
|----|----------|
| B1 | Approved CA **reduces cash left** and rolls into Total expenses (cash out of drawer). |
| B2 | CA Collected / repayments **add to cash left**, **not** to Total sales. Per-person lines. |
| B3 | Enter repayments as POS **CA repayment** expense kind (per crew). |
| B4 | Payroll CA deduct = **manual in wizard only** (no auto-deduct). |
| B5 | Prefer settle prior CA before new CA; payroll CA always manual. |

### Salary on report vs floor pay

| ID | Decision |
|----|----------|
| C1 | Report **carwash salary cell** = wash-pool preview only. Detailing splits (ceramic crew + assigned detailer) stay on payroll lines / detailer salary — not extra carwash salary. |
| C2 / I2 | **Principal:** One pay path. Floor confirm is official pay. Report salary = **preview** of that path. BA `salary_*` expenses = **drawer cash-out** of that day — do not treat as a second wash-pool. Same night: Finance accept → SA/ASA confirm floor. |
| C3 | System fills salary lines from preview; BA may still log drawer cash-out expenses. |
| C4 | **BA salary draft (hybrid):** Branch Admin may edit extra pay / deductions on End of Shift as **draft notes** on `shift_close_reports.submitted` (e.g. `salary_draft_extras`). Those notes **surface on the SA/ASA payroll wizard** — they never post `payroll_runs`. BA **cannot** call `run_payroll`. |
| C5 | Optional nullable `salary_pct` on catalog services/packages may adjust floor **preview** only. Default remains global wash pool + ceramic splits. Never auto-pay from catalog %. |
| Detailing | Every detailing job can produce **manual ceramic/detailing expense** output (existing ceramic keys). |

### End of shift ↔ Payroll

| ID | Decision |
|----|----------|
| D1 | After Finance **accept**: in-app (+ push when subscribed) to SA/ASA → they **confirm** on Payroll (not auto-pay). |
| D2 | Pending floor shows **close attested ₱** and **POS proof ₱** side by side. |
| D3 | `pending_floor_optional = false` → **hard block** floor confirm until closes for those days are accepted/locked. |
| D4 | EoS required only if there were sales, expenses, or CA activity that day. |
| E1 | Floor = paid wash-eligible × wash pool % × attendance. |
| E2 | Wash pool = **bay crew** (`staff`) with attendance weight > 0. Detailer, team lead, admin, sales, marketing excluded. BA shares only if clocked as bay crew. |
| E3 | Ceramic/detailing from ceramic expense keys on paid detailing. |
| E4 | Daily **or** accumulate accepted days — both supported. |
| G4 | One close per branch per day; SA switches branch. |
| G5 | Floor and fixed stay separate wizards. |
| I1 | Target: **same night** after Finance accept (SA/ASA confirm), not auto. |
| I3 | Report is ops + owner glance; Finance P&L still keys off **paid POS**, not override fiction. |

---

## Principal decisions (where owner deferred)

| ID | Choice | Why |
|----|--------|-----|
| F1 | Accept = attestation + unlock pending + notify. Not rewrite sales. Not auto-pay. | Trust boundary stays on RPCs; SA must confirm pay. |
| F2 | P&L income = **paid POS sales only**. | Overrides on close are drawer stories, not inventing revenue. |
| F3 | Drafts allowed on close; Finance marks paid later. | Matches A5 and BA speed. |
| F4 | Column = **Floor coverage** (posted / pending / awaiting review). | Stops “close ₱ was paid” misread. |
| G1 | BA = merch + Pay queue + expenses + EoS. | Less wrong tickets; SA/ASA for walk-in bay/detailing. |
| G2 | EoS: BA + SA/ASA (existing `canSubmitShiftClose`). | |
| G3 | Floor confirm: SA + ASA `finance_write` only. Branch Admin never confirms floor or fixed payroll. |

### BA draft vs SA confirm (owner revisions 2026-08-27)

| Who | May do | Must not |
|-----|--------|----------|
| **Branch Admin** | Run EoS; edit salary **preview** cells and draft extras; see estimate on Crew | Open Payroll register; call `run_payroll`; invent sales |
| **SA / ASA (`finance_write`)** | Accept close; confirm floor/fixed; apply draft extras as wizard lines | Auto-pay without confirm |
| **Finance accept** | Unlock pending floor | Rewrite paid POS totals |

---

## Report cash-left formula (locked)

```
cash_left = cash_sales − total_expenses + ca_collected
```

- `total_expenses` includes approved CA out + day expenses (incl. drafts) + salary_* cash-outs  
- `ca_collected` includes CA repayment lines (not sales)  
- GCash/card are in Total sales but not in cash_left numerator  

---

## Honesty flags

| Setting | Contract |
|---------|----------|
| `pending_floor_optional` | **false** = hard gate (default going forward) |
| `cash_advance_auto_deduct` | **Ignored** — UI forces off; deduct only via payroll wizard |

---

## Data distribution (principal)

| Fact | Source of truth | Consumers |
|------|-----------------|-----------|
| Paid ticket ₱ | `sales` + `sale_line_items` (branch-scoped) | POS report, Finance P&L, floor proof, pending dual ₱ |
| Drawer day story | `shift_close_reports` (one row / branch / day) | Finance review; pending “close attested ₱” |
| Floor pay | `payroll_runs` (`run_kind=floor`) + lines from paid POS + `staff_attendance` | Payroll confirm, My Pay, Floor coverage |
| Fixed pay | `staff_pay_packages` → `payroll_runs` (`run_kind=fixed`); kinds `package_fixed` / `package_hybrid` | Fixed wizard, My Pay labels |
| CA out | `ops_form_submissions` (cash_advance, resolved) with **`payload.staff_id`** | EoS expenses/cash left; manual payroll deduct |
| CA in | `expenses.expense_kind = ca_repayment` | Cash left up; never sales |
| Day report + EoS baseline | `buildShopDaySettlementReport` (Bacoor + wash-pool preview + today’s attendance) | POS only — preview, not a second pay ledger |

**Branch rule:** every money read/write filters by branch (or SA “all” via scope list). One close per branch per day. Floor and fixed never share a run.

**Notify path:** Finance accept → RPC writes `user_notifications` (inbox) → client calls `/api/notify-shift-close` (web push). Neither path auto-pays.

---

## Related docs

- [docs/POS/](../POS/README.md) · [docs/PAYROLL/](../PAYROLL/README.md)
