/** Human-readable audit detail from summary + meta (Part 8). */

function peso(minor) {
  const n = Number(minor)
  if (!Number.isFinite(n)) return null
  return `₱${(n / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Prefer stored summary; enrich when meta has known keys.
 * Examples: deleted vehicle plate, deducted sales amount.
 */
export function formatAuditDetail(row = {}) {
  const summary = String(row.summary || '').trim()
  const meta = row.meta && typeof row.meta === 'object' ? row.meta : {}
  const action = String(row.action || '')
  const entity = String(row.entity_type || '')

  if (meta.plate || meta.vehicle_plate) {
    const plate = meta.plate || meta.vehicle_plate
    if (/delete|archiv/i.test(action) || /delete|archiv/i.test(summary)) {
      return summary.includes(plate) ? summary : `Deleted vehicle ${plate}${summary ? ` — ${summary}` : ''}`
    }
  }

  if (meta.amount_minor != null || meta.total_minor != null || meta.deducted_minor != null) {
    const label = peso(meta.deducted_minor ?? meta.amount_minor ?? meta.total_minor)
    if (label && (/deduct|void|adjust|sale/i.test(action) || /deduct|void|sales/i.test(summary))) {
      return summary.includes('₱') ? summary : `Deducted sales ${label}${summary ? ` — ${summary}` : ''}`
    }
  }

  if (meta.expense_title && /expense/i.test(entity + action)) {
    return summary || `${action} expense “${meta.expense_title}”`
  }

  if (action === 'pos.sale' || entity === 'sale') {
    const label = peso(meta.total_minor)
    if (label && !summary.includes('₱')) return `${summary || 'POS sale'} · ${label}`
  }

  if (summary) return summary
  return `${action || 'event'} on ${entity || 'record'}${row.entity_id ? ` (${row.entity_id})` : ''}`
}
