# 08 — BusyBee Env Keys + Make It Work (New Project + Supabase Edge)

**Audience:** AI / engineer on `AutoDetailingandCarwash`  
**Goal:** Wire BusyBee (Brandtxt) SMS so Team Lead status updates send SMS. Prefer a **Supabase Edge Function** (server secrets), not client `VITE_` keys.

> **Security:** Store API keys in `.env` (local) and Vercel/Supabase secrets only — **never** in git. Rotate keys if exposed in chat or docs.

---

## 1. Credentials (from BrandTxt / BusyBee portal)

| Purpose | App env name | Notes |
|---------|--------------|-------|
| Brandtxt API key | `BUSYBEE_API_KEY` | Server-only |
| Brandtxt Client ID | `BUSYBEE_CLIENT_ID` | Server-only |
| Sender ID | `BUSYBEE_SENDER_ID` | Default `HAKUM` |
| API base URL | `BUSYBEE_API_BASE_URL` | `https://app.brandtxt.io` |

Legacy `VITE_*` names are **deprecated** — this app uses Vercel/server routes (`server/busybee.mjs`), not browser keys.

Supabase URL/anon key: use **your current project** from Dashboard → Settings → API.

---

## 2. Env names for the new project

### A) Supabase Edge Function secrets (recommended)

Set these on the Supabase project used by AutoDetailingandCarwash:

```bash
# CLI — paste values from BrandTxt portal, not from git
supabase secrets set BRANDTXT_API_KEY="your-api-key"
supabase secrets set BRANDTXT_CLIENT_ID="your-client-id"
supabase secrets set BRANDTXT_SENDER_ID="HAKUM"
supabase secrets set BRANDTXT_URL="https://app.brandtxt.io/api/v2/SendSMS"
```

Dashboard path: **Project Settings → Edge Functions → Secrets** (same four keys).

### B) Local `.env` / `.env.local` for the new app (client — public only)

```bash
# Public — OK in Vite/Next public env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_NEW_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_new_anon_key

# OR if the new app still uses Vite:
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_ANON_KEY=...
```

### C) Optional local Edge / server override (never public)

If you run the function locally or a Next API route instead of Edge:

```bash
BRANDTXT_API_KEY=
BRANDTXT_CLIENT_ID=
BRANDTXT_SENDER_ID=HAKUM
BRANDTXT_URL=https://app.brandtxt.io/api/v2/SendSMS
```

Add the same block to `.env.example` **with empty values** for other devs:

```bash
BRANDTXT_API_KEY=
BRANDTXT_CLIENT_ID=
BRANDTXT_SENDER_ID=HAKUM
BRANDTXT_URL=https://app.brandtxt.io/api/v2/SendSMS
```

### Do not do this

```bash
# BAD — ships secrets to every browser
VITE_Api_Key=...
NEXT_PUBLIC_BRANDTXT_API_KEY=...
```

Legacy used `VITE_*` because the Bolt app was careless. The new project must not repeat that.

---

## 3. Recommended architecture (new project)

```
Team Lead UI (authenticated)
  → supabase.functions.invoke('busybee-sms', { body: {...} })
       OR  POST /api/send-sms (Next) which calls Brandtxt / invokes Edge
  → Supabase Edge Function: busybee-sms
  → Brandtxt POST https://app.brandtxt.io/api/v2/SendSMS
```

Replace the legacy unused Twilio function (`twilio-sms`) with a **BusyBee** function named `busybee-sms`.

---

## 4. Supabase Edge Function — what to build

### Folder

```
supabase/functions/busybee-sms/index.ts
```

### Secrets used inside the function

```ts
const apiKey = Deno.env.get('BRANDTXT_API_KEY')
const clientId = Deno.env.get('BRANDTXT_CLIENT_ID')
const senderId = Deno.env.get('BRANDTXT_SENDER_ID') ?? 'HAKUM'
const smsUrl = Deno.env.get('BRANDTXT_URL') ?? 'https://app.brandtxt.io/api/v2/SendSMS'
```

### Request body (same as legacy UI)

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

### Phone convert (copy into Edge)

```ts
function convertPhoneNumber(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/\D/g, '')
  if (cleaned.startsWith('0')) return '63' + cleaned.slice(1)
  if (cleaned.startsWith('63')) return cleaned
  if (cleaned.length === 10) return '63' + cleaned
  return cleaned
}
```

### Brandtxt payload

```ts
const payload = {
  SenderId: senderId,
  Is_Unicode: false,
  Is_Flash: false,
  SchedTime: '',
  GroupId: '',
  Message: message, // from templates in 06-busybee-integration.md
  MobileNumbers: convertPhoneNumber(phoneNumber),
  ApiKey: apiKey,
  ClientId: clientId,
}
```

### Success / failure (fix legacy swallow bug)

```ts
const res = await fetch(smsUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})
const data = await res.json()
if (!res.ok || data?.ErrorCode !== 0) {
  return new Response(
    JSON.stringify({ success: false, error: data?.ErrorDescription ?? 'SMS failed' }),
    { status: 500, headers: { 'Content-Type': 'application/json' } },
  )
}
return new Response(JSON.stringify({ success: true, data }), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})
```

### Auth on the Edge Function

- Keep **`verify_jwt = true`** (default) so only logged-in Team Lead (or service role) can invoke.
- Handle `OPTIONS` for CORS if the browser calls the function directly.
- Do **not** allow anonymous public invoke in production.

### Templates

Copy the full random template pools from [06-busybee-integration.md](./06-busybee-integration.md) into the Edge Function (or a shared `_shared/busybee-templates.ts`). Rebrand “Hakum Auto Care” if the new product name differs. You may keep Sender ID `HAKUM` until Brandtxt approves a new sender.

---

## 5. Step-by-step: make BusyBee work on the new project

### Step 1 — Secrets

1. Open the **new** Supabase project (or reuse Hakum’s if intentional).
2. Set the four `BRANDTXT_*` secrets (§2A) with the values in §1.
3. Confirm Sender ID `HAKUM` is still approved on Brandtxt for this account.

### Step 2 — Deploy Edge Function

```bash
# from AutoDetailingandCarwash repo root
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# create function scaffold if needed
supabase functions new busybee-sms

# paste logic (convert + templates + Brandtxt fetch + rethrow)
# then deploy
supabase functions deploy busybee-sms --no-verify-jwt=false
```

Dashboard alternative: **Edge Functions → Deploy** after committing `supabase/functions/busybee-sms`.

### Step 3 — Wire Team Lead UI

On car add (if phone) and on status change (except cancelled / empty phone):

```ts
const { data, error } = await supabase.functions.invoke('busybee-sms', {
  body: {
    status,          // waiting | in-progress | payment-pending | completed
    plateNumber,
    serviceType,     // human-readable names
    phoneNumber,
    queueNumber,     // only for waiting
  },
})
if (error || data?.success === false) {
  // show toast to Team Lead — do not silently ignore
}
```

Call sites to mirror (cars only): see [06-busybee-integration.md](./06-busybee-integration.md) § “When the UI sends SMS”.

### Step 4 — Local test

```bash
supabase functions serve busybee-sms --env-file .env.local
```

Then POST with a real PH test number:

```bash
curl -i -X POST "http://127.0.0.1:54321/functions/v1/busybee-sms" \
  -H "Authorization: Bearer YOUR_ANON_OR_USER_JWT" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"waiting\",\"plateNumber\":\"ABC-1234\",\"serviceType\":\"Wash\",\"phoneNumber\":\"09XXXXXXXXX\",\"queueNumber\":1}"
```

Expect HTTP **200** and `ErrorCode === 0` from Brandtxt. Wrong key → **500**.

### Step 5 — Production smoke

1. Log in as Team Lead.  
2. Add car with your phone as `waiting` → SMS with queue number.  
3. Move to `in-progress` → SMS with service names.  
4. `payment-pending` → QC / admin template.  
5. `completed` → thank-you.  
6. `cancelled` → no SMS.  
7. Function logs in Supabase: **Edge Functions → busybee-sms → Logs**.

---

## 6. Alternative: Next.js API route (if not using Edge)

Same secrets in the host (Vercel/Render) env — **not** `NEXT_PUBLIC_*`:

```
BRANDTXT_API_KEY=...
BRANDTXT_CLIENT_ID=...
BRANDTXT_SENDER_ID=HAKUM
BRANDTXT_URL=https://app.brandtxt.io/api/v2/SendSMS
```

Implement `app/api/send-sms/route.ts` with the same payload/phone/templates. Gate with Team Lead session. Still prefer Edge if the rest of the stack is already Supabase-centric.

---

## 7. What to delete / ignore from legacy

| Legacy | Action |
|--------|--------|
| `supabase/functions/twilio-sms` | Do not deploy for SMS; replace with `busybee-sms` |
| `src/lib/sms.ts` (Twilio invoke) | Rewrite to invoke `busybee-sms` |
| `VITE_Api_Key` in client | Never — use Edge secrets |
| Open `/api/send-sms` with no auth | Replace with JWT-gated Edge or session-gated API |

---

## 8. Checklist (BusyBee live)

- [ ] `BRANDTXT_*` secrets set on **new** Supabase project  
- [ ] `busybee-sms` Edge Function deployed with JWT verify on  
- [ ] Templates + phone convert ported from doc 06  
- [ ] Errors return 500 (no swallow)  
- [ ] Team Lead UI invokes function on add + status (not cancel)  
- [ ] Empty phone skips invoke  
- [ ] `.env.example` documents var **names** only  
- [ ] Smoke test SMS received on a real handset  
- [ ] Plan to rotate API key after shared-doc use  

---

## 9. Quick reference — Brandtxt body

```json
{
  "SenderId": "HAKUM",
  "Is_Unicode": false,
  "Is_Flash": false,
  "SchedTime": "",
  "GroupId": "",
  "Message": "Hey! Your vehicle ABC-1234 is 1 in the queue...",
  "MobileNumbers": "639171234567",
  "ApiKey": "<from BUSYBEE_API_KEY>",
  "ClientId": "<from BUSYBEE_CLIENT_ID>"
}
```

Success: response JSON `ErrorCode === 0`.
