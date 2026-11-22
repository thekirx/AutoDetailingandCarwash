/**
 * Map BusyBee /api/busybee health JSON into UI copy (CRM SMS panel & Super Admin Notifications).
 * Never dump raw provider blobs into the primary status line.
 */

export function extractBusybeeCredits(health) {
  if (!health?.ok) return null
  const raw =
    health.json?.Data?.[0]?.Credits ??
    health.json?.data?.[0]?.credits ??
    health.credits
  if (raw == null || String(raw).trim() === '') return null
  return String(raw).trim()
}

export function formatBusybeeBalance(health) {
  const raw = extractBusybeeCredits(health)
  if (!raw) return null
  const phpMatch = /^(?:PHP|₱)\s*([0-9]+(?:\.[0-9]+)?)$/i.exec(raw)
  if (phpMatch) {
    const amount = Number(phpMatch[1])
    if (Number.isFinite(amount)) {
      return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
  }
  return `${raw} credits`
}

export function busybeeProviderStatusLabel(health) {
  if (!health) return null
  if (health.ok) {
    const formatted = formatBusybeeBalance(health)
    return {
      tone: 'ok',
      text: formatted ? `Connected · ${formatted}` : 'Connected · balance ok',
    }
  }

  const code = Number(health.json?.ErrorCode ?? health.ErrorCode)
  if (code === 11) {
    return {
      tone: 'warn',
      text: 'IP not whitelisted on BrandTxt (ErrorCode 11) — check BrandTxt account settings.',
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
