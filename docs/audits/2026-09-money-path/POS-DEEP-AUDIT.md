# POS deep audit — principal full-stack + frontend read (analysis only)

Date: 2026-09-14 · Scope: `/operations/pos` as Branch Admin (bacoor) and Super Admin, 1440×900 and 390×844.
Evidence: `e2e-evidence/pos-deep/*.png`, `*.inventory.json` (every visible button/input per screen), `log.json`.
Reproduce: `DEV_PORT=5292 node scripts/_pos-deep-shots.mjs`.
**Implementation (2026-09-14):** P0/P1 shipped and verified (`npm test` 1206/1206, lint 0, build 0). Loyalty is gated + stamps consumed; RPC re-checks catalog prices; GCash/card require a reference; cart drafts persist in `sessionStorage`; BA cannot edit POS settings; phone tabs `justify-start`; loading copy; quiet-day EoS allowed. P2 pruning + navy order header shipped. Deferred: receipt/print, void/refund, add/remove payment-method rows.

## Verdict

**Analysis-day (pre-fix):** working counter, not trustworthy. **Post-fix (2026-09-14):** P0 money holes closed (loyalty gate + catalog re-price); P1 honesty/ACL/mobile/tender/draft closed. Residual: owner cannot add/remove payment methods; no receipt/void UI; RPC payment-method allowlist still Medium. Soft-launch unchanged: **READY_WITH_OPS_BLOCKERS** (SMS).

Strict score at audit time (10 = ship to a franchise): **Purpose fit 6 · Validation 5 · Honesty 5 · Redundancy 6 · Owner customizability 3 · Mobile 4 · Brand/premium 4.**

## What a POS is for here (purpose check)

Hakum's POS has exactly four jobs, in this order of frequency:

1. **Take payment for a car the floor already finished** (Pay queue ticket → tender → paid). Highest volume, must be 2 taps.
2. **Ring up walk-in merch / add-on services** (Sell → cart → tender).
3. **Log petty cash spent from the drawer** so end-of-shift cash-left reconciles.
4. **Close the shift** with a count Finance can trust and Payroll can pay from.

Everything else on the page (KPI board, category totals, crew-pay preview, Inventory link, Finance links, Payroll links, settings editor) is management context, not counter work. Today the counter and the management context share one screen with equal visual weight, which is the root of most of the layout complaints below.

## Screenshots index

| Screen | File |
|---|---|
| BA Sell desktop (settled) | `admin-desktop-sell-after-add.png` |
| BA Sell desktop, first paint (empty-state flash) | first run, see §P1-3 |
| BA cart sheet phone (2 items, tender) | `admin-phone-cart.png` |
| Boss Sell phone (catalog below the fold) | `boss-phone-checkout.png` |
| Boss cart sheet phone | `boss-phone-cart.png` |
| BA Pay queue empty | `admin-desktop-pending.png` |
| BA Expenses + empty submit | `admin-desktop-expenses.png`, `admin-desktop-expense-validation.png` |
| Today (dashboard) desktop / phone | `boss-desktop-dashboard.png`, `admin-phone-dashboard.png` |
| End of shift blocked toast | `admin-desktop-eos-step1.png`, `boss-desktop-eos-step1.png` |
| Settings tab BA (102 inputs) | `admin-desktop-settings.png`, `admin-phone-settings.png` |
| Settings tab Boss / full route | `boss-desktop-settings.png`, `boss-settings-pos-route.png` |
| Mid-session gate flip (cart lost) | `boss-desktop-cart.png`, `admin-desktop-discount-customer.png` |
| Brand reference | `brand-landing-ref.png` |

## P0 — money integrity

### P0-1 "Loyalty" button on every tile gives any item away free, to anyone, with no check
- `src/pages/PosPage.jsx:2234-2244` renders a **Loyalty** ghost button under every catalog tile, for every role, with no `disabled` condition.
- `src/pages/PosPage.jsx:754-784` `addToCart(item, { loyaltyAward: true })` sets `unit_price_minor: 0` and `is_loyalty_award: true`. No check that a customer is linked, that the customer has a redeemable reward, or that a reward is consumed.
- Server `supabase/migrations/20260827111000_complete_pos_sale_branch_stock.sql:102-106` accepts the client's `unit_price_minor` and only uses `is_loyalty_award` to **skip awarding stamps**. `grep -ri redeem src supabase/migrations/…complete_pos_sale…` → no redemption logic exists anywhere in the app.
- Net: a cashier taps "Loyalty" on Full Care Package (₱4,500) for a walk-in → ₱0 sale, stock decremented, note says "Includes loyalty award line". No audit row, no approval, nothing to reconcile against. This is the largest leak on the page.

### P0-2 Server trusts client prices; discount cap and reason live only in the browser
- `posSale.js:120-191` clamps % to 0–100 and requires a 3-char reason **client-side**; `writeAudit` is client-side.
- RPC lines 101-103: `unit := coalesce((line->>'unit_price_minor')::int, 0)` — no comparison to `products.price_minor` / `services.price_minor` / `service_size_prices`, no `unit >= 0` guard, no discount ceiling, no reason persisted on the sale row (only inside free-text `notes`, `PosPage.jsx:957-960`).
- Any user with the POS grant can call `complete_pos_sale` with arbitrary prices. Even inside the UI, a 100% discount with reason "abc" is accepted. Finance has no discount column to report on.

## P1 — broken or dishonest today

### P1-1 Every POS load fires a 400: `expense_categories.is_active does not exist`
- `PosPage.jsx:306-318` queries `expense_categories(id,name,kind,is_active).eq('is_active', true)`. Postgres answers `42703`. Error is unread (`const { data: finCats }`), so the "Finance is source of truth" override never runs and the console errors every load (`log.json`: 2 × 400 per tab).
- Effect: Expense kinds always come from `ops_pos_settings`; the comment "Finance expense_categories is source of truth when present" is false. Dead path + noise. Either drop the column filter or delete the block.

### P1-2 Phone: the active **Sell** tab is clipped off the left edge and unreachable
- `boss-phone-checkout.png`, `admin-phone-checkout.png`: tab strip shows "Pay queue · Expenses · Today · ⚙" while Sell is the active tab.
- Cause: `src/components/ui/tabs.jsx:21` base class `justify-center` + `src/components/ops/OpsTabBar.jsx:14` `w-full overflow-x-auto`. When content is wider than the strip, centered overflow spills past the scroll origin and the leading tab cannot be scrolled into view. Every ops page using `OpsTabList` with 5 tabs on a 390px phone has this.
- Measured (boss, 390px): tablist `clientWidth 358 / scrollWidth 439 / justify-content: center`; Sell trigger `aria-selected="true"` with `getBoundingClientRect().left = -61px`; forcing `scrollLeft = -10000` leaves `scrollLeft = 0` and Sell still at −61px. Unreachable by scroll, not just clipped.

### P1-3 Loading state renders as empty state ("No items under All merch yet", "No field config rows yet")
- `PosPage.jsx:1704-1710` and `PosSettingsPanel.jsx:184-185` have no loading flag; before the first fetch resolves the UI asserts the catalog / config is empty. First-run screenshots caught it on every tab for both roles. On a slow branch connection a cashier reads "nothing to sell" for 1–3 s. Also causes CLS when tiles pop in.

### P1-4 Settings tab lies to Branch Admin
- `PosSettingsPanel.jsx:20` `canWrite = isAdmin(profile)` (includes BA). BA sees 102 editable inputs and 20+ **Save field** buttons (`admin-desktop-settings.png`).
- RLS: `ops_pos_settings_write` = `is_super_admin() OR asa_has_grant('finance_write')`; `shift_close_field_config_*` = `is_super_admin()` only (`20260821210000_pos_payroll_settings.sql:33-37`, `20260821010000_shift_close_reports.sql:48-57`). BA's save fails at the DB with an RLS toast.
- The fallback copy (`:172`) says "Only Super Admin can edit lists" — correct policy, wrong gate.

### P1-5 Non-cash tenders capture no reference number
- Tender group `PosPage.jsx:1512-1530`; only `cash` gets an amount field (`:1532-1570`). GCash / card sales store `payment_method` and nothing else. Finance cannot reconcile a GCash sale against the wallet statement (Xero-style bank rec is impossible without a ref). Nothing prevents tapping "GCash" on a cash sale, either.

### P1-6 In-progress sale is memory-only and the shell can remount under it
- `grep sessionStorage|localStorage PosPage.jsx` → none. Cart, linked customer, discount, tender all die on refresh or remount.
- Observed twice in this session (both roles, 2/2 runs of the full pack) the page flipped to `LoadingScreen` / blank navy mid-session with items in the cart (`boss-desktop-cart.png`, `admin-desktop-discount-customer.png`). `ProtectedRoute.jsx:14` shows the spinner whenever `loading || (user && !profile)`; `AuthProvider.jsx:150` sets `loading=true` on any profile-reload auth event; a failed `loadProfile` leaves the spinner forever with no retry UI. Root cause of the trigger was not pinned in isolation (a targeted probe with visibilitychange + storage events kept the cart), so this is reported as: **failure mode confirmed, trigger intermittent**. Either way a cashier who refreshes loses the order.

### P1-7 End of shift refuses to open on a zero-activity day
- `PosPage.jsx:1128-1141` `shopDayShouldClose` false → toast "Nothing to close today". A branch that opened and sold nothing still needs a closing record (float count, who closed, when) for Finance's day ledger to be continuous. Currently that day simply has no row.

## P2 — redundant, useless, or confusing controls

| Control | Where | Problem |
|---|---|---|
| **End of shift** in header + step 4 of guide + Daily report sheet toggle | `:1931-1960`, `PosPanels` guide | Three doors to one wizard. Header button is the only one that should exist. |
| **Daily sales report** | Sell toolbar `:1628` **and** Today tab `:1900` | Duplicate; on Sell it sits between the KPI board and the catalog, pushing tiles down. |
| **Inventory Management** | Sell `:1631` **and** Today `:1903` | Duplicate; leaves POS. |
| **Open Pay queue** banner button | `:1646-1654` | Duplicates the Pay queue tab 60px above it. Keep the count badge, drop the second button. |
| **Clear** | split-view header `:1733` and sheet `:2103` | Destructive, no confirm, two placements. |
| Branch pill (BA) | `:1670-1674` | Looks like a button (`bg-muted`, MapPin, pill) but is static. Header already shows the branch twice (breadcrumb + title suffix). |
| **Loyalty** per tile | `:2234-2244` | See P0-1. Also visual noise on all 8 tiles when no customer is linked. |
| Settings tab embed **and** "Open full POS settings page" | `:1924-1926` | Two copies of a 100-input form; embed makes the POS tab 6 screens tall. |
| **Attendance register / Open Payroll / Open Finance · expenses / Cash advances · Payroll** | Today tab `:1900-1915` | Four nav-only buttons for roles that already have these in the sidebar. BA sees Attendance only; boss sees all four. |
| "How POS works" guide, `defaultOpen` on Sell | `:1964` | On phone it consumes the entire first viewport every session (`admin-phone-checkout.png`). Should remember dismissal. |
| Compensation toggles default `crewAssisted: true` | `:1058`, `:1574-1603` | Silent default that changes crew pay; unlabeled group has no explanation of the money effect. |
| Category chip counts `(0)` for empty categories | `:2125+`, screenshots | Shows five chips with `0` items to BA; empty categories should hide or the owner should be able to hide them. |

## Validation matrix (client vs server)

| Input | Client | Server | Gap |
|---|---|---|---|
| Cash received | `parsePesosToMinor` regex, charge disabled until covered (`:606-617`, `:898-900`) | not sent | Disabled Charge gives **no reason**; needs inline "Enter cash received" text. Only `aria-label`, no visible label (`:1552`). |
| Payment method | allowlist `isAllowedPosPaymentMethod` (`:906`) | accepts any string (`v_method`) | Fallback list hardcoded; no ref no. for non-cash. |
| Discount % / ₱ / reason | clamp 0–100, ≥3-char reason (`posSale.js:120-127`) | none | Placeholder-only labels (`:1332-1352`), no `min/max`, no cap policy, not persisted structurally. |
| Quantity | stepper cap 99 (`posSale.js:87-104`) | `greatest(qty,1)` only | Tile "Add" tap bypasses cap; negative/absurd qty blocked only by UI. |
| Unit price | catalog | **trusted from client** | P0-2. |
| Loyalty free line | none | none | P0-1. |
| Guest phone | ≥10 chars triggers provision (`:915`) | API | No PH format check, `type=tel` absent on some fields; BA can't provision (copy says "Admin / Super Admin" – true). |
| Expense title/amount/kind | `required`, `>0`, `inputMode=decimal` (`:1092-1097`) | RLS only | Kind not re-checked against allowlist; browser-native "Please fill out this field" bubble is the only error UI (`admin-desktop-expense-validation.png`). |
| Expense role | `canWriteFinance` check (`:1089`) | RLS | Tab still shown to roles that can't submit; they get a paragraph instead of a form. |
| EoS overrides | `parsePesosToMinor`, reason ≥3 (`shiftClose.js:240-254`), inline errors | payload stored | Reason length not re-checked server-side. |
| Catalog search | none | n/a | No label, no clear button, no debounce. |

Double-submit guards exist (`saving`, `savingExpense`, `shiftSubmitting`). Post-sale side effects (`notify-booking`, `claim_birthday_perk`, `lifecycle-sms`, ceramic salary drafts, `:985-1041`) are best-effort after the sale commits — failures surface as `toast.warning` only, with no retry list. A sale succeeds and the receipt is a toast that disappears in 4 s: **no receipt view, no print, no SMS receipt, no change-due confirmation after Charge**.

## Owner customizability — what the owner can actually change

| Owner can | Owner cannot (hardcoded) |
|---|---|
| Rename the 3 payment methods and 8 expense kinds (`PosSettingsPanel.jsx:126-165`) | **Add or remove** a payment method or expense kind — there is no add/remove row control |
| Edit EoS field label / sort / allow-override / active (SA only) | Reorder or hide POS tabs; rename "Sell / Pay queue / Expenses / Today" (`PosPage.jsx:1968-1975`) |
| Catalog, prices, sizes (in Inventory / Services pages, not here) | Quick-cash ladder `[200,500,1000,2000,5000,10000]` (`:609-612`) |
| Compensation % (Payroll settings page) | Discount ceiling / who may discount / require approval |
| — | Receipt content or branding |
| — | Tender rules (e.g. "GCash requires ref no.") |
| — | Which categories show on the counter per branch |
| — | Guide text (`POS_WORKFLOW_STEPS`) |

Editing a method **value** (e.g. `cash` → `bills`) is allowed by the form but breaks the counter: cash-tender logic is keyed on the literal `'cash'` (`PosPage.jsx:1532`, `posSale.js` `cashTenderCoversTotal`). Expense reset hardcodes `expense_kind: 'daily'` (`:1124`). No uniqueness or empty-value validation on either list. So "fully customizable by the owner" is currently **label-customizable by the Super Admin, with a foot-gun**.

## Web Interface Guidelines findings (terse)

- `src/components/ui/tabs.jsx:21` `justify-center` on scrollable list clips leading item on overflow (P1-2).
- `src/pages/PosPage.jsx:1332-1351` three inputs with placeholder-only labels; "Reason (required)" as placeholder.
- `src/pages/PosPage.jsx:1663-1667` catalogue search input has no label / `type="search"` / clear affordance.
- `src/pages/PosPage.jsx:1552` cash input relies on `aria-label`; no visible label; no `autocomplete="off"`.
- `src/pages/PosPage.jsx:1617-1619` disabled primary CTA with no adjacent reason text.
- `src/pages/PosPage.jsx:1733`, `:2103` destructive **Clear** without confirm or undo.
- `src/pages/PosPage.jsx:1977-1991` `outline-none` on `TabsContent` without `focus-visible` replacement.
- `src/pages/PosPage.jsx:1584-1593` native checkboxes inside `<label>` OK, but group lacks description of money effect.
- `src/pages/PosPage.jsx:1704-1710`, `PosSettingsPanel.jsx:184` empty copy shown during loading (no skeleton, CLS).
- `src/pages/PosPage.jsx:2205-2212` tile meta `line-clamp-1` truncates service descriptions to "Deep cabin care…" on 390px with no tooltip/full text.
- Money uses `formatMoney` + `tabular-nums` consistently — good. Icon-only buttons all have `aria-label` — good (`inventory.json`: `iconOnlyNoAria=0` on every screen).
- Tap targets: 6–23 buttons per screen under 44px (`inventory.json` `<44px`), mostly `size="sm"` size chips, quick-cash chips and tile footers at 36px. Acceptable for desktop, tight for a wet-hands counter phone.

## Brand / premium gap vs landing page

`brand-landing-ref.png`: deep navy `#02081f`-ish field, oversized condensed wordmark, uppercase 0.2em-tracked nav labels, white/blue pill CTAs, generous negative space. POS: light paper background, default shadcn cards, Roboto-class UI font, 10px uppercase eyebrows (the only inherited motif), navy used solely on the primary button and the mobile sheet header. Nothing wrong with a light ops chrome, but "premium similar to the landing page" would mean: the checkout sheet header treatment (`admin-phone-cart.png`, navy gradient + tracked eyebrow) extended to the desktop order panel header and the page hero; a single display weight for totals (`₱3,000` currently renders in the body font); tiles with price as the dominant element and a 1px navy ring rather than `bg-primary/5`; and category rail chips styled like the landing nav (tracked caps) rather than default pills. Today the page reads as "generic admin", not "Hakum".

## Workflow fit with Hakum (honest read)

- Order of the day is **pay queue first**; the code knows this (`resolvePosLandingTab` lands on Pay queue when tickets exist) but the chrome puts Sell first and the guide says "1. Sell". Pick one story.
- BA (cashier) sees **merch only** (`PosPage.jsx:107-112`, `productIsPosSellable`), yet the guide tells BA "Pick services or merch" and the category chips show five zero-count merch buckets. Honest copy for BA is "Merch and Pay queue".
- Cashier leaves POS for four routine tasks (stock, vendor bills, CA approval, attendance). Acceptable, but the Today tab should then be a read-only summary, not a launcher.
- POS expenses are **drafts** (copy is now honest about that) but sit in the same visual weight as sales; the EoS "Total expenses" field silently sums drafts, while P&L excludes them — two totals for one word.
- No void/refund anywhere (`grep -ri void|refund src` → none). A mis-rung sale is permanent from the counter; Finance has no reversal UI either. For a cash business this is a real ops blocker.

## Structure

`PosPage.jsx` is 2,172 lines and owns catalog, cart math, checkout RPC, customer linking, expenses, EoS, dashboard and shell. The three clean seams are `PosOrderPanel` (`:1239-1620`), `PosCatalogPane` (`:1658-1711` + `:2121-2263`) and a `usePosCheckout` hook (`:896-1061`). Not a user-facing defect, but every P1 above is harder to fix safely because of it.

## Not tested this session

- Pay queue with a live handoff (no pending tickets in demo data at run time; prior campaign evidence at `e2e-evidence/money-path/admin-pos-pending.png`).
- A completed payment (non-destructive audit; no sales were written).
- Root cause of the intermittent gate flip (P1-6) — failure mode observed, trigger not isolated.

## If this were my backlog (order)

1. P0-1 gate Loyalty behind linked customer + redeemable reward + server-side redemption; hide the button otherwise.
2. P0-2 RPC re-prices lines from catalog, stores `discount_minor` + `discount_reason` columns, enforces a configurable cap.
3. P1-1 delete or fix the `expense_categories` block.
4. P1-2 `justify-start` on scrollable `OpsTabList` (one class).
5. P1-3 `loading` flag → skeleton tiles.
6. P1-4 `canWrite = isSuperAdmin || asaHasGrant('finance_write')`; hide the tab from BA.
7. P1-5 reference-number field for non-cash tenders, required by setting.
8. P1-6 persist cart to `sessionStorage` keyed by branch; retry UI on `ProtectedRoute` spinner.
9. Then the P2 pruning and the brand pass.
