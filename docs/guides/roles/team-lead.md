# Team Lead

**Home:** `/operations/queue`  
**Shell:** FloorAppShell  
**Device:** Phone + tablet

## Dock

Queue · New · Floor (when granted) · Attendance · Bookings (max 5)  
More: History, My Tasks, Planner, My advances. `/operations/crew` redirects to Attendance; hire is on People (SA/ASA).

## Daily flow

1. Open Queue — scan lanes (wash / packages). After Start, a birthday car shows “Happy birthday — ask for their code”. The code is not on the card. The customer gets the SMS.  
2. New ticket / advance status. On the ticket editor, type a promo voucher code when the customer quotes one (`apply_booking_promo_voucher`). Only Team Lead can apply it; the ticket price updates before POS.  
3. Bookings — detailing board: tap a status card, advance cars from the card (Payment handoff is POS). Same voucher field on edit when you are Team Lead.  
4. Maintenance card — paint-maintenance car arrives → **Car arrived · Start intake** (goes to Vehicle intake)  
5. Attendance exceptions  
6. Crew assignments

See [Bookings and Maintenance](../pages/bookings-maintenance.md).

## Must never see

Finance write, Daily Sheet submit / approve, people RBAC, all-branch settings (unless granted path).
