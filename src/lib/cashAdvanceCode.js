/** Approval code for a cash advance. CA + 4 characters, no 0/O/1/I. */
export function normalizeCashAdvanceCode(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

const CODE = /^CA[A-Z0-9]{4}$/

/**
 * Null when this line may be saved. A given-out line with an amount must match
 * one approved request for this branch and the same centavos.
 */
export function cashAdvanceReleaseError(line, requests = [], { branch = '', lines = [] } = {}) {
  if (line?.kind !== 'ca_release') return null
  const amount = Number(line.amount_minor) || 0
  if (amount <= 0) return null
  const code = normalizeCashAdvanceCode(line.reason)
  if (!CODE.test(code)) return 'Type the approval code before cash leaves the drawer.'
  const dup = lines.some(
    (other) =>
      other !== line &&
      other?.kind === 'ca_release' &&
      (Number(other.amount_minor) || 0) > 0 &&
      normalizeCashAdvanceCode(other.reason) === code,
  )
  if (dup) return 'That approval code is already on this sheet.'
  const hit = requests.find(
    (row) => row?.status === 'resolved' && normalizeCashAdvanceCode(row.payload?.approval_code) === code,
  )
  const site = String(hit?.payload?.branch || '').toLowerCase()
  const expected = Math.round(Number(hit?.payload?.amount || 0) * 100)
  if (!hit || (site && site !== String(branch || '').toLowerCase()) || expected !== amount) {
    return 'That approval code does not match an approved cash advance for this branch and amount.'
  }
  return null
}
