# Payroll deep audit — principal full-stack + frontend

Date: 2026-09-14 · Scope: `/operations/payroll` (and Settings → Payroll, My Pay) as Super Admin; ASA / denials / crew My Pay in the same harness.
Evidence: `e2e-evidence/payroll-deep/*.png`, `*.inventory.json`, `log.json`.
Reproduce: `DEV_PORT=5293 node scripts/_payroll-deep-shots.mjs` (Boss this session, exit 0, 339s). ASA + denials: `WHO=asa DEV_PORT=5294` (same script).

**Implementation stamp (same day):** P0/P1 leftovers shipped — merch out of wash base, theoretical vs allocated pool, pesos editors, range + % clamp, Inventory/`salary_pct` honesty, Settings ACL = `canRunPayroll`, load-error toasts, 2099 close drop, guide closed, Advances tab label. Residual (not this wave): `run_payroll` still stores client `amount_minor`; pending-floor gate is client-only; hybrid/custom salary kinds are labels; no merch commission type; brand pass deferred.

Hakum pays **commissions + optional monthly salary + optional cash-advance deducts**. There is **no tax, SSS, PhilHealth, Pag-IBIG, withholding, or payslip engine** in `src/` or `run_payroll`. The only “tax” string in the app is legal-privacy copy.

## Verdict

**The pay engine matches a carwash/detailing shop. The Payroll UI does not.** Floor pay is a real POS-proofed register; ceramic splits are real; fixed salary + typed commission are real. What the owner sees today is a generic shadcn admin with six tabs, a novel open on the home tab, three places to edit the same singleton, and a live window that shows **₱2,850 wash sales and ₱0 wash pool** without saying “nobody clocked in.” It is not premium, not fully owner-customizable, and not validated like money software.

Strict score (10 = shop owner can run payday alone on a phone): **Purpose fit 6 · Commission honesty 4 · Validation 4 · Redundancy 5 · Owner customizability 4 · Mobile 3 · Brand/premium 3.**

## What Payroll is for here (purpose)

Hakum’s register has four jobs, in this order:

1. **Pay bay crew from days they actually worked** — wash-pool % of **paid wash POS**, split by attendance; ceramic/detailing % off those jobs.
2. **Pay office / BA / marketing a monthly package**, prorated, plus typed commission/bonus (not a catalog %).
3. **Approve cash advances** so EoS cash-left is honest; deduct later by hand on the wizard.
4. **Let the owner change the % rules** that POS ceramic drafts and floor preview both read.

Everything else (Dashboard guide, Recent payouts card, Settings → Payroll split, Crew late-pay presets, Inventory `salary_pct`) is either a second door or a lie.

**End of shift does not pay anyone.** POS attests. Finance accepts. Payroll posts. Training that “close = crew paid” is false.

## What POS is for (same money triangle)

POS is the **cash drawer**, not the payroll office:

1. Take payment for a floor handoff (Pay queue).
2. Ring walk-in merch / add-on / detailing.
3. Log petty-cash drafts.
4. Close the shift so Finance can accept a day.

POS must **not** run payroll, approve cash advances, or invent tax. Ceramic drafts at checkout (`buildCeramicCompensationExpenses`) are a **side effect for later payroll**, not a payout. That contract is correct. The failure is downstream: merch can inflate the wash base, and ceramic drafts only insert when `canWriteFinance` (SA / ASA write / BA) — a cashier-less BA path is fine; a future role that can sell detailing without finance write would silently skip crew/detailer drafts.

## Commission model (strict)

There is **no single “commission %.”** Four pipes share one confirm button.

| Pipe | Trigger | Formula | Who gets it | Owner knob |
|------|---------|---------|-------------|------------|
| **Wash pool** | Paid sale lines that `isWashEligibleLine` | `sum × wash_pool_pct` (default **35%**) | Bay **crew only** (not TL, detailer, admin, sales, marketing) | Rules `wash_pool_pct`; per-run override `#payroll-pct` |
| **Attendance weight** | Clock / status that day | remaining shift / scheduled, else present=1, late=`attendance_late_weight` (0.7) | Same roster | Settings → Payroll **or** Crew late-pay **presets** (third UI) |
| **SKU `salary_pct`** | Catalog field on a service | % of **that line**, then same wash split | Same bay roster | Inventory “Salary %” — copy says **preview only**; `buildPayrollPreview` **pays it** |
| **Ceramic / detailing** | POS inserts `detailing:{saleId}:crew\|detailer` drafts | After optional shirt (₱500 = 50_000 centavos) and card fee (3.5%), crew solo **20%** or crew+detailer **10%+10%** | Day’s crew; detailer if assigned | Rules ceramic %; POS toggles shirt/card/crew/detailer |
| **Manual add/deduct** | Floor wizard “Add line” | Typed pesos | Anyone on the staff roster | None — free text |
| **Fixed + typed commission** | Fixed wizard | Monthly package prorated + `addPayrollCommission` | Salaried people | Salaries tab kinds `fixed` / `hybrid` / `custom` — **hybrid/custom are labels only** |

**Not in the model (and must stay out):** tax, 13th month, overtime law, per-ticket sales commission for a Sales role, merch-specific %, PPF film (explicitly excluded from ceramic).

### Live proof this session (Boss, 2026-08-08 tickets)

`boss-desktop-floor-proof.png` / log: **Wash sales ₱2,850 · wash pool ₱0 · 2 tickets** (₱2,500 + ₱350). Pool at 35% would be **₱997.50** if anyone had weight. `splitWashPool` with empty weight-sum writes **no lines**; the header then reports pool from **lines**, so the theoretical pool vanishes. Empty copy blames “attendance, packages, and POS proof” — POS proof is on the previous step. **The screen never says “0 crew present on those sale days.”**

Inverted dates (`end` = 2020-01-01, frequency still semimonthly): toast **“0 POS ticket(s)”**, not “end before start.” `validatePayrollCustomRange` runs **only when frequency === `custom`**.

### Merch can fund the wash pool

`isWashEligibleLine` only drops detailing/ceramic. Product lines have no `pay_category`. `loadProof` selects `sale_line_items(line_total_minor, services(pay_category, salary_pct))` — no `catalog_kind`. Coffee/clothing on a paid ticket **raises crew commission**. Header still says “Wash sales.”

### Server trust

`run_payroll` checks role, period, overlap, claimed sales. It **does not recompute** pool or ceramic from catalog. It stores client `amount_minor`. Same class of hole as pre-fix POS prices — acceptable as an owner override **only if** the UI amounts are pesos the owner understands. Wizard line editors bind `value={row.pay_minor}` (**centavos**).

### No tax (confirmed)

Grep of `src` + payroll RPC: no withholding columns, no BIR, no net-vs-gross. Deductions are **cash advance** and typed **deduct** lines only.

## Screenshots index (this session)

| Screen | File |
|---|---|
| SA Dashboard desktop / phone | `boss-desktop-home.png`, `boss-phone-home.png` |
| Run · Period | `boss-desktop-run.png`, `boss-phone-run.png` |
| Floor POS proof (₱2,850 / ₱0 pool) | `boss-desktop-floor-proof.png` |
| Floor payouts empty | `boss-desktop-floor-lines.png` |
| Floor confirm blocked | `boss-desktop-floor-confirm.png` |
| Fixed commissions (unlabelled) | `boss-desktop-fixed-extras.png` |
| Cash advances empty | `boss-desktop-cash-advance.png` |
| Salaries empty + unlabelled selects | `boss-desktop-packages.png` |
| Rules 35% / shirt 50000 centavos | `boss-desktop-rules.png` |
| Rules 150% / card −3 typed | `boss-desktop-rules-bad-values.png` |
| Settings → Payroll | `boss-settings-payroll.png` |
| SA → My Pay | access-denied (correct) |
| ASA Salaries (no create form) | `asa-desktop-packages.png` |
| ASA → My Pay | `/operations/my-pay` |
| Landing brand ref | `brand-landing-ref.png` |

Inventories (SA desktop): **7 buttons <44px** on every tab (ops tabs 36px + header bell 34px). Packages **4 unlabelled** inputs. Floor add-line **4 unlabelled**. Fixed commission **3 unlabelled**. `scrollX=false` on 1440; phone **clips the Cash advances tab to “Cast”.**

## P0 — money / commission integrity

### P0-1 Wash sales shown, pool ₱0, no attendance sentence
- Evidence: `boss-desktop-floor-proof.png`, `boss-desktop-floor-lines.png`.
- Engine: no weight-sum → zero lines → `pool_minor` from lines = 0.
- Owner will believe the 35% rule is broken.

### P0-2 Merch / non-wash lines can enter the wash base
- `compensation.js:478-513` + `PayrollPage.jsx` loadProof select.
- “Wash sales” on POS proof is a **lie** if the ticket mixed products.

### P0-3 `run_payroll` trusts client line amounts; UI edits are centavos
- `buildRunPayrollPayload` → `amount_minor: row.pay_minor`.
- Salary/payout `<Input value={salaryLine.pay_minor}>` (`PayrollPage.jsx` ~939, ~1113).
- A “30000” typed thinking pesos is ₱300.00 if they ever switch the field to pesos without a scale — today the field **is already minor**, so a peso-thinking owner who types 500 overwrites ₱5.00 of pay.

## P1 — broken, dishonest, or unusable today

### P1-1 Date range not validated unless frequency is Custom
- `loadProof`: `validatePayrollCustomRange` gated on `frequency === 'custom'`.
- Probe: end 2020-01-01 → success toast with 0 tickets.

### P1-2 Wash pool % accepts 150; card fee −3 is only HTML-blocked
- Run `#payroll-pct` has `max=100`; `rebuildWashPoolLines` does **not** clamp.
- Rules `wash_pool_pct` has **no max** — probe `pctValid: true` at 150. Card fee `min=0` so −3 fails native validity; **Save is still clickable**; JS state already holds −3.
- Shirt field labeled **centavos** (50000). Owner-hostile.

### P1-3 Inventory `salary_pct` copy vs engine
- `ServicesManagePage.jsx:389` “Preview only — does not auto-pay.”
- `salaryPctPoolMinor` **does** create `wash_pool` lines on confirm.

### P1-4b Demo ASA is view-only on the register, write-capable on Settings
- Seed ASA has `finance_write: false` → no Save salary, no Add commission (`asa-desktop-packages.png`, phone “no button”).
- Same user still hits `/operations/my-pay` and Settings → Payroll (`isAdmin`). Split-brain: cannot post pay, can change late-weight policy.

### P1-4 Settings brain-split (not “fully customizable”)
| Surface | What it edits | Who can write |
|---------|----------------|---------------|
| Payroll → Rules | Pool + ceramic + frequency | `canRunPayroll` (SA / ASA `finance_write`) |
| Settings → Payroll | Late/present weights, pending-floor checkbox | `isAdmin` (**any ASA**, even view-only) |
| Crew → pay rules | Late-pay **presets** (100/70/50/0) | `isAdmin` |
| Inventory | Per-SKU `salary_pct` | catalog editors |

`payout_weekday` is labeled reminder-only (honest). Hybrid/custom salary kinds do not change math. Owner cannot add a payment-style commission (e.g. “Sales gets 5% of merch”). Cannot add a role to the wash roster without a code change.

### P1-5 Phone: Cash advances tab clipped; six tabs + open guide
- `boss-phone-home.png` / `boss-phone-run.png`: third tab reads **“Cast”**. Same class of bug as POS Sell clip (`justify` / overflow).
- Guide `defaultOpen={tab === 'home'}` eats the fold. Pending card shows **2099-01-01** (junk close) as a “ready” day with POS proof “loading…”.

### P1-6 Confirm is honest; empty states are not
- Confirm disabled + “Nothing to pay” — good.
- Add line without label → toast “Label is required” — good, **toast-only**, not inline (`ui-ux-pro-max` Error Placement).
- Commission empty → toast — same.
- Salary empty submit → toast — same. Employee/branch/kind selects have **placeholder-only labels**.

### P1-7 RPC does not re-price from POS
- Residual Medium if you treat SA as trusted; High if an ASA token is stolen. Same pattern as old `complete_pos_sale`.
- Pending-floor hard gate is **client-only** (`floorConfirmBlockedByPendingCloses` in `confirmRun`). `run_payroll` never sees `pending_floor_optional`.

### P1-8 Copy says “unpaid POS”; query is paid-and-unclaimed
- `PayrollPage.jsx:848` “unpaid POS tickets”; `:893` “No unpaid POS wash tickets.”
- `loadProof` filters `sales.status = 'paid'` minus `payroll_run_sales`. Those tickets are **already paid at the drawer**, not unpaid.
- Toast after confirm: “Payroll posted” (`:557`) — run is `confirmed`, expenses marked `paid`. No cash/bank disbursement.

### P1-9 Swallowed load errors
- Pending closes: `if (!error) setPendingCloses` — fail stays empty, no toast.
- Home packages/staff: `if (!pkg.error)` / `if (!staff.error)` — silent.
- POS proof for the pending queue: sales fail → `pos_proof_known` stays false → **“POS proof · loading…”** forever (`boss-desktop-home.png` on the 2099 row).

## P2 — redundancy and brand

- **Run floor pay** appears on: pending card, “Next scheduled window,” and the Run tab. Three doors. **Decided keep** — each door is a different moment (overdue close, next window, explicit Run).
- **Recent payouts** on Dashboard duplicates **Payouts** tab. **Decided keep** dashboard summary; Payouts stays the register.
- Guide step 4 / “Also on Settings” — **Done** in leftovers: Settings ACL = `canRunPayroll`; guide closed.
- History is a list with no drill-in, no reprint, no void. **Decided keep RO** — do not invent reprint/void.
- Visual vs landing: **Deferred** brand pass.

## Web Interface Guidelines (terse)

## src/pages/PayrollPage.jsx

- `PayrollPage.jsx:1362-1382` — Employee / branch / kind: placeholder-only, no `<Label>`
- `PayrollPage.jsx:1395-1399` — Notes: placeholder-only
- `PayrollPage.jsx:991-1012` — Commission employee/label/amount: placeholder-only
- `PayrollPage.jsx:1135-1164` — Add/deduct: placeholder-only
- `PayrollPage.jsx:939` — salary amount bound to centavos, `type=number`, no `inputmode`
- `PayrollPage.jsx:1084-1095` — wash % `max=100` not enforced in `rebuildWashPoolLines`
- `PayrollPage.jsx:848` / `:893` — “unpaid POS” vs `status=paid` unclaimed
- `PayrollPage.jsx:557` — “Payroll posted” ≠ cash handed
- `PayrollPage.jsx:262` — pending-close error swallowed
- `PayrollPage.jsx:356-361` — inverted range allowed when freq ≠ custom
- `PayrollPage.jsx:1489-1496` — rules % no `max`; shirt in centavos
- `PayrollPage.jsx:586-591` — guide default open on home (overwhelm)
- `PayrollPage.jsx:2092` N/A — ops tabs 36px (`<44`)

## src/pages/settings/PayrollSettingsPage.jsx

- `PayrollSettingsPage.jsx:22` — `canWrite = isAdmin` ≠ `canRunPayroll`
- `PayrollSettingsPage.jsx:120` — copy “Only Super Admin can edit” is false for ASA

## src/pages/ServicesManagePage.jsx

- `ServicesManagePage.jsx:389` — “does not auto-pay” contradicts `salaryPctPoolMinor`

## src/components/PayrollCashAdvancesPanel.jsx

- Approve/decline are real; deduct is **not** on this tab (owner must remember the wizard). Easy to think approve = netted.

## Does it do the job?

| Job | Does it? |
|-----|----------|
| Pay crew from paid wash + attendance | **Yes, if they clocked in.** Silent ₱0 if not. |
| Pay detailing crew/detailer | **Yes, if POS wrote drafts** and sale still unclaimed. |
| Exclude tax | **Yes.** |
| Pay office salary + ad-hoc commission | **Yes, after Salaries are saved.** Demo has **zero** packages. |
| Stop double-pay of the same POS ticket | **Yes** (`payroll_run_sales`). |
| Owner sets % without an engineer | **Partially** — five numbers on Rules; late pay elsewhere; no new commission types. |
| Phone payday | **No** — clipped tab, open guide, 36px tabs, centavos fields. |
| Look like Hakum | **No.** |

## If this were the backlog (order)

1. Prove wash base = wash/package lines only; show **theoretical pool** vs **allocated**; name missing attendance.
2. Validate every period (not only Custom); clamp % 0–100 server + client; pesos everywhere; shirt in ₱.
3. One settings surface; kill hybrid-as-label or make it real; fix Inventory `salary_pct` copy or stop paying it.
4. Phone: ≤5 tabs, `justify-start`, guide closed.
5. Then a brand pass (navy field, condensed wordmark, not a new palette file).
6. Optional later: RPC recompute; merch commission type; receipt/void. Still no tax.

## Not tested this session

- Confirming a run (non-destructive; Confirm stayed disabled on ₱0).
- A day with clocked crew + wash tickets (the Aug 8 tickets had no payout lines).
- Ceramic draft on a live detailing sale.
- Fresh deny/My Pay remount this hour — `DENY_ONLY=1` died (`Protocol error`). On-disk: `admin-payroll-route.png` (Lane closed), `crew1-desktop-my-pay.png` (₱0 confirmed + unpaid estimate).
