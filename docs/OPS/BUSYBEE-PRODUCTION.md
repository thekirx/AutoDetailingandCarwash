# BusyBee (BrandTxt) — production SMS

**API base:** `https://app.brandtxt.io`  
**Endpoints:** `POST/GET /api/v2/Balance`, `POST /api/v2/SendSMS` (v3 SendSMS also supported)  
**Swagger:** https://app.brandtxt.io/swagger/index.html

## App env (server-only — Vercel + local `.env`)

| Variable | Example |
|----------|---------|
| `BUSYBEE_API_BASE_URL` | `https://app.brandtxt.io` |
| `BUSYBEE_API_KEY` | From BrandTxt portal |
| `BUSYBEE_CLIENT_ID` | From BrandTxt portal |
| `BUSYBEE_SENDER_ID` | `HAKUM` |
| `OWNER_SMS_PHONE` | Owner mobile for daily close SMS (optional; falls back to BossMich staff phone) |

Never use `VITE_*` for BusyBee keys.

## Code paths

| Flow | Module |
|------|--------|
| Queue / booking status SMS | `server/notifyBooking.mjs` → `busybeeSendSms` |
| CRM / marketing broadcast | `server/notificationBroadcastApi.mjs` |
| Owner daily report after Finance accept | `server/notifyShiftClose.mjs` |
| Lifecycle / birthday | `server/lifecycleSms.mjs`, `server/birthdayGreetings.mjs` |
| Staff balance / test send API | `server/busybeeApi.mjs` → `/api/notifications?operation=busybee` |

Shop-wide gate: `app_settings.sms_notifications.enabled` must be `true`.

**Current ops posture (2026-09-03):** BrandTxt confirmed whitelist for egress **`180.190.249.189`**. Local balance probe returns `ErrorCode: 0` with credits. Shop SMS gate turned **ON** after live send success. Toggle via CRM → SMS or:

```bash
node scripts/set-sms-shop-gate.mjs off
node scripts/set-sms-shop-gate.mjs on
```

**Verified live (2026-09-03 Asia/Manila):**

| Check | Result |
|-------|--------|
| Egress IP | `180.190.249.189` (matches whitelist notice) |
| `POST /api/v2/Balance` | `ErrorCode: 0`, credits present |
| Direct smoke send → `09625294043` | `sent` via `/api/v3/SendSMS` |
| Shop-gated lifecycle send → same phone | `sent` after gate ON |

Production (Vercel) still needs **static egress IPs** whitelisted separately — serverless shared IPs are not this office address.

## Local verification

```bash
node scripts/smoke-busybee.mjs
SEND_TEST_SMS=1 TEST_SMS_PHONE=09XXXXXXXXX node scripts/smoke-busybee.mjs
node scripts/qa-sms-shop-gate.mjs
```

## IP whitelisting

BrandTxt requires outbound IP whitelist. Provide:

1. **Dev/office IP** — for local `npm run dev` and scripts
2. **Vercel production** — enable [Vercel Static IPs](https://vercel.com/docs/security/static-ip) (Pro+) and send fixed egress IPs, or ask BrandTxt for key-only auth if available

Until Vercel IPs are whitelisted, production SMS will fail even with correct env vars.
