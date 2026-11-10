# maintenanceSchedulesApi.mjs

> 45 nodes · cohesion 0.08

## Key Concepts

- **maintenanceSchedulesApi.mjs** (33 connections) — `server/maintenanceSchedulesApi.mjs`
- **notificationBroadcastApi.mjs** (30 connections) — `server/notificationBroadcastApi.mjs`
- **sendWebPushToUsers()** (24 connections) — `server/webPush.mjs`
- **notificationCopy.js** (23 connections) — `src/lib/notificationCopy.js`
- **handleNotificationBroadcastRequest()** (19 connections) — `server/notificationBroadcastApi.mjs`
- **handleMaintenanceSchedulesRequest()** (18 connections) — `server/maintenanceSchedulesApi.mjs`
- **notificationSettingsApi.mjs** (18 connections) — `server/notificationSettingsApi.mjs`
- **paintMaintenanceNotify.mjs** (13 connections) — `server/paintMaintenanceNotify.mjs`
- **handleNotificationSettingsRequest()** (11 connections) — `server/notificationSettingsApi.mjs`
- **messageMaxForChannel()** (10 connections) — `src/lib/notificationCopy.js`
- **sendPaintMaintenanceReminder()** (9 connections) — `server/paintMaintenanceNotify.mjs`
- **renderNotificationMessage()** (9 connections) — `src/lib/notificationCopy.js`
- **titleMaxForChannel()** (7 connections) — `src/lib/notificationCopy.js`
- **safeNotificationPath()** (6 connections) — `server/notificationTargetUrl.mjs`
- **BUSYBEE_SMS_SINGLE_MAX** (6 connections) — `src/lib/notificationCopy.js`
- **clampNotificationCopy()** (6 connections) — `src/lib/notificationCopy.js`
- **buildMaintenanceArrivalBooking()** (6 connections) — `src/lib/paintMaintenance.js`
- **processArrival()** (5 connections) — `server/maintenanceSchedulesApi.mjs`
- **What already exists (reuse it)** (4 connections) — `docs/handoff/points-shop/HANDOFF.md`
- **resolveBroadcastAudience()** (4 connections) — `server/broadcastAudience.mjs`
- **canProcessMaintenanceArrival()** (4 connections) — `server/maintenanceSchedulesApi.mjs`
- **notificationTargetUrl.mjs** (4 connections) — `server/notificationTargetUrl.mjs`
- **resolveNotificationScope()** (4 connections) — `src/lib/notificationCopy.js`
- **broadcastAudience.mjs** (3 connections) — `server/broadcastAudience.mjs`
- **canSeeAllBranches()** (3 connections) — `server/maintenanceSchedulesApi.mjs`
- *... and 20 more nodes in this community*

## Relationships

- [@supabase/supabase-js](@supabase-supabase-js.md) (48 shared connections)
- [paintMaintenance.js](paintMaintenance.js.md) (15 shared connections)
- [birthdayPerk.js](birthdayPerk.js.md) (13 shared connections)
- [Button](Button.md) (11 shared connections)
- [ref_node_assert](ref_node_assert.md) (10 shared connections)
- [notifyOpsEvent.mjs](notifyOpsEvent.mjs.md) (8 shared connections)
- [notifyBooking.mjs](notifyBooking.mjs.md) (8 shared connections)
- [busybee.mjs](busybee.mjs.md) (6 shared connections)
- [bookingReminders.mjs](bookingReminders.mjs.md) (5 shared connections)
- [react](react.md) (4 shared connections)
- [bookingFloorBoard.test.js](bookingFloorBoard.test.js.md) (3 shared connections)
- [e2e-real-customer-status-sms.mjs](e2e-real-customer-status-sms.mjs.md) (3 shared connections)

## Source Files

- `docs/handoff/points-shop/HANDOFF.md`
- `server/broadcastAudience.mjs`
- `server/maintenanceSchedulesApi.mjs`
- `server/notificationBroadcastApi.mjs`
- `server/notificationSettingsApi.mjs`
- `server/notificationTargetUrl.mjs`
- `server/paintMaintenanceNotify.mjs`
- `server/webPush.mjs`
- `src/lib/notificationCopy.js`
- `src/lib/paintMaintenance.js`

## Audit Trail

- EXTRACTED: 221 (97%)
- INFERRED: 6 (3%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*