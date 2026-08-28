# Floor Board metrics — owner-readable logic

Source: Super Admin Floor Board (`SuperAdminFloorBoard.jsx` + `fetchSuperAdminFloorBoard`).

| Tile / card | Logic |
|-------------|--------|
| Queue app sales | Paid sales classified as carwash (queue-linked services/packages) |
| Counter / POS sales | Paid sales classified as detailing + coffee + merch |
| Paid sales | Count of paid sale **rows** in the timeline (not pesos) |
| Cancel loss | Sum of `final_price_minor` on cancelled jobs in the timeline |
| Avg waiting time | Mean of `waiting_at → in_progress_at` for stamped tickets |
| Avg time per service | Mean of `in_progress_at → for_payment_at \|\| completed_at \|\| final_checking_at` |
| Failed QA | Tickets with `redo_at` (or status redo) in the timeline |
| Car size per sale | Paid sales grouped by booking `vehicle_type` / size |
| Best package / service | `sale_line_items` ranked by `line_total_minor` |
| Chemical usage | Sunday recon: usage = previous − leftover; cost = usage × unit cost |

Timeline filters (branch + date preset) apply to money, tempo, insights, and sales feed. Live lane tiles count open floor jobs now.
