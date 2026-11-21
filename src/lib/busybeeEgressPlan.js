/**
 * Production SMS egress plan for BrandTxt (BusyBee).
 * Pure: no network. Used by docs + ops scripts.
 *
 * BrandTxt removed IP whitelisting on the HAKUM account (direct API key + ClientId
 * auth from local and dynamic serverless hosts). Keep bypassExists = false and
 * outbound-only / status-updates-only customer SMS rules intact.
 */
export function brandTxtRequiresIpWhitelist() {
  return false
}

/** @typedef {'office_dev' | 'vercel_static' | 'dedicated_relay'} EgressSource */

/**
 * @returns {{
 *   product: string,
 *   outboundOnly: true,
 *   statusUpdatesOnly: true,
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
    statusUpdatesOnly: true,
    noOwnerSms: true,
    noInboundReplies: true,
    bypassExists: false,
    permanentFix:
      'IP whitelisting is no longer required on account HAKUM; keep BUSYBEE_API_KEY and BUSYBEE_CLIENT_ID set in .env and Vercel Environment Variables.',
    sources: [
      {
        id: 'office_dev',
        purpose: 'Local npm scripts / QA balance check (direct BrandTxt HTTPS)',
        required: false,
      },
      {
        id: 'vercel_static',
        purpose: 'Production + Preview serverless SendSMS from Hakum Vercel project',
        required: false,
      },
      {
        id: 'dedicated_relay',
        purpose: 'Optional: dedicated SMS relay if egress pinning is ever re-enabled',
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
