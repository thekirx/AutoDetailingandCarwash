# BusyBee (BrandTxt) — production SMS

**Outbound only · customer reminders / status only.** Hakum sends SMS; we do **not** receive replies or run an inbox. **No owner daily close SMS** in product (Finance accept notifies SA/ASA via **web push**). Legacy `ENABLE_OWNER_SMS=1` is QA-only.

| Piece | What it is | What it is not |
|-------|------------|----------------|
| `BUSYBEE_SENDER_ID` (`HAKUM`) | Approved **From** label on the handset | Not a reply address; not owner phone |
| BrandTxt **IP whitelist** | Allows our **server** egress to call `SendSMS` / Balance | Not related to replies |
| `OWNER_SMS_PHONE` | Legacy / unused in product default | Not required |

**API base:** `https://app.brandtxt.io`  
**Endpoints:** `POST/GET /api/v2/Balance`, `POST /api/v2/SendSMS`  
**Swagger:** https://app.brandtxt.io/swagger/index.html

## App env (server-only — Vercel + local `.env`)

| Variable | Example |
|----------|---------|
| `BUSYBEE_API_BASE_URL` | `https://app.brandtxt.io` |
| `BUSYBEE_API_KEY` | From BrandTxt portal |
| `BUSYBEE_CLIENT_ID` | From BrandTxt portal |
| `BUSYBEE_SENDER_ID` | `HAKUM` (approved SenderId) |
| `ENABLE_OWNER_SMS` | **Do not set** in production |

Never use `VITE_*` for BusyBee keys.

## Code paths (customer reminders)

| Flow | Module |
|------|--------|
| Queue / booking status SMS | `server/notifyBooking.mjs` → `busybeeSendSms` |
| Lifecycle / visit milestones / self_test | `server/lifecycleSms.mjs` |
| Paint-maintenance reminder rules | `server/paintMaintenanceNotify.mjs` + Notifications ReminderRules |
| Paint-maintenance arrival (→ Vehicle intake status) | `server/maintenanceSchedulesApi.mjs` `action: 'arrive'` → `notifyBookingStatus` |
| CRM / marketing broadcast | `server/notificationBroadcastApi.mjs` |
| Birthday greetings | `server/birthdayGreetings.mjs` |
| Rate-your-visit (15m after finish) | `server/rateVisitReminders.mjs` via booking-reminders cron |
| Daily Sheet submit / approve | `server/notifyOpsEvent.mjs` (`sheet_submitted`, `sheet_reviewed`) → **web push only** |
| Spoofed-location time-in blocked | `geo_clock_in` RPC inbox + `server/notifyOpsEvent.mjs` (`attendance_location_alert`) → **web push only** to SA / ASA / branch BA |

Shop-wide gate: `app_settings.sms_notifications.enabled` must be `true`.

## Permanent live checklist (IP whitelist)

BrandTxt ErrorCode **11** = `Unauthorized IP address`. Until the calling egress IP is whitelisted, **no** customer reminder can send (Balance and SendSMS both fail).

### Verified 2026-10-14 (this machine, new HAKUM API key)

| Check | Result |
|-------|--------|
| Credentials | New key + client id in local `.env` only (server env, not `VITE_*`, not git) |
| BrandTxt Balance | **OK** ErrorCode 0, credits about PHP 6,492 |
| SendSMS | **Accepted** ErrorCode 0 via `/api/v2/SendSMS` (MessageId `f3f85d62-6076-4327-a2d5-e9c19d2abeb4`) to the QA handset. Check the phone for sender HAKUM. |
| Current office/dev egress | **`27.49.15.199`** (whitelisted on this key) |
| Previously documented office IPs | `180.191.244.237` and `180.190.249.189` (stale — do not rely on them) |
| Vercel project on this CLI account (`jcuadys-projects`) | **NOT PRESENT** — set `BUSYBEE_*` on the Hakum team, then whitelist that project's Static IPs |

### Ops actions (required for permanent live)

1. **This office IP `27.49.15.199` already passes Balance** on the new HAKUM key. If ErrorCode 11 returns later, the office IP drifted: whitelist the new `egressIp` from `check-busybee-egress.mjs`.  
2. Re-run: `node scripts/check-busybee-egress.mjs` then  
   `SEND_TEST_SMS=1 TEST_SMS_PHONE=09625294043 node scripts/check-busybee-egress.mjs`  
   Expect `ok: true` and a MessageId; poll until DLR `DELIVRD`.  
3. **Vercel (Hakum team, not `jcuadys-projects`):** set server-only `BUSYBEE_API_KEY`, `BUSYBEE_CLIENT_ID`, `BUSYBEE_SENDER_ID=HAKUM`, `BUSYBEE_API_BASE_URL=https://app.brandtxt.io`. Do not set `ENABLE_OWNER_SMS`. Then enable [Static IPs](https://vercel.com/docs/networking/static-ips) and whitelist those IPs on BrandTxt. Office IP alone does not cover production.  
4. Redeploy after the env is saved.  
5. Prove prod: hit a real booking status / reminder from the deployed custom domain.

**No bypass:** BrandTxt IP allowlisting cannot be skipped from the app. See ready-to-send email: [`BUSYBEE-BRANDTXT-REQUEST.md`](./BUSYBEE-BRANDTXT-REQUEST.md). Policy module: `src/lib/busybeeEgressPlan.js`.

Office IP **drifts** — if ErrorCode 11 returns, run `check-busybee-egress.mjs` and update BrandTxt with the new `egressIp`.

## Local verification

```bash
node scripts/check-busybee-egress.mjs
SEND_TEST_SMS=1 TEST_SMS_PHONE=09625294043 node scripts/check-busybee-egress.mjs
SEND_TEST_SMS=1 TEST_SMS_PHONE=09625294043 node scripts/smoke-busybee.mjs
node scripts/qa-sms-shop-gate.mjs
node scripts/set-sms-shop-gate.mjs on
```
