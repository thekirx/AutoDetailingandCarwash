# 06 — BusyBee (Brandtxt) Integration — Port Guide

Source: `MyBusyBee/scripts/busybee-sms.js`, `api/index.js`, `api/send-sms.js`, `server.js`, `vite.config.ts`, `vercel.json`, `AddCarForm.tsx`, `QueueItem.tsx`.

**Cars only.** Skip `AddMotorcycleForm` SMS.

## Architecture

```
UI (browser)
  POST /api/send-sms  { status, plateNumber, serviceType, phoneNumber, queueNumber? }
        |
        +-- Local: Vite proxy → Express server.js :3000 → api/send-sms.js
        +-- Vercel: vercel.json rewrite /api/send-sms → /api → api/index.js
        |
        v
MyBusyBee/scripts/busybee-sms.js  →  sendSMS(...)
        |
        v
POST https://app.brandtxt.io/api/v2/SendSMS
```

BusyBee is the **live primary** SMS provider. Twilio (`src/lib/sms.ts`, edge function) is dead — do not port.

---

## Environment variables

### Legacy names (do not keep `VITE_` for secrets)

| Legacy key | Purpose | Example shape |
|------------|---------|---------------|
| `VITE_Api_Key` | Brandtxt ApiKey | secret string |
| `VITE_Client_Id` | Brandtxt ClientId | secret string |
| `VITE_SenderID` | SenderId | e.g. `HAKUM` |
| `VITE_CURL` | Endpoint override | default below |

Default URL: `https://app.brandtxt.io/api/v2/SendSMS`

### Recommended new names (server-only)

```
BRANDTXT_API_KEY=
BRANDTXT_CLIENT_ID=
BRANDTXT_SENDER_ID=
BRANDTXT_URL=https://app.brandtxt.io/api/v2/SendSMS
```

Never expose these as `NEXT_PUBLIC_*` / `VITE_*`. Document them in `.env.example` (legacy `.env.example` omitted BusyBee entirely).

**Live legacy values + Supabase Edge Function setup:** see [08-busybee-env-and-edge-function.md](./08-busybee-env-and-edge-function.md) (API key, Client ID, Sender ID, `supabase secrets set`, deploy `busybee-sms`).

---

## Phone conversion (`convertPhoneNumber`)

1. Strip non-digits.
2. If starts with `0` → replace with `63`.
3. If starts with `63` → keep.
4. If length is 10 → prefix `63`.
5. Else return cleaned digits.

Examples:

| Input | Output |
|-------|--------|
| `09171234567` | `639171234567` |
| `639171234567` | `639171234567` |
| `9171234567` | `639171234567` |

No `+` prefix in Brandtxt payload.

Customer phone validation in forms: optional; if set `^(09|\+639)\d{9}$`.

---

## Message templates (copy these)

Statuses with templates: `waiting` | `in-progress` | `payment-pending` | `completed`.

Placeholders: `{plateNumber}`, `{serviceType}`, `{queueNumber}`.

Unknown status → `Status update for vehicle ${plateNumber}`.

### waiting

- `Hey! Your vehicle {plateNumber} is {queueNumber} in the queue. Appreciate your patience for waiting.`
- `Hi there! Your car {plateNumber} is currently {queueNumber} in line. Thanks for your patience!`
- `Hello! Vehicle {plateNumber} is {queueNumber} in our service queue. We'll get to you soon!`
- `Good day! Your vehicle {plateNumber} is {queueNumber} waiting to be serviced. Thank you for waiting patiently.`
- `Greetings! Your car {plateNumber} is {queueNumber} in our queue. We appreciate your understanding while you wait.`

### in-progress

- `We are now working on your vehicle ({plateNumber}), you availed our {serviceType}.`
- `Great news! We've started servicing your vehicle {plateNumber} with our {serviceType} service.`
- `Your vehicle {plateNumber} is now being serviced! Our team is working on your {serviceType}.`
- `We're currently working on your car {plateNumber}. Your {serviceType} service is in progress.`
- `Good news! Your vehicle {plateNumber} is now under our care for the {serviceType} service.`

### payment-pending

- `Our team leader just finished doing the final check on your vehicle. It's now ready for pickup and payment in our admin.`
- `Great news! Your vehicle has passed our final inspection and is ready for pickup. Please proceed to admin for payment.`
- `Your car is all set! Final quality check completed. Please come to our admin office for payment and pickup.`
- `Excellent! Your vehicle has been thoroughly checked and is ready. Kindly visit our admin for payment processing.`
- `Your vehicle service is complete! Final inspection done. Please head to our admin area for payment and pickup.`

### completed

- `Thank you for visiting Hakum Auto Care, wish you liked our service! Take care driving!`
- `Thank you for choosing Hakum Auto Care! We hope you're satisfied with our service. Drive safely!`
- `It was a pleasure serving you at Hakum Auto Care! Hope you enjoyed our service. Safe travels!`
- `Thanks for trusting Hakum Auto Care with your vehicle! We hope you loved our service. Drive safe!`
- `Thank you for your business! We're glad we could serve you at Hakum Auto Care. Take care on the road!`
- `Appreciate your visit to Hakum Auto Care! Hope our service exceeded your expectations. Drive safely!`

**Rebrand** “Hakum Auto Care” to the new product name when porting. Keep the random-template variety.

Selection: `Math.floor(Math.random() * templates.length)`.

---

## Brandtxt request payload

```json
{
  "SenderId": "<BRANDTXT_SENDER_ID>",
  "Is_Unicode": false,
  "Is_Flash": false,
  "SchedTime": "",
  "GroupId": "",
  "Message": "<rendered template>",
  "MobileNumbers": "639171234567",
  "ApiKey": "<BRANDTXT_API_KEY>",
  "ClientId": "<BRANDTXT_CLIENT_ID>"
}
```

- Method: `POST`
- Header: `Content-Type: application/json`
- Auth: keys in **body**, not Bearer header
- Success: JSON `ErrorCode === 0`
- Failure: non-zero `ErrorCode` + `ErrorDescription`

---

## API contract (server)

### Request

`POST /api/send-sms`

```json
{
  "status": "waiting | in-progress | payment-pending | completed",
  "plateNumber": "ABC-1234",
  "serviceType": "Interior Detailing, Platinum",
  "phoneNumber": "09171234567",
  "queueNumber": 3
}
```

Required: `status`, `plateNumber`, `phoneNumber`.  
`queueNumber` optional (used for waiting templates).  
`serviceType` optional but needed for good in-progress messages — use **names**, not IDs.

### Responses (intended)

| Case | Status | Body |
|------|--------|------|
| OK | 200 | `{ "success": true }` |
| Missing fields | 400 | `{ "error": "..." }` |
| Brandtxt failure | 500 | `{ "error": "..." }` |
| Wrong method | 405 | Method Not Allowed |

### Known bug to fix on port

In `busybee-sms.js`, the outer `catch` **logs and does not rethrow**. Callers always get a resolved promise → API returns **200 success even when SMS failed**.

**Fix:** rethrow after log (or return `{ ok: false }` and map to 500).

Also: legacy `/api/send-sms` has **zero auth** — open relay. Gate with session / shared secret / team-lead JWT in the new app.

---

## When the UI sends SMS (cars)

| Event | Send? | Body notes |
|-------|-------|------------|
| Add car with phone | Yes | `queueNumber = waitingCount+1` if status waiting |
| Add car without phone | No | — |
| Status → waiting / in-progress / payment-pending / completed | Yes | Skip only for `cancelled` |
| Status → cancelled | No | — |
| Crew assign flips waiting → in-progress | Yes | `status: in-progress`, no queueNumber |
| Edit without status change | No | — |

### Exact call sites (legacy)

1. `AddCarForm.tsx` — after successful add, if phone trimmed non-empty  
2. `QueueItem.tsx` — `handleQuickAction` when `newStatus !== 'cancelled'`  
3. `QueueItem.tsx` — after crew assign promotes to in-progress  

`QueueItem` imports `sendSMS` from busybee but **does not call it** — only `fetch('/api/send-sms')`. Do not import the BusyBee module into the browser bundle.

### Improvements to apply in new app

1. Skip SMS if `!phone?.trim()` on status changes (legacy QueueItem can hit API with empty phone → 400).
2. Deduplicate: crew-assign SMS + status-change SMS can both fire for in-progress — send once per transition.
3. Surface failure to team lead (toast) when API returns non-200.
4. Prefer deriving `serviceType` from catalog names at send time.

---

## Local vs production wiring

### Legacy local

- Vite `server.proxy['/api'] = 'http://localhost:3000'`
- Run `node server.js` separately (no npm script) for SMS to work in dev

### New app (Next.js or similar)

- Implement `app/api/send-sms/route.ts` (or equivalent) server-side
- No separate Express process required
- Call Brandtxt with server `fetch`

### Vercel rewrite (legacy)

```json
{ "src": "/api/send-sms", "dest": "/api" }
```

---

## Files to copy / rewrite

| Legacy file | Action |
|-------------|--------|
| `MyBusyBee/scripts/busybee-sms.js` | Rewrite as server module: convert + templates + send; **rethrow errors** |
| `api/index.js` / `api/send-sms.js` | Replace with authenticated route handler |
| `server.js` | Skip if using Next API routes |
| UI `fetch('/api/send-sms')` bodies | Port logic into team-lead mutations |
| `src/lib/sms.ts` / Twilio | **Delete / ignore** |
| Motorcycle SMS | **Ignore** |

---

## Smoke test plan (verify after port)

1. Add car with phone as waiting → SMS includes queue number.
2. Start service / in-progress → SMS includes service names.
3. Ready for payment → payment-pending template.
4. Complete → thank-you template with new brand name.
5. Cancel → no SMS.
6. Add without phone → no SMS.
7. Bad API key → **HTTP 500**, not false 200.
8. Unauthorized caller → rejected (auth gate).
