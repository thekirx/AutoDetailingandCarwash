import { normalizePlate, plateValidationError } from './customerAuth.js'

/**
 * Customer garage: add is insert; change-plate updates the same vehicle row.
 * occupantVehicleId = vehicles.id that already owns the next normalized plate (if any).
 */
export function prepareGaragePlateChange({
  vehicleId,
  currentPlate,
  nextPlate,
  occupantVehicleId = null,
} = {}) {
  if (!String(vehicleId || '').trim()) {
    return { ok: false, error: 'vehicle_id required.', status: 400 }
  }
  const plateError = plateValidationError(nextPlate)
  if (plateError) return { ok: false, error: plateError, status: 400 }

  const nextNorm = normalizePlate(nextPlate)
  const currentNorm = normalizePlate(currentPlate)
  const occupant = occupantVehicleId ? String(occupantVehicleId) : ''
  if (occupant && occupant !== String(vehicleId)) {
    return { ok: false, error: 'This plate is already linked to another account.', status: 409 }
  }

  return {
    ok: true,
    plate_number: String(nextPlate).trim().toUpperCase(),
    normalized_plate_number: nextNorm,
    plateChanged: nextNorm !== currentNorm,
  }
}
