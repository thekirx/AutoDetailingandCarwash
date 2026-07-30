# Marketing defects and fixes

| ID | Pri | Defect | Status |
|----|-----|--------|--------|
| MKT-C1 | CRITICAL | booking-status company-wide any status | **Fixed** CRM-safe + own branch only |
| MKT-C3 | CRITICAL | Directory empty (no bookings SELECT) | **Fixed** Marketing branch bookings policy |
| MKT-H1 | HIGH | notify-booking any id | **Fixed** Marketing removed from allow-list |
| MKT-H2 | HIGH | sms_events RLS excluded Marketing | **Fixed** |
| MKT-H3 | HIGH | Insights empty (sales SELECT) | **Fixed** branch-scoped sales |
| MKT-H4 | HIGH | Register always 403 | **Fixed** hide unless `isAdmin` |
| MKT-H5 | HIGH | Vehicles CRM ALL company-wide | **Fixed** branch-aware for Marketing/TL |
| MKT-H7 | HIGH | BusyBee GET unauthenticated | **Fixed** bearer required |
| MKT-H9 | HIGH | customer UPDATE missing `role = customer` | **Fixed** |
| MKT-H6/H8/H10/M1 | — | events / push fan-out / complaints / contact | Deferred |

## Correct hypothesis

Marketing was treated as company-wide ops for booking-status while CRM UI assumed bookings/sales/sms_events access it never had. Narrow status API + branch RLS restores CRM without floor privileges.
