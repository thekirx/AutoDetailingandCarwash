/**
 * Crew day card — typed Daily Sheet salary pool, current bay job, failed QA.
 * Snapshot numbers come from `crew_day_card_snapshot` (crew cannot SELECT daily_sheets).
 */

export function sheetSalaryPoolMinor(lines = []) {
  return (lines || []).reduce((sum, line) => {
    if (String(line?.kind || '') !== 'salary') return sum
    const n = Number(line?.amount_minor)
    return sum + (Number.isFinite(n) ? n : 0)
  }, 0)
}

export function pickCurrentAssignment(rows = []) {
  const list = Array.isArray(rows) ? rows : []
  const active = list.find((r) => String(r?.status || '') === 'active')
  if (active) return active
  return list.find((r) => String(r?.status || '') === 'pending') || null
}

export function formatCurrentCarLine(car) {
  if (!car) return 'No car assigned right now'
  const plate = String(car.vehicle_plate || '').trim()
  const service = String(car.service_name || car.task_name || '').trim()
  const qn = car.queue_number != null && car.queue_number !== '' ? `#${car.queue_number}` : ''
  const bits = [qn, plate, service].filter(Boolean)
  return bits.length ? bits.join(' · ') : 'Assigned job (details loading)'
}
