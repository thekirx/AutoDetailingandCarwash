/** Crew “my advances” list helpers (Michi C1). */

/** Pesos field on the cash_advance form → display minor when needed. */
export function cashAdvanceAmountMinor(payload = {}) {
  const raw = payload?.amount ?? payload?.amount_pesos ?? payload?.amount_php
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 0
  // Form stores pesos; values ≥ 1000 with no decimals are still pesos.
  return Math.round(n * 100)
}

export function cashAdvanceStatusMeta(row = {}) {
  const status = String(row.status || '').toLowerCase()
  const code = String(row.payload?.approval_code || '').trim()
  if (status === 'archived') {
    return { id: 'declined', label: 'Declined', tone: 'outline' }
  }
  if (status === 'resolved' && code) {
    return { id: 'approved', label: 'Approved', tone: 'secondary', code }
  }
  if (status === 'resolved') {
    return { id: 'approved', label: 'Approved', tone: 'secondary' }
  }
  return { id: 'pending', label: 'Waiting for approval', tone: 'outline' }
}

export function formatCashAdvancePesos(payload = {}) {
  const minor = cashAdvanceAmountMinor(payload)
  return `₱${(minor / 100).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}
