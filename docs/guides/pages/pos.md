# POS

**Route:** `/operations/pos`  
**Roles:** Branch Admin (counter primary); SA / ASA / Ops Lead  
**Shell:** Command

## Purpose

One counter page for cars waiting to pay + merch/coffee sell. Daily Sheet is a sibling tab (BA fills; Finance approves).

## Branch Admin counter contract

| Rule | Behavior |
|------|----------|
| Catalog | Merch / coffee / sellables only — no Services & packages rail |
| Queue ticket lines | Locked (TL owns job + price). BA cannot qty-edit or remove them |
| Add-ons | Merch/coffee join the open ticket; one `complete_pos_sale` links `booking_id`, `pos_handoff_id`, customer/plate |
| Pay queue + Sell | Combined on **Checkout** — no separate Pending tab |
| Discount | BA cannot discount (`canDiscountPosSale` false; RPC rejects BA discounts) |
| Walk-in bay jobs | Not on BA POS — TL sends the car to payment |

SA / ASA with POS still see bay + detailing catalogs for walk-in / override cases.

## Layout

```
Tablet+: Waiting tickets → merch rail | Order summary (ticket locked + add-ons + tender)
Phone:   Catalogue + sticky cart → sheet order panel
Tabs:    Checkout · Daily sheet · Today (settings when allowed)
```

## Components

`PosOpenTickets`, catalog tiles, order panel (`summarizePosCart`), `DailySheetPanel`, `PosTodayPanel`.

## Task flow

1. Floor sends ticket → Waiting to pay  
2. BA opens ticket (locked service line)  
3. Optional merch/coffee add-ons  
4. Charge → `complete_pos_sale`  
5. End of day → Daily Sheet (not End of shift)

## Trust boundary

- Client: `sanitizeBranchAdminCart` / `assertBranchAdminCart`  
- Server: `assert_branch_admin_pos_cart` inside `complete_pos_sale`  
