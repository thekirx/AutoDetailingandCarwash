# 03 — Checkout & catalog (services, packages, detailing, merch)

## Sell surfaces

### A. Pay queue (final payment for floor / booking tickets)

1. TL (or allowed editor) progresses ticket → `for_payment`.
2. RPC `send_queue_ticket_to_payment` creates/updates `pos_handoffs` (`pending`).
3. BA/SA opens **Pay queue**, `loadHandoff` → cart via `buildHandoffCartLine` / `buildVisitHandoffCartLines`.
4. Optional merch add-ons keep the handoff (`keepQueueHandoffWhenAdding` for products only).
5. Checkout → `complete_pos_sale` with `pos_handoff_id` + `booking_id`.

**Honest limit:** Handoff without `booking.service_id` blocks checkout (`posCartBlocksCheckout` / `missing_service`). BA cannot invent a service id — TL/SA must fix the ticket.

**Who sends to payment:** UI/RPC gate is admin-side (`canSeeForPaymentLane` / BA+SA+ASA). TL typically stops at final check unless owner changes that standard.

### B. Walk-in catalog (manual POS)

| Catalog tab | Items | Roles |
|-------------|-------|-------|
| Services & packages (`bay`) | Active services in bay filter; packages use `included_service_ids` / pricing | SA / ASA(pos) |
| Detailing | Detailing filter (pay_category / slugs) | SA / ASA(pos) |
| Merch | Products | BA (sellable tags only) · SA/ASA (all active) |

Packages and detailing cards set `item_type: 'service'` and `catalog_kind` for display. Payload attaches `service_id`.

### C. Inventory relationship

- **Sell** happens on POS.
- **Create/edit SKUs, stock, tags, size prices** happen on `/operations/inventory` (gated by `canManageServices`).
- BA is checkout-only for catalog management — intentional.

## Payment methods

- UI list from `ops_pos_settings.payment_methods` with fallback `PAYMENT_METHODS` (`cash`, `gcash`, `card`).
- RPC stores `payment_method` string — **not** validated against settings allowlist today.

## Membership / loyalty on cart

- `priceCartForMembership` reprices catalog service lines (not handoff floor prices).
- Loyalty awards / birthday lines can force zero unit price; RPC honors flags.
- Handoff lines keep floor amount.

## Ceramic compensation toggles

- Shown when `ceramicPreview` / detailing amount applies (`detailingAmountMinor` uses `pay_category === 'detailing'`).
- On pay (if finance write): inserts ceramic expense drafts for later payroll split.
- **Risk:** Detailing tab SKUs with other `pay_category` (e.g. PPF) may not enter ceramic path — see [08-GAPS-AND-RISKS.md](./08-GAPS-AND-RISKS.md).

## Completeness vs owner ask

| Owner ask | Status |
|-----------|--------|
| Final payment for services/packages/detailing **from floor tickets** | Complete |
| Manual POS for services/packages/detailing | Complete for SA/ASA; **not** for BA |
| Manual POS for inventory | Complete (merch); BA tag-filtered |

If the owner wants BA to sell bay/detailing walk-in, that is a **product change**, not a bugfix.
