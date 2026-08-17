import { normalizePlate, phoneDigits } from './customerAuth.js'
import { splitCustomerName } from './phVehicles.js'

export const PLATE_SUGGEST_MIN = 3
export const PLATE_SUGGEST_LIMIT = 8

/** Prefix used for typeahead. Empty until 3 alnum chars; never a PH mobile. */
export function plateSuggestPrefix(value) {
  const plate = normalizePlate(value)
  if (plate.length < PLATE_SUGGEST_MIN) return ''
  if (phoneDigits(value).length >= 10) return ''
  return plate
}

export function rankPlateSuggestions(rows, typed) {
  const prefix = plateSuggestPrefix(typed)
  if (!prefix) return []
  return (rows || [])
    .filter((row) => normalizePlate(row.normalized_plate_number || row.plate_number).startsWith(prefix))
    .slice(0, PLATE_SUGGEST_LIMIT)
}

export function applyPlateSuggestion(form = {}, match) {
  if (!match) return form
  const names = splitCustomerName(match.customer_name || `${match.customer_first_name || ''} ${match.customer_last_name || ''}`)
  return {
    ...form,
    customer_id: match.customer_id || form.customer_id || '',
    vehicle_id: match.vehicle_id || match.id || form.vehicle_id || '',
    customer_name: match.customer_name || form.customer_name,
    customer_first_name: names.first || form.customer_first_name,
    customer_last_name: names.last || form.customer_last_name,
    customer_phone: match.customer_phone || match.phone || form.customer_phone,
    vehicle_plate: match.plate_number || form.vehicle_plate,
    vehicle_make: match.vehicle_make || form.vehicle_make,
    vehicle_model: match.vehicle_model || form.vehicle_model,
    vehicle_year: match.vehicle_year != null && match.vehicle_year !== '' ? String(match.vehicle_year) : form.vehicle_year,
    vehicle_color: match.vehicle_color || match.color || form.vehicle_color,
    vehicle_type: match.vehicle_type || form.vehicle_type,
  }
}
