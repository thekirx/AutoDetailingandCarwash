/**
 * Map BusyBee /api/busybee health JSON into UI copy (CRM SMS panel).
 * Never dump raw provider blobs into the primary status line.
 */

export function busybeeProviderStatusLabel(health) {
  if (!health) return null
  if (health.ok) {
    const credits =
      health.json?.Data?.[0]?.Credits ??
      health.json?.data?.[0]?.credits ??
      health.credits
    return {
      tone: 'ok',
      text:
        credits != null && credits !== ''
          ? `Connected · ${credits} credits`
          : 'Connected · balance ok',
    }
  }

  const code = Number(health.json?.ErrorCode ?? health.ErrorCode)
  if (code === 11) {
    return {
      tone: 'warn',
      text: 'IP not whitelisted on BrandTxt — ask BusyBee to add this machine’s egress IP (or keep shop SMS off).',
    }
  }
  if (code === 429 || health.status === 429 || health.http === 429) {
    return { tone: 'warn', text: 'BusyBee rate-limited — try again in a minute.' }
  }

  const detail =
    health.json?.ErrorDescription ||
    health.providerResponse ||
    health.error ||
    (health.http ? `HTTP ${health.http}` : null)

  return {
    tone: 'error',
    text: detail
      ? `BusyBee unreachable — ${String(detail).slice(0, 160)}`
      : 'BusyBee unreachable — check BUSYBEE_API_BASE_URL and credentials.',
  }
}
