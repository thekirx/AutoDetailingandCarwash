# find-bugs — money path

**Diff scope:** money-path campaign changes + existing POS/Finance/Payroll seams reviewed against MONEY-CONTRACT.

## Files reviewed (complete)

- `src/lib/posSale.js`, `src/lib/posInsights.js`, `src/lib/posSettings.js`
- `src/pages/PosPage.jsx` (expense + landing + settings seams)
- `src/pages/pos/PosSettingsPanel.jsx`
- `src/pages/finance/FinanceOverviewTab.jsx`, `FinancePLTab.jsx`, `FinanceReportsTab.jsx`
- `src/auth/permissions.js` (POS/Finance/Payroll gates — prior role QA)
- RPC trust notes from migrations docs (`complete_pos_sale`, `run_payroll`, shift close)

## Checklist

| Item | Result |
|------|--------|
| Injection | Clean — money posts via RPC params |
| XSS | Clean — React text; exports CSV escaped by helpers |
| Auth | OpsRoleGate + `canAccessPos` / finance / payroll |
| Authz/IDOR | Branch scope via `getBranchScopeList`; BA cannot `run_payroll` |
| CSRF | Cookie session SPA; Supabase JWT |
| Race | `run_payroll` advisory lock documented |
| Session | Existing AuthProvider |
| Crypto | N/A |
| Info disclosure | Investor finance-only OK |
| DoS | N/A in this diff |
| Business logic | See findings |

## Findings

### 1. Empty payment allowlist was open-ended — **Fixed (High)**

- **File:** `src/lib/posSale.js` `isAllowedPosPaymentMethod`
- **Problem:** Empty methods list returned `true` for any non-empty method
- **Fix:** Fallback allowlist cash/gcash/card; test asserts `bitcoin` denied

### 2. POS settings overclaim — **Fixed (Medium)**

- **File:** `PosSettingsPanel.jsx`
- **Problem:** “Customize this counter” implied broader product control
- **Fix:** Honest “Counter options” copy

### 3. Expense draft mislabeled — **Fixed (Medium)**

- **File:** `PosPage.jsx`
- **Problem:** “Expense recorded” hid draft status / P&L exclusion
- **Fix:** Draft toast + CardDescription

### 4. RPC payment_method not settings-bound — **Open (Medium)**

- **Evidence:** `complete_pos_sale` coalesces payload string without `ops_pos_settings` check
- **Fix suggestion:** Migration allowlist join — deferred (UI hardened first)

### 5. Pending landing missing — **Fixed (High workflow)**

- Cashiers could miss Pay queue — `resolvePosLandingTab` + PosPage effect

## Areas not fully verified live

- Destructive full TL→POS→EoS→accept→payroll browser chain (BUG-007 RPC MET; UI pack non-destructive)
- BrandTxt / Vercel SMS (ops blocker, unrelated)

## No Critical open after Wave C fixes
