# FE map — money path (code-actual)

## POS — `/operations/pos`

| Item | Detail |
|------|--------|
| Page | [`src/pages/PosPage.jsx`](../../../src/pages/PosPage.jsx) |
| Panels | [`src/pages/pos/PosPanels.jsx`](../../../src/pages/pos/PosPanels.jsx), [`PosSettingsPanel.jsx`](../../../src/pages/pos/PosSettingsPanel.jsx) |
| Shell tabs | `checkout` (Sell), `pending` (Pay queue), `expenses`, `dashboard` (Today), optional `settings` |
| Landing | `resolvePosLandingTab` — pending when handoffs > 0 and no `?tab=` |
| Catalog | SA/ASA: bay / detailing / merch; **BA: merch only** (+ pay queue) |
| CTAs | Checkout pay → `complete_pos_sale`; ceramic draft expenses; End of shift wizard; daily report |
| Gate | `canAccessPos` — SA, ASA(+pos), OL, BA |

## Payroll — `/operations/payroll`

| Item | Detail |
|------|--------|
| Page | [`src/pages/PayrollPage.jsx`](../../../src/pages/PayrollPage.jsx) |
| Tabs | Dashboard, Run payroll, Cash advances, Salaries, Payouts, Rules |
| Gate | SA / ASA+`finance_view` confirm; BA **denied** |
| Honesty | Close ₱ attestation vs POS proof ₱ side-by-side; CA deduct manual in wizard |

## My pay — `/operations/my-pay`

| Item | Detail |
|------|--------|
| Page | [`src/pages/MyPayPage.jsx`](../../../src/pages/MyPayPage.jsx) |
| Cards | Confirmed vs wash-pool **estimate** (not money in hand) |

## Finance — `/operations/finance`

| Item | Detail |
|------|--------|
| Page | [`src/pages/FinancePage.jsx`](../../../src/pages/FinancePage.jsx) + `src/pages/finance/*` |
| Tabs | Dashboard, Sales, Bills & expenses, P&L, Shift reviews, Expense reports, Vendors, Quotations, Corporate, Categories, Reports |
| Chrome | [`FinanceChrome.jsx`](../../../src/pages/finance/FinanceChrome.jsx) |
| Reports route | `/operations/reports` → redirect to `?tab=reports` |
| Provenance | Overview / P&L / Reports show paid-POS / `finance_daily_pl` proof lines |

## Role matrix (money)

| Role | POS | Finance | Payroll | My pay |
|------|-----|---------|---------|--------|
| BossMich | yes | write | confirm | no (uses Payroll) |
| ASA | grant | grant | grant | yes |
| Ops lead | yes | view | no | yes |
| BA | yes | write (no payroll) | no | yes |
| Investor | no | view/reports | no | no |
| TL / crew | no | no | no | yes |
