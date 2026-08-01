# CONTINUE HERE — ops blockers to 100%

Code/DB soft-launch gates are **closed and verified**. Remaining items need **you**. Reply **continue** after each block is done (or paste confirmation).

---

## 1. BusyBee API host (BLOCKING SMS) — evidence 2026-08-01

`node scripts/smoke-busybee.mjs` → parked HTML, not JSON:

```
baseUrl https://brandtxt.busybee.ph
ErrorDescription: Parked/wrong host … returned a website/parking page
```

Also probed `api.busybee.ph`, `smsapi.busybee.ph` → same parking HTML. `api.smslane.com` → 404.

**Ask BusyBee for:**
1. Exact production API base URL that returns JSON for `/api/v2/Balance` and `/api/v2|/v3/SendSMS`
2. Whether IP whitelist is required; if yes, how to handle **Vercel dynamic egress** (disable IP filter or static IP)
3. Confirm Sender ID `HAKUM` + ApiKey/ClientId for this account

Then set local + host env: `BUSYBEE_API_BASE_URL=<their URL>` and re-run:

```bash
node scripts/smoke-busybee.mjs
# optional live send:
# $env:SEND_TEST_SMS=1; $env:TEST_SMS_PHONE=09XXXXXXXXX; node scripts/smoke-busybee.mjs
```

**BusyBee go when:** balance JSON has `ErrorCode: 0` (or credits payload).

---

## 2. Deploy / secrets (BLOCKING production parity)

Vercel team `jcuadys-projects` lists only:
- `offgrid-lifestyle`
- `kado-kohi`

**No Hakum Auto Care project** and **no `.vercel/` link** in this repo.

**Do one of:**
- Import this repo to Vercel and set env vars, **or**
- Tell us where it is hosted (other Vercel team / Render / etc.)

**Required server env (never `VITE_*` for secrets):**

| Key | Purpose |
|-----|---------|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | API routes |
| `BUSYBEE_API_BASE_URL` / `BUSYBEE_API_KEY` / `BUSYBEE_CLIENT_ID` / `BUSYBEE_SENDER_ID` | SMS |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web push |
| `RESEND_API_KEY` / `RESEND_FROM` | Finance quotes (optional until quotes used) |

Local `.env` already has BusyBee + VAPID + service role keys present (names only checked).

---

## 3. Supabase Auth SMTP (BLOCKING password email)

Dashboard → **Authentication → SMTP Settings** (custom domain + templates).

Without this: customer forgot-password / set-password emails fail or spam-folder.

**SMTP go when:** send a test recovery email to a real inbox and open `/account/set-password`.

---

## 4. Optional (not soft-launch blockers)

| Item | Notes |
|------|-------|
| Upstash Redis | Durable rate limits across Vercel instances |
| Playwright UI E2E | Click-path coverage beyond API smoke |
| Sentry | Production exception visibility |
| CAPTCHA | Stronger than honeypot on public forms |

---

## Already verified (do not re-ask)

| Gate | Evidence |
|------|----------|
| Unit tests | `node --test` … **74 pass, exit 0** (this session) |
| Queue allocator live | `queue_number_counters` exists; counter_rows ≥ 1 |
| ASA finance RLS | policies `expenses_select/write/update/delete` live |
| ASA POS grant | `complete_pos_sale` checks `asa_has_grant('pos')` |
| Route lazy | `App.jsx` React.lazy; build exit 0 previously |
| Public form friction | honeypot + dwell tests pass |

**Overall:** soft-launch **code = GO**; production SMS/email/deploy = **CONTINUE with 1–3 above**.
