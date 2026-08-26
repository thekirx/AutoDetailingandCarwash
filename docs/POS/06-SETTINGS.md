# 06 — POS Settings (customizable vs hardcoded)

## Where settings live

| Surface | Path |
|---------|------|
| Hub tile | `/operations/settings` → POS settings |
| Page | `/operations/settings/pos` · `PosSettingsPage.jsx` |
| Singleton table | `ops_pos_settings` (id = 1) |
| Shift-close fields | `shift_close_field_config` |

## Actually configurable today

1. **Payment methods** — value + label JSON list (edit existing slots).
2. **Expense kinds** — value + label JSON list (edit existing slots).
3. **End-of-shift fields** — label, sort_order, `allow_override`, `is_active` per `field_key`.

Runtime: PosPage loads `ops_pos_settings` for payment/expense dropdowns. ShiftCloseWizard / Finance respect field config.

## Not “fully customizable” (hardcoded)

| Area | Where locked |
|------|----------------|
| Shell tabs / labels | `PosPage` `SHELL_TABS` |
| Catalog tabs (bay/detailing/merch) | `PosPage` + `serviceKinds.js` |
| BA merch-only gate | `isBranchAdmin` effect |
| Merch families / sellable tags | `posSellables.js` |
| Sale bucket heuristics | `classifySaleBucket` |
| Wizard steps | `SHIFT_CLOSE_WIZARD_STEPS` |
| Money key set | `SHIFT_CLOSE_MONEY_KEYS` |
| Ceramic / wash pool math | `compensation.js` (Payroll Rules / Payroll Settings) |
| RPC payment_method allowlist | Missing — UI only |
| Add/remove method or kind rows | UI edits values; no first-class add/remove UX |

## Verdict on “settings tab to make it fully customizable”

**Not met.** There is a real Settings page backed by DB for a **thin** policy surface. Calling it fully customizable is **false advertising**. Honest product language: “Configure payment labels, expense kinds, and which close fields BA may override.”

## Payroll-adjacent settings (not POS page)

`/operations/settings/payroll` — attendance weights, pending optional flag, CA auto-deduct — on `compensation_settings`. Pool % / ceramic splits still on Payroll → Rules.
