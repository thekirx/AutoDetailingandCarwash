# Finance + Reports deep audit — principal full-stack + frontend (analysis only)

Date: 2026-09-14 · Scope: `/operations/finance` (11 tabs, including Reports) as Super Admin (BossMich) and ASA.
Evidence: `e2e-evidence/finance-deep/*.png`, `*.inventory.json`, `log.json`.
Reproduce: `DEV_PORT=5295 node scripts/_finance-deep-shots.mjs` (ASA this session, exit 0, 164s). Boss: `WHO=boss DEV_PORT=5295` (exit 0, 227s; leftover `WHO=asa` in the shell skipped Boss on the first pass).
**This prompt is analysis only. No product `src/` was changed.**

## Implementation — Prompt 11 — 2026-09-14

Listed P0/P1 shipped (no tax, no commission % editors on Finance):

| Item | Status |
|------|--------|
| P0-1 Default window + last-paid cue | **Done** — default `last_30`; cue + “Include that day” when latest paid POS is outside the window |
| P0-2 Reports mix windows | **Done** — `retentionInWindow` on `last_paid_at`; crew KPI labeled **current roster** |
| P0-3 Inverted custom range | **Done** — `validateFinanceCustomRange`; inline error; no inverted query |
| P1-1 Eleven tabs clip | **Done** — 5 primary tabs + More; all 11 ids still deep-link |
| P1-2 Guide | **Done** — `defaultOpen={false}` |
| P1-3 Filters in URL | **Done** — `period` / `from` / `to` / `branch` / `compare` preserved with `?tab=` |
| P1-4 Validation | **Done** — range error under From/To; expense-report `htmlFor`/`id` |
| P1-5 Vendors skeleton | **Done** — stable `onVendorsChange` + ref; error empty + retry |
| P1-8 ASA view-only | **Unchanged** — view-only; More reduces clip |
| P1-9 Unposted crew pay | **Done** — cue + Open Payroll; no-close cue + Open POS |
| Category copy | **Done** — P&L bucket, not commission % |
| P1-7 Export trios | **Done** — Dashboard keeps CSV/Excel/PDF; Sales/Bills/P&L/Reports are CSV only |
| P2 Payroll guide link | **Done** — handoff step `href` → `/operations/payroll` |
| P1-6 Quotes / Corporate as peers | **Decided** — stay under More; not merged into P&L |
| Bill title native required | **Decided** — keep HTML5 required (ops form pattern) |
| Brand / Xero clone | **Deferred** |

Seam tests: `tests/financeIntegrityFixes.test.js`. Soft-launch still **READY_WITH_OPS_BLOCKERS** (BUG-002/003).

Brand reference: `e2e-evidence/pos-deep/brand-landing-ref.png` (reused). Xero comparison is job-to-be-done and density, not a clone.

## Verdict

**The books engine is real. The Finance UI is a 11-tab admin that hides the live shop.** Paid POS income, paid/posted expenses, and shift-close attestation are wired. Default period **This month (1–30 Sep 2026)** shows **₱0 everywhere**. Switching to **Last month** reveals the only live window: **₱2,850 income · ₱0 expenses · 2 tickets · 2026-08-08 Bacoor cash**. Reports still list **lifetime customers** (Maria last paid **7/23**) inside an August header. Shift reviews for that same August window are **empty** — POS sold, nobody closed. Commission % is **not** here (correct); Categories still offers a **Payroll / salary** kind that looks like pay setup. It is not premium, not Xero-dense, not phone-ready, and not validated like money software.

Strict score (10 = owner can run the week’s books alone on a phone): **Purpose fit 6 · Commission honesty 4 · Validation 3 · Redundancy 4 · Owner customizability 5 · Mobile 3 · Brand/premium 3.**

## What Finance is for here (purpose)

Hakum’s books hub has four jobs, in this order:

1. **See if the shop made money** — paid POS income vs paid/posted expenses (`finance_daily_pl`) for a window the owner picked.
2. **Accept end-of-shift closes** so Payroll can confirm floor pay. Attestation does **not** rewrite sales.
3. **Record bills / petty cash / ASA expense reports** and move them through draft → paid/posted so they hit P&L.
4. **Export proof** (sales, closes, retention) for the same window.

Everything else (Quotations, Corporate HQ cash, Vendors as a peer tab, Dashboard CSV/Excel/PDF plus five more export trios, the open “How Finance works” novel) is a second door or chrome.

**Commission is not a Finance setting.** Wash pool %, ceramic splits, typed commission, and cash-advance approval live on **Payroll**. POS only drafts ceramic expenses and previews wash pool. Finance sees the **aftermath**: income, posted payroll-as-expense (when a run exists), and a “Open Payroll dashboard” link after an accepted close with no covering run.

## What POS is for (same money triangle)

POS is the **cash drawer**, not the books office:

1. Take payment for a floor handoff (Pay queue).
2. Ring walk-in merch / add-on / detailing.
3. Log petty-cash drafts.
4. Close the shift so Finance can accept a day.

POS must **not** approve cash advances, post payroll, or rewrite P&L. Ceramic drafts at checkout are a **side effect for later payroll**, not a payout. That contract is correct. The failure this session is downstream: **August 8 sold ₱2,850 and Shift reviews has 0 closes** — Finance cannot unlock floor pay because EoS never landed.

```
POS paid tickets + draft expenses + EoS
        → Finance (accept close, P&L, bills)
        → Payroll (confirm pay)
        → Finance again (posted salary expense)
```

## Commission model vs this page (strict)

There is still **no tax**. There is still **no single commission %** on Finance.

| Pipe | Where the owner actually sets it | What Finance shows |
|------|----------------------------------|--------------------|
| Wash pool 35% | Payroll → Rules | Nothing. P&L is 100% margin on ₱2,850 because **no payroll expense posted**. |
| Catalog `salary_pct` | Inventory | Nothing until a floor run confirms. |
| Ceramic / detailing splits | Payroll Rules + POS checkout drafts | Draft ceramic expenses **excluded** from P&L until paid/posted (`FinancePLTab` provenance). |
| Typed commission / CA | Payroll wizard / Advances | Reports shift attestation has a **CA collected** column (attestation, not approval). |
| Categories “Payroll / salary” | Finance → Categories | A **P&L bucket**, not a %. Looks like pay setup. 6 kinds live, including Payroll. |

Live proof (Boss, last month): Dashboard / P&L **₱2,850 · 0 expenses · 100% margin**. Owner watchlist talks cash mix and “2 paid tickets 2026-08-08”. It never says “crew share not posted yet.” Same ₱2,850 the Payroll audit called wash sales with **₱0 allocated pool** (no attendance). Finance and Payroll agree the tickets exist; neither screen tells the owner both stories at once.

## Screenshots index (this session)

92 PNGs · 54 inventories · `e2e-evidence/finance-deep/`.

| Screen | File |
|---|---|
| SA Dashboard default month (₱0) | `boss-desktop-overview.png`, `boss-phone-overview.png` |
| SA Dashboard last month (₱2,850) | `boss-desktop-overview-last-month.png` |
| SA Sales / P&L last month | `boss-desktop-sales-last-month.png`, `boss-desktop-pl-last-month.png` |
| SA Shift reviews last month (0 closes) | `boss-desktop-shift-close-last-month.png` |
| SA Reports last month | `boss-desktop-reports-last-month.png` + `*-reports-{best-sellers,shift-attestation,sales-report,operations,retention}.png` |
| SA Bills / Quotes / Categories / Vendors / Corporate / Expense reports | `boss-desktop-{purchases,quotes,categories,vendors,corporate,expense-reports}.png` |
| SA inverted custom range | `boss-desktop-inverted-range.png` |
| SA empty bill (native required) | `boss-desktop-bill-empty-submit.png` |
| ASA view-only Dashboard / phone | `asa-desktop-overview.png`, `asa-phone-overview.png`, `asa-phone-sales.png` |
| ASA Reports (Sep window + lifetime customers) | `asa-desktop-reports.png` |
| Legacy `/operations/reports` | `*-legacy-reports-redirect.png` → `?tab=reports` |
| Landing brand | `e2e-evidence/pos-deep/brand-landing-ref.png` |

Inventories (SA desktop overview): **10 buttons &lt;44px**. Phone overview: **16 &lt;44px**. Unlabelled inputs 0 on shell filters. Desktop 1440: tabs **Corporate / Categories / Reports clipped**. Phone 390: from **Bills & expenses** onward clipped (only Dashboard + Sales fully on-screen).

ASA badge **View only** (`finance_write` false). Boss badge **Can edit**. Guide **open** on Dashboard (`defaultOpen={tab === 'overview'}`).

## P0 — broken, dishonest, or money-wrong today

### P0-1 Default window looks like a dead shop

- Default preset `month` → 1–30 Sep 2026 → **₱0** on Dashboard, Sales, P&L, Bills, Shift reviews, Reports income.
- Last month (1–31 Aug) → **₱2,850 · 2 tickets · Bacoor · 100% cash**.
- Owner opening Finance today would believe September (and therefore “the business”) is empty. Empty copy says “Close a shift or post a bill” / “Open Sales” — it does **not** say “your last paid day is 2026-08-08; switch period.”
- Evidence: `boss-desktop-overview.png` vs `boss-desktop-overview-last-month.png`. `log.json` `net":"₱0"` vs `"₱2,850"`.

### P0-2 Reports mix windows

- Sales / P&L / best sellers / shift attestation honor `range`.
- `finance_customer_retention` is selected **with no date filter** (`FinanceReportsTab.jsx` ~105–113). ASA September Reports: income ₱0, **4 customers**, last paid **7/23, 8/6, 8/8**. Boss August Reports: income ₱2,850, **same 4 customers** including July.
- `crew_kpi_summary` count is **unwindowed** (~100–104). “Crew in KPI: 2” on both empty September and live August.
- Header still says “Window 1–30 Sep” / “1–31 Aug.” That is a lie for retention and crew.
- Evidence: `asa-desktop-reports.png`, `boss-desktop-reports-last-month.png`.

### P0-3 Inverted custom range is accepted

- Probe: Period = Custom, From `2026-09-01`, To `2020-01-01`, Refresh.
- Window label: **“Sep 1, 2026 – Jan 1, 2020”**. Net ₱0. **toasts=[]**. `financeRange()` returns the two strings as-is (`financeData.js:111–117`). Queries `gte start` + `lte end` return empty. No swap, no “end before start.”
- Evidence: `boss-desktop-inverted-range.png`, `asa-desktop-inverted-range.png`.

### P0-4 Sales without a close (workflow, not a missing button)

- August 8: 2 paid tickets, ₱2,850 cash. Shift reviews last month: **0 in window / 0 submitted / 0 accepted**. Field customization table is empty of rows.
- Finance cannot unlock floor payroll without an accepted close. Payroll audit already showed those tickets unallocated (no attendance). Both sides of the triangle are stalled.
- Evidence: `boss-desktop-shift-close-last-month.png` vs overview last month.

## P1 — broken, dishonest, or unusable today

### P1-1 Eleven tabs; Reports is off-canvas at 1440 and almost gone on phone

- `FINANCE_TABS` = 11. Rail `overflow-x: auto` (`styles.css` `.finance-tabs-rail`). Inventory: Corporate / Categories / Reports `clipped: true` on **desktop**. Phone: 9 of 11 clipped.
- ui-ux-pro-max: bottom/top nav ≤5. This is a second POS/Payroll “Cast” bug, worse because Reports is the last tab.
- Evidence: every `*-meta` tab array in `log.json`; `asa-phone-overview.png` / `asa-phone-sales.png`.

### P1-2 Dashboard guide eats the fold

- `FinancePage.jsx` `defaultOpen={tab === 'overview'}`. Desktop Dashboard opens the four-step novel above filters. Phone Dashboard: guide + net chip + filters before any number.
- Payroll leftovers already closed the payroll guide. Finance did not.

### P1-3 Filters are not in the URL

- Only `?tab=` is deep-linked. Period, branch, compare, custom dates live in `useState`. Refresh / share / last-month probe require re-selecting. WIG: “URL reflects state.”

### P1-4 Validation is native bubbles or toast, not inline

- Empty **New bill → Save bill**: browser “Please fill out this field” on Title. `toasts=[]`. (`boss-desktop-bill-empty-submit.png`)
- Quotes: amount `required`; JS `financeQuotePayloadErrors` is toast-only (`FinanceQuotesTab.jsx:95`).
- Expense report: visible labels, several **without `htmlFor`** (`FinanceExpenseReportsTab.jsx:180–207`). Empty save: toast “Branch, period, category, and amount are required” (JS) — probe did not always catch the toast.
- ui-ux-pro-max Error Placement: errors belong next to the field, announced (`aria-live`). Not a browser tooltip.

### P1-5 Vendors never left the skeleton (this session)

- `boss-desktop-vendors.png`: metric placeholders + grey bars, **no Add vendor form**, after 2.8s settle. Probe: `no button`. Either load hang or error swallowed. ASA vendors similarly empty of CTAs.
- Cannot claim the vendor directory works from this evidence.

### P1-6 Quotes + Corporate as peer books tabs

- Quotations: CRM email via Resend. 0 sends, 16 CRM customers. Not P&L. Xero would put this under quotes/invoices, not equal to Profit and loss.
- Corporate: HQ cash / EOM — owner-flex, wrong altitude next to Sales.
- Expense reports vs Bills: two spend pipes (ASA pack vs petty-cash/supplier). Easy to post the same spend twice if both are used.

### P1-7 Export trios everywhere

- Dashboard: CSV / Excel / PDF. Reports: **5 sections × 3** = 15 download buttons. Bills: another trio. Xero has one export per report, not a stamp on every card.
- Dashboard also hops **Sales / Bills / P&L** — useful, duplicates the tab rail.

### P1-8 ASA view-only still pays the 11-tab tax

- Badge honest (**View only**). No New bill / Add category. Still the same clipped rail and open guide. Split-brain with Payroll: this ASA cannot post pay (`finance_write` false) and cannot edit books.

### P1-9 No unposted crew-pay cue

- P&L 100% margin on wash days is **true** (no posted salary expense) and **misleading** (crew may still be owed). Provenance copy is good (“draft POS expenses excluded”). Missing: “Payroll has not confirmed this window.”

## P2 — redundancy and brand

- “How Finance works” step 4 (Payroll handoff) — **Done**: `href` + Open Payroll. Unposted-pay cue also links Payroll when there is income and no posted salary.
- Duplicate Compare on P&L (`#pl-compare`) — **Done**: removed; filter bar Compare is the one control.
- Title Case vs sentence case mixed (“Bills & expenses”, “Profit and loss”, “Can edit”) — **Decided keep** existing tab labels.
- Visual vs landing: landing is navy field, condensed wordmark, paper CTAs. Finance is stone canvas, default shadcn cards, navy used as **active tab fill and primary buttons**. ui-ux-pro-max `--design-system "finance accounting"` suggested OLED + Fira Code — **reject that**; Hakum already has navy/paper. **Deferred** brand pass (navy field).
- Xero: dashboard + bank + invoices + a reports list. **Deferred** clone; Quotes/Corporate stay under More.

## Web Interface Guidelines (terse)

## src/pages/FinancePage.jsx

- `FinancePage.jsx:107-110` — period/branch/compare not in URL
- `FinancePage.jsx:289` — guide `defaultOpen` on Dashboard (fold)
- `FinancePage.jsx:339-348` — 11 `TabsTrigger`s, last three clipped at 1440

## src/lib/financeData.js

- `financeData.js:115-117` — custom range does not reject `end < start`

## src/pages/finance/FinanceReportsTab.jsx

- `FinanceReportsTab.jsx:100-104` — crew KPI unwindowed
- `FinanceReportsTab.jsx:105-113` — retention unwindowed; UI still stamps the filter window
- `FinanceReportsTab.jsx:312-499` — CSV/Excel/PDF × 5 (redundant)

## src/pages/finance/FinanceQuotesTab.jsx

- `FinanceQuotesTab.jsx:95` — quote errors toast-only
- `FinanceQuotesTab.jsx:178-184` — amount `required` (native bubble) then JS allows 0

## src/pages/finance/FinancePurchasesTab.jsx

- `FinancePurchasesTab.jsx:141-147` — JS toasts; empty title hits native `required` first (`boss-desktop-bill-empty-submit.png`)

## src/pages/finance/FinanceExpenseReportsTab.jsx

- `FinanceExpenseReportsTab.jsx:180-207` — labels without `htmlFor` / matching `id`
- `FinanceExpenseReportsTab.jsx:85-89` — toast-only required fields

## src/pages/finance/FinanceVendorsTab.jsx

- Load: skeleton only this session (`boss-desktop-vendors.png`) — error path not proven

## src/pages/finance/FinancePLTab.jsx

- `FinancePLTab.jsx:129-132` — provenance honest (drafts/EoS excluded) ✓
- `FinancePLTab.jsx:157` — second Compare control vs shell

## src/components/ops/opsGuideCopy.js

- `opsGuideCopy.js:50-52` — Payroll handoff text, no link

## Does it do the job?

| Job | Does it? |
|-----|----------|
| Show paid POS vs posted expenses | **Yes, if the period includes the sale days.** Default month: no. |
| Exclude draft ceramic / EoS overrides from P&L | **Yes** (copy + ₱0 expenses on Aug 8). |
| Accept closes so payroll can run | **UI exists. No closes in the only live sales month.** |
| Pay / set commission | **No — and it must not.** Categories “Payroll / salary” is a bucket. |
| Record bills | **Yes for SA** (New bill + native required). ASA view-only: no. Vendors tab did not load. |
| Export the same window | **Partially** — sales/P&L/best sellers yes; retention/crew no. |
| Owner sets books rules without an engineer | **Partially** — categories, EoS override toggles, corporate cash. Commission/frequency stay on Payroll. |
| Phone books | **No** — clipped tabs, open guide, 16 sub-44px hits. |
| Look like Hakum / Xero | **No.** Light admin, not navy field; not a compact ledger. |

## If this were the backlog (order)

1. Default to last activity (or last 30 days with a “last paid: 2026-08-08” cue). Reject inverted custom ranges.
2. Scope retention + crew KPI to the same window, or label them **lifetime**.
3. Collapse to ≤5 primary tabs (Dashboard, Sales, Bills, Shift reviews, More). Put Reports/Quotes/Corporate/Vendors/Categories behind More. Close the Dashboard guide.
4. Put period/branch in the URL. Inline field errors.
5. Surface “unposted crew pay” as a Finance cue that links to Payroll — do not add % editors here.
6. Then a brand pass (navy field, condensed wordmark). Optional later: fix Vendors load; one export per report.

## Not tested this session

- Accepting or rejecting a live close (non-destructive; no submitted row in range).
- Paying a bill / sending a quote / saving a category (probes only).
- Investor read-only books.
- Corporate EOM roll-up with HQ expenses.
- Whether Vendors eventually loads after &gt;3s.

## Verify (this session)

| Claim | Evidence |
|-------|----------|
| Shots exist | 92 PNG, 54 inventories, harness exit 0 (ASA 164s, Boss 227s) |
| Non-destructive product | This wave: `scripts/_finance-deep-shots.mjs` + this doc + evidence. No `src/` edits in this prompt. |
| ASA vs write | `View only` vs `Can edit` in `log.json` |
| Every tab | 11 ids × 2 roles × 2 viewports + Reports block scrolls + last-month money tabs |
