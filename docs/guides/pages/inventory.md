# Inventory

**Route:** `/operations/inventory`  
**Shell:** Command

## Purpose
Services + merch catalog, branch on-hand on merch rows, Sunday recon for internal chemicals, Super Admin CRUD lock.

## Layout
Tabs → Merch product table (branch on-hand column) → Edit dialog restock/set → Sunday recon tab → Lock control (SA).

## Components
OpsTabList, DataTable, merch edit dialog (branch stock), BranchInventoryPage (recon / BA restock).

## Roles
- **SA / ASA (catalog):** bay, detailing, merch. Merch edit sets branch on-hand. SA can Lock / Unlock inventory CRUD (audit + inbox to every Super Admin).
- **BA:** full BranchInventoryPage (restock + Sunday recon) when they have no catalog grant.
- **When locked:** only Super Admin mutates catalog, restock, or recon. POS sales still deduct stock.

## Tabs
| Tab | Who | What |
|---|---|---|
| Services & packages | SA/ASA | Bay wash / package catalog |
| Detailing | SA/ASA | Detailing catalog |
| Merch / sellables | SA/ASA | Product table + branch on-hand. Optional sizes: each row is a name and a price. Empty sizes use the single price. Stock is still one count per product. |
| Sunday recon | SA/ASA + BA path | Internal chemicals leftover submit / approve |

Legacy `?tab=stock` and `?tab=restock` redirect to merch.
