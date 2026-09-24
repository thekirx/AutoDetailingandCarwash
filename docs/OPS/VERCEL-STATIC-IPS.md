# Vercel Static IPs — Hakum production SMS egress

**Permanent rule:** BrandTxt whitelists **fixed egress IPs**. Default Vercel Functions use rotating IPs → ErrorCode 11 in production unless Static IPs (or a dedicated relay) are used. See `src/lib/busybeeEgressPlan.js`.

Docs: [Static IPs](https://vercel.com/docs/networking/static-ips) · [Getting started](https://vercel.com/docs/networking/static-ips/getting-started)

## Status (2026-09-24 this CLI)

| Check | Result |
|-------|--------|
| Repo `.vercel/` link | **Missing** |
| Hakum project on linked Vercel account | **Not found** (projects listed: bits-landing, beepabpo, kado-kohi, offgrid-lifestyle, meridianops*, portfolio*, … — no Hakum / Auto Care) |
| Static IPs enabled | **Blocked** until Hakum project is accessible on the deploying team |
| BrandTxt whitelist of Vercel IPs | **Blocked** until Static IPs assigned |

## Enable (on the Hakum Vercel team)

1. Sign in to the team that hosts Hakum Auto Care (not necessarily `jcuadys-projects`).
2. Open the Hakum project → **Settings → Networking → Static IPs**.
3. Requires **Pro or Enterprise** (~$100/mo per project + private data transfer).
4. Pick region(s) closest to BrandTxt / PH (up to 3). Copy the assigned **egress IP pair(s)**.
5. Paste IPs into the table below.
6. Reply to Dexter with the “Second follow-up” template in [`BUSYBEE-BRANDTXT-REQUEST.md`](./BUSYBEE-BRANDTXT-REQUEST.md).
7. Confirm server env (never `VITE_*`): `BUSYBEE_API_BASE_URL`, `BUSYBEE_API_KEY`, `BUSYBEE_CLIENT_ID`, `BUSYBEE_SENDER_ID=HAKUM`. Do **not** set `ENABLE_OWNER_SMS`.
8. Redeploy; prove one customer reminder from the custom domain.

## Assigned Static IPs (fill when provisioned)

| Region | IP 1 | IP 2 | BrandTxt notified |
|--------|------|------|-------------------|
| _pending_ | | | [ ] |

## Optional relay (if Static IPs not purchased)

Host a small always-on proxy with one static IP that only forwards Balance/SendSMS with server secrets. Whitelist that single IP on BrandTxt. Same permanent rule: fixed egress + whitelist.

## Link this repo

```bash
npx vercel link
# select the Hakum team + project, then re-run Static IPs steps
```
