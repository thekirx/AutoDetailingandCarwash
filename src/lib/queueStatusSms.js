/**
 * Customer SMS for floor statuses. Name is SMS-only: the counter voice never says it.
 * A real booking or CRM name is filled in; walk-in placeholders are left out.
 * Each send picks one of 20 lines so repeats are not the same text.
 */
import { isWalkInCustomerName } from './queueCustomerName.js'
import { splitCustomerName } from './phVehicles.js'
import { QUEUE_STATUS_SMS } from './queueStatusSmsTemplates.js'

const SMS_TOKEN_MAX = 40

export function preferStoredCustomerName(bookingName, crmName) {
  const booking = String(bookingName || '').trim()
  const crm = String(crmName || '').trim()
  if (booking && !isWalkInCustomerName(booking)) return booking
  if (crm && !isWalkInCustomerName(crm)) return crm
  return booking
}

function smsToken(value) {
  return String(value || '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SMS_TOKEN_MAX)
}

/** First name for the greeting. Empty when the ticket is still a walk-in label. */
export function smsCustomerName(booking = {}) {
  const joined = Array.isArray(booking.customers) ? booking.customers[0] : booking.customers
  const full = preferStoredCustomerName(booking.customer_name, joined?.full_name)
  if (!full || isWalkInCustomerName(full)) return ''
  return smsToken(splitCustomerName(full).first || full)
}

/** {Car}: make + model, else plate, else "vehicle". */
export function smsCarLabel(booking = {}) {
  const make = smsToken(booking.vehicle_make)
  const model = smsToken(booking.vehicle_model)
  const car = [make, model].filter(Boolean).join(' ').slice(0, SMS_TOKEN_MAX)
  if (car) return car
  const plate = smsToken(booking.vehicle_plate)
  return plate || 'vehicle'
}

/** Drop {Name} without leaving "Hi !" or a walk-in label. */
export function omitSmsName(message) {
  let text = String(message)
    .replace(/,\s*\{Name\}/g, '')
    .replace(/\{Name\},?\s*/g, '')
  text = text
    .replace(/^(Hi|Hello|Good day|Good news)\s*!?\s*/i, '')
    .replace(/^(Hi|Hello)\s+(?=[a-z])/i, '')
    .replace(/,\s*!/g, '!')
    .replace(/\s+([!,.])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/^([a-z])/, (letter) => letter.toUpperCase())
    .trim()
  return text
}

export function renderQueueStatusSms(status, booking = {}, random = Math.random) {
  const pool = QUEUE_STATUS_SMS[status]
  if (!pool?.length) return null
  const roll = Number(random())
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor((Number.isFinite(roll) ? roll : 0) * pool.length)))
  const name = smsCustomerName(booking)
  const car = smsCarLabel(booking)
  let text = pool[index]
  if (text.includes('{Name}')) text = name ? text.replaceAll('{Name}', name) : omitSmsName(text)
  if (text.includes('{Car}')) text = text.replaceAll('{Car}', car)
  if (status === 'for_payment' && name) text = `Hi ${name}! ${text}`
  return text.replace(/\s{2,}/g, ' ').trim()
}
