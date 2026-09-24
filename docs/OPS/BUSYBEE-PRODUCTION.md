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
| CRM / marketing broadcast | `server/notificationBroadcastApi.mjs` |
| Birthday greetings | `server/birthdayGreetings.mjs` |
| Finance accept | `server/notifyShiftClose.mjs` → **web push only** |

Shop-wide gate: `app_settings.sms_notifications.enabled` must be `true`.

## Permanent live checklist (IP whitelist)

BrandTxt ErrorCode **11** = `Unauthorized IP address`. Until the calling egress IP is whitelisted, **no** customer reminder can send (Balance and SendSMS both fail).

### Verified 2026-09-24 (this machine)

| Check | Result |
|-------|--------|
| Shop SMS gate | **ON** (`sms_notifications.enabled=true`) |
| Code / normalize `09625294043` → `639625294043` | **OK** |
| Unit seams (`tests/busybeeReminderSms.test.js`) | **PASS** |
| Current office/dev egress | **`180.191.244.237`** |
| BrandTxt Balance / SendSMS | **FAIL ErrorCode 11** — IP not whitelisted |
| Previously documented office IP | `180.190.249.189` (stale — do not rely on it) |
| Handset live DELIVRD to `09625294043` | **BLOCKED** until BrandTxt adds `180.191.244.237` |
| Vercel project Static IPs (this CLI account) | **NOT VISIBLE** — Hakum project is on another Vercel team; enable Static IPs there and whitelist those IPs too |

### Ops actions (required for permanent live)

1. **BrandTxt portal:** whitelist **`180.191.244.237`** (current office/dev) for API key used by Hakum.  
2. Re-run: `node scripts/check-busybee-egress.mjs` then  
   `SEND_TEST_SMS=1 TEST_SMS_PHONE=09625294043 node scripts/check-busybee-egress.mjs`  
   Expect `ok: true` and a MessageId; poll until DLR `DELIVRD`.  
3. **Vercel (Hakum team):** enable [Static IPs](https://vercel.com/docs/networking/static-ips) (Pro/Enterprise, ~$100/mo per project + private data transfer). Copy the fixed egress IP pair(s) per region, whitelist **those** on BrandTxt (office IP alone is not enough for production serverless).  
4. Redeploy after env confirm (`BUSYBEE_*` server-only).  
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
