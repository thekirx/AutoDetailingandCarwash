# Handoff: Points shop (merch for points) — build it

**Status:** design approved by Kirk on 5 Nov 2026. Nothing built yet. Client may still comment on the look and wording.

**Read first:**
- `CLAUDE.md` and the last ~40 lines of `CHANGES.log`. This repo has several AI agents working in it: append to `CHANGES.log` when you finish, and don't touch other agents' uncommitted work (e.g. the PPF files `src/components/public/home/PpfPackagesSection.*` and their tests).
- The approved look: `design-mocks/app-points-shop-2026-11-05/real-app-options.html`. **Option A is chosen.** Every screen in it is the real app with the new parts added, so build exactly what you see. The board at the top and the "Staff side" section at the bottom are the spec.
- Older boards with the rules: `design-mocks/app-points-shop-2026-11-05/index.html` (board 8 "Decisions"). Ignore their hand-drawn look.

---

## What it is

Customers use their **points** to get Hakum merch **in the customer app**. No online orders, no delivery, no payment. They claim an item in the app, get a pickup code, and collect it at the branch. Staff can only hand it over after typing the customer's code.

## Decided rules (don't change without asking Kirk)

| # | Rule |
|---|---|
| 1 | The item is held for **10 days**. Not picked up → item goes back to stock and the points go back to the customer, automatically. |
| 2 | **No cancelling** by the customer once points are used. |
| 3 | **Same points for every size.** |
| 4 | **No limit** per customer, as long as they have the points. |
| 5 | Shop starts with **3 placeholder items**: Hakum T-shirt (50 pts, sizes S–2XL), Hakum Keychain (20), Hakum Car Freshener (30). Admins manage items in a new **Merch shop** admin page. |
| 6 | Staff can only hand over after typing the **customer's pickup code**. Staff never see the full code. |
| 7 | Homepage: **remove** the "Merchandise Claims" tab from the Rewards section; add one line pointing to the app. |
| 8 | Merch is **app only**. No shop on the public website. |
| 9 | Reminders by **in-app push only**. **No SMS** (BusyBee is customer reminders/status only — see `CLAUDE.md`). |

---

## What already exists (reuse it)

- **Products** have `points_price`, `size_options` (jsonb), `show_in_pos`, `is_active`, `is_archived` (`supabase/migrations/20261026230000_merch_point_prices.sql`, `20261019200000_product_size_options.sql`).
- **Stock** per branch **and per size**: `product_branch_stock(product_id, branch_slug, size_key, qty)` (`20261019220000_product_branch_stock_size_key.sql`). Helpers: `src/lib/productSizes.js`, `src/lib/inventoryBranchStock.js` (`branchOnHand`).
- **Claim today:** app `src/pages/CustomerVouchersPage.jsx` → `portalAction('redeem-accessory')` → `server/customerPortal.mjs` (action at ~line 740, shop list at ~line 306) → SQL `public.redeem_accessory(p_customer, p_product, p_branch)` (`20261017180000_redeem_branch_stock.sql`) → table `accessory_redemptions` (status `pending|fulfilled`).
- **Admin edit form** already has points, sizes, and per-size branch stock with restock approval: `src/pages/ProductsManagePage.jsx` (used inside `src/pages/InventoryPage.jsx`, "Merch / sellables" tab).
- **Push:** `server/webPush.mjs` (`sendWebPushToUsers`, `notifyRecipients`). **Daily jobs:** `vercel.json` crons → `api/notifications.js` operations (copy the `birthday-greetings` pattern).
- **Customer app parts:** `src/components/customer/CustomerUi.jsx` (`Row` with `thumb`, `SectionHead`, `Badge`), `src/components/customer/Sheet.jsx`, stamp-card pass classes `capp-card capp-pass` in `src/pages/CustomerLoyaltyPage.jsx`.

## Known bugs to fix as part of this

1. **`redeem_accessory` ignores size.** Its `UPDATE product_branch_stock … WHERE product_id AND branch_slug` has no `size_key` filter, so a sized shirt loses 1 from **every** size row at that branch. It must take one from the chosen size only.
2. No staff step ever sets `accessory_redemptions.status = 'fulfilled'`.
3. No expiry: unclaimed items keep points and stock forever.
4. Two lists of merch points: hard-coded `MERCH_POINTS` in `src/lib/rewardsCatalog.js` vs `products.points_price`. After this work, the app must only use `products`.

---

## Tasks

### 1. Database (one new migration — **do NOT apply it**; Kirk applies migrations himself)
New file `supabase/migrations/2026110xxxxxxx_points_shop.sql`:
- `products`: add `description text`, `photo_url text`, `show_in_app boolean not null default false`.
- `accessory_redemptions`: add `size_key text not null default ''`, `pickup_code text unique`, `expires_at timestamptz`, `fulfilled_at timestamptz`, `fulfilled_by uuid`, `expired_at timestamptz`; widen status check to `pending | fulfilled | expired`.
- Replace `redeem_accessory` with a version that takes `p_size text`: checks `show_in_app`, deducts points, takes **1 from that size** at that branch, writes the ledger + stock movement (with `size_key`), sets `expires_at = now() + interval '10 days'`, makes a short unique code like `HK-4821`, returns the code. Keep it `security definer`, `service_role` only.
- New `handover_redemption(p_branch text, p_code text, p_staff uuid)`: only a `pending`, not-expired row at that branch with that exact code → `fulfilled`. Wrong code → clear error. Staff role check like other staff RPCs.
- New `expire_redemptions()`: every `pending` row past `expires_at` → `expired`, give points back (ledger reason `accessory_expired`), put 1 back on that branch + size, write a stock movement.
- Placeholder data: add Hakum T-shirt (sizes S, M, L, XL, 2XL; 50 pts), Hakum Keychain (20), Hakum Car Freshener (30) with `show_in_app = true`, `show_in_pos = false`, only `where not exists` (same style as `20261026230000`). Leave the 10 older point items as they are but `show_in_app = false`.
- Add SQL scenarios in `supabase/tests/points_shop/` (copy the `refer_a_friend` folder pattern): size-only deduction, not enough points, out of stock, wrong code, right code, expiry gives points + stock back, can't hand over twice.

### 2. Server
- `server/customerPortal.mjs`: shop list = products with `show_in_app` and `points_price > 0`, including `description`, `photo_url`, `size_options`, per-size stock. `redeem-accessory` takes `size`. Return the customer's redemptions with code, size, branch, `expires_at`, status.
- Staff endpoint for hand-over (check branch + role) that calls `handover_redemption`.
- Cron: add `points-shop-expiry` to `api/notifications.js` + `vercel.json` (daily). It calls `expire_redemptions()` and pushes "2 days left" and "points returned" messages. **Push only, never SMS.**
- Push "Your item is set aside at <branch>" right after a claim.

### 3. Customer app (look = mock option A + "Same for all options")
- `src/pages/CustomerLoyaltyPage.jsx`: new **Points shop** section under the "Next reward" card. `SectionHead` "Points shop" with the points as `note`, then a `capp-group` of `Row`s with `thumb` = photo and sub = "50 points · In stock at Bacoor". Tapping a row opens the claim sheet.
- Claim sheet (`Sheet`): photo, description, size pills (sizes out at the branch disabled and crossed out), "Pick up at" branch row (like Book's `capp-branch-pick`), points math (your points / −50 / left after + "We keep it for you for 10 days"), button "Use 50 points".
- Pickup pass page (new route, e.g. `/account/pickup/:id`): `capp-card capp-pass` with "Pickup pass", the big code, item · size · points, foot = branch + keep-until date. Below: "X days left" row and a History group (Picked up / Expired badges). No cancel button.
- Rewards row "Vouchers" sub-text → "Birthday car wash." and remove the points-shop list from `CustomerVouchersPage.jsx`.
- Remove the "Points table" `MERCH_POINTS` rows on Rewards (keep service points).

### 4. Counter (Point of Sales, `src/pages/PosPage.jsx`)
- When a customer is picked and has a `pending` item at this branch: "Points shop pickup" box in the order panel above "Items" (see mock): photo, item · size, claimed / keep until, a code field "Ask the customer for their pickup code", green "Code matches" line, **Hand over** button (disabled until the code matches). Codes show masked `HK-••••`.
- No sale, no payment, nothing on the daily sheet or Finance.

### 5. Admin "Merch shop" page
- New nav item **Merch shop** under the **Customers** group in `src/auth/permissions.js` (after Memberships). Access: Super Admin + the existing `services_merch` grant.
- Page = Inventory's look (see mock): summary cards (In the app / Waiting for pickup / Picked up this month / Expired this month), branch filter + search by **customer name**, chips Items · Waiting for pickup · History, table: photo + name, Points, In the app, Sizes, Total on-hand, Branch breakdown, Status, Actions.
- Edit uses the existing product form with: Photo upload (use the app's existing upload path/bucket — check how other images are stored before adding a new one), Name, One-line description, Sizes (no per-size price), Points ("same for every size"), "Show in the Hakum app" checkbox, Stock at each branch (existing restock flow). Hide SKU, price, usage kind, merch family, tags, Show in POS for these items.
- "Waiting for pickup" list: customer, item, size, keep-until, masked code, **Enter code** button → same hand-over as the counter.

### 6. Website
- `src/components/public/bredesign/BdRewards.jsx`: remove the "Merchandise Claims" tab and its grid. Add one line: "Use your points for Hakum merch in the Hakum app." with a "Get the app" button (reuse the existing app CTA).
- Update the website text that says "redeem exclusive Hakum merchandise" only if it now reads wrong.

---

## Checks before you say it's done

- `npm run lint`, `npm test`, `npm run build` pass (note any failures that already exist on clean `main`).
- New unit tests for: shop list mapping, size-only stock, claim sheet disabled states, code match logic, expiry math.
- **Look:** localhost has no real Supabase login. Use the fixture rig in `design-mocks/app-points-shop-2026-11-05/real-app/rig/` (it fakes Supabase + `/api`, nothing reaches the real database). Dev server on port 5180, then e.g. `node rig.mjs out /account/loyalty` and `ROLE=staff node rig.mjs out /operations/pos`. Compare against the mock at phone 390px and desktop 1440px.
- Public browser tests (`npm run test:browser`) need the built site served on 4173 first.
- Append a short entry to `CHANGES.log`: what changed, what was checked, and that the migration is **not applied**.

## Don't

- Don't apply the migration or write to the live database.
- Don't send SMS. Don't add a public shop page.
- Don't commit or push other agents' work; don't push at all unless Kirk says so.
- Don't use stock or AI images in production. Placeholders stay clearly marked until Hakum uploads real photos.
