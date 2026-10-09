# POS

**Route:** `/operations/pos`  
**Roles:** Branch Admin (counter primary); SA / ASA / Ops Lead; Investor (view only: Today + Sheet history, see `docs/guides/roles/investor.md`)  
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
| Customer | TL takes **no** name or contact. BA fills the **Customer** card on the ticket: mobile + email (unique — typing either autofills an existing customer, otherwise Charge / Save creates one account), then first / last name. Phone + email of two different customers is refused. Blank = guest sale |
| One customer at a time | Add-ons join the open ticket's sale. Opening another ticket with add-ons in the order asks before moving them |

SA / ASA with POS still see bay + detailing catalogs for walk-in / override cases.

## Layout

```
Tablet+: Waiting tickets → merch rail | Order summary (ticket locked + add-ons + tender)
Phone:   Catalogue + sticky cart → sheet order panel
Tabs:    Checkout · Daily sheet · Sheet history · Today (settings when allowed)
```

## Components

`PosOpenTickets`, catalog tiles, order panel (`summarizePosCart`), `DailySheetPanel`, `PosSheetHistory`, `PosTodayPanel`.

## Task flow

1. Floor sends ticket → Waiting to pay  
2. BA opens ticket (locked service line)  
3. BA enters the customer's mobile / email / name (existing customer autofills) — `assign_queue_ticket_customer` moves the ticket onto them  
4. Optional merch/coffee add-ons  
5. Charge → `complete_pos_sale`  
6. Daily Sheet — submit **any time** (no shop-closed gate); cash advances are optional, only opening float + counted cash are required. Sales rung up after submitting are not on that sheet; Finance can return it to refresh. Submitting pushes SA + ASA (`finance_view`) via `notify-ops-event` `sheet_submitted`.
7. Sheet history tab → this branch's sheets as Weekly (Mon–Sun) / Monthly / Daily tables, From–To dates, quick presets, status filter, search by date ("2026-10-09", "Oct 9", "Friday"), CSV. Click a date to open it on the Daily sheet tab.

## Trust boundary

- Client: `sanitizeBranchAdminCart` / `assertBranchAdminCart`  
- Server: `assert_branch_admin_pos_cart` inside `complete_pos_sale`  
