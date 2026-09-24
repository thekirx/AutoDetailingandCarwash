/**
 * Production SMS egress plan for BrandTxt (BusyBee).
 * Pure: no network. Used by docs + ops scripts.
 *
 * Permanent rule: BrandTxt requires the HTTP caller egress IP on their whitelist.
 * Vercel Functions use rotating public IPs unless Static IPs are enabled.
 * There is no client-side or API-key-only bypass in our stack.
 */
export function brandTxtRequiresIpWhitelist() {
  return true
}

/** @typedef {'office_dev' | 'vercel_static' | 'dedicated_relay'} EgressSource */

/**
 * @returns {{
 *   product: string,
 *   outboundOnly: true,
 *   noOwnerSms: true,
 *   noInboundReplies: true,
 *   bypassExists: false,
 *   permanentFix: string,
 *   sources: Array<{ id: EgressSource, purpose: string, required: boolean }>
 * }}
 */
export function productionSmsEgressPlan() {
  return {
    product: 'Hakum Auto Care',
    outboundOnly: true,
    noOwnerSms: true,
    noInboundReplies: true,
    bypassExists: false,
    permanentFix:
      'Whitelist every fixed egress IP that will call app.brandtxt.io (office/dev + Vercel Static IPs, or a dedicated SMS relay with a static IP).',
    sources: [
      {
        id: 'office_dev',
        purpose: 'Local npm scripts / QA (IP drifts — re-check with check-busybee-egress.mjs)',
        required: true,
      },
      {
        id: 'vercel_static',
        purpose: 'Production + Preview serverless SendSMS from the Hakum Vercel project',
        required: true,
      },
      {
        id: 'dedicated_relay',
        purpose: 'Optional: small always-on host with static IP if Static IPs are unavailable',
        required: false,
      },
    ],
  }
}

/** Stable list of IPs to put in the BrandTxt email once known. */
export function formatWhitelistRequestIps({ officeIps = [], vercelStaticIps = [], relayIps = [] } = {}) {
  const rows = []
  for (const ip of officeIps) rows.push({ ip: String(ip).trim(), role: 'office_dev' })
  for (const ip of vercelStaticIps) rows.push({ ip: String(ip).trim(), role: 'vercel_static' })
  for (const ip of relayIps) rows.push({ ip: String(ip).trim(), role: 'dedicated_relay' })
  return rows.filter((r) => r.ip)
}
