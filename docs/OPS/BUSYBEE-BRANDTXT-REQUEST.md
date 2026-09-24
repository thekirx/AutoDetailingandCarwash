# BrandTxt (BusyBee) — whitelist follow-up (copy/paste email)

**Permanent rule:** BrandTxt rejects API calls unless the **HTTP caller egress IP** is on their whitelist (ErrorCode **11**). There is **no** app-side bypass. Dexter confirmed **180.190.249.189** was whitelisted 2026-08-31; office egress has since drifted — fresh probe 2026-09-24: **180.191.244.237** → ErrorCode 11.

**Thread history (keep in same Gmail reply chain to Dexter):**
- You (Malcolm / Joax) → Dexter, Fri Aug 28 — asked whitelist `180.190.249.189` + noted Vercel production
- Dexter → you, Mon Aug 31 — “successfully whitelisted … 180.190.249.189 under the HAKUM account”

---

## Follow-up email — reply to Dexter (same thread)

**Send now:** paste [`brandtxt-dexter-followup.txt`](./brandtxt-dexter-followup.txt) into the existing Gmail thread (Aug 28 / Aug 31) from `jcuady@gmail.com`. Tracker: [`ADMIN-DAILY-OPS-TRACKER.md`](./ADMIN-DAILY-OPS-TRACKER.md).

**To:** Dexter / BrandTxt Support Team (reply in the existing thread)  
**From:** Malcolm Joaquin Cuady \<jcuady@gmail.com\>  
**Subject:** Re: (keep their thread subject) — IP update HAKUM — 180.191.244.237 + Vercel Static IPs

```
Hi Dexter,

Thank you again for whitelisting 180.190.249.189 under the HAKUM account on Aug 31.

Our office/dev outbound IP has changed (Globe Telecom — Bacoor area). From the same integration machine, api.ipify.org and our BrandTxt Balance/SendSMS calls now show:

  Current egress IP: 180.191.244.237

Balance and SendSMS both return ErrorCode 11 (Unauthorized IP address) from this IP.

Please whitelist 180.191.244.237 under HAKUM (Sender ID: HAKUM) so we can resume testing.

You may keep or remove 180.190.249.189 — it is no longer our live office egress. We only need 180.191.244.237 active for development right now.

Still using:
- https://app.brandtxt.io
- POST/GET /api/v2/Balance
- POST /api/v2/SendSMS
- Mobile format: 63XXXXXXXXXX (no leading 0)

### SMS use cases (updated)
Outbound only — we do not receive replies or run an SMS inbox:
- Queue / detailing booking status updates to customers
- Staff-initiated CRM / marketing / reminder broadcasts to customers

Note: we are no longer sending an owner daily sales summary by SMS after end-of-shift. That path stays in-app (web push) for our team.

### Production (Vercel + custom domain)
Our live app will run on Vercel serverless with a custom domain. Default Vercel outbound IPs are not fixed, so API-key auth alone cannot replace IP whitelisting on our side.

We will enable Vercel Static IPs (fixed egress) on the Hakum project and reply in this thread with those IP addresses once provisioned — same HAKUM account / Sender ID. Please confirm you can add those production IPs when we send them.

Please confirm once 180.191.244.237 is whitelisted. We will retest SendSMS immediately and report results.

Thanks,
Malcolm Joaquin Cuady (Joax)
Hakum Auto Care
jcuady@gmail.com
```

---

## After Dexter confirms

```bash
node scripts/check-busybee-egress.mjs
SEND_TEST_SMS=1 TEST_SMS_PHONE=09625294043 node scripts/check-busybee-egress.mjs
```

Expect `ok: true`, a MessageId, then handset DLR `DELIVRD`. If ErrorCode 11 again, office IP drifted — re-check and reply with the new IP.

---

## Vercel production — permanent setup (no bypass)

1. Hakum Vercel project → **Settings → Networking → Static IPs** ([docs](https://vercel.com/docs/networking/static-ips/getting-started)).
2. Copy assigned egress IP pair(s); reply to Dexter with the second template below.
3. Server env only: `BUSYBEE_API_BASE_URL`, `BUSYBEE_API_KEY`, `BUSYBEE_CLIENT_ID`, `BUSYBEE_SENDER_ID=HAKUM`. Do **not** set `ENABLE_OWNER_SMS` in production.
4. Redeploy; prove one customer reminder from the custom domain.

---

## Second follow-up (after Static IPs are assigned)

**Subject:** Re: … — additional whitelist IPs — HAKUM Vercel Static egress

```
Hi Dexter,

Following up on HAKUM (Sender ID: HAKUM).

Please also whitelist these Vercel Static egress IPs for production + preview
(custom domain on Vercel), same account:

  [IP 1]
  [IP 2]
  [add more if multiple regions]

Office/dev remains: 180.191.244.237 (we will notify if Globe drifts again).

Thanks,
Malcolm Joaquin Cuady
Hakum Auto Care
jcuady@gmail.com
```

Policy module: `src/lib/busybeeEgressPlan.js`.
