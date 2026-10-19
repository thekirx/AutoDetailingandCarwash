/**
 * Detailing booking SMS.
 * Customer sheet: landing-page request, date still tentative.
 * Crew sheet: BA, TL, or Sales booked it, or they set the final date.
 * Name is for SMS / push / in-app notice only — not the counter voice.
 */
import { smsCarLabel, smsCustomerName } from './queueStatusSms.js'

const CUSTOMER_LINES = [
  "Hi {FirstName}! Thank you for choosing Hakum Auto Care. We received your booking for {Service} on your {Car}, tentatively on {Date}. Our customer representative will contact you shortly to confirm your schedule. Salamat po!",
  "Hello {FirstName}, thanks for choosing Hakum! Your {Service} booking for your {Car} is received, tentatively set for {Date}. One of our customer representatives will reach out to confirm your schedule. Thank you!",
  "Hi {FirstName}! We're glad you chose Hakum Auto Care. Your {Car} is tentatively booked for {Service} on {Date}. Our customer representative will be in touch soon to confirm your schedule. Salamat po!",
  "Good day {FirstName}! Thank you for booking with Hakum. We've noted {Service} for your {Car} on {Date} (tentative). A customer representative will contact you to confirm the schedule. Thank you po!",
  "Thank you for trusting Hakum Auto Care, {FirstName}! We got your request for {Service} on your {Car}, tentatively {Date}. Our customer representative will call or text soon to confirm your schedule. Salamat po!",
]

const CREW_LINES = [
  "Hi {FirstName}! Thank you for choosing Hakum Auto Care. Your {Service} for your {Car} is confirmed on {Date}. We look forward to seeing you. Salamat po!",
  "Hello {FirstName}! Your booking is confirmed. We'll take care of your {Car} for {Service} on {Date}. Thank you for trusting Hakum Auto Care!",
  "Good day {FirstName}! This is to confirm your {Service} appointment for your {Car} on {Date}. We can't wait to serve you. Salamat po!",
  "Hi {FirstName}, you're all set! Your {Car} is booked for {Service} on {Date}. Thank you for choosing Hakum, we'll see you then!",
  "Thank you for booking with Hakum Auto Care, {FirstName}! Your {Service} for your {Car} is scheduled and confirmed for {Date}. See you soon, salamat po!",
]

function smsToken(value, max = 48) {
  return String(value || '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export function detailingScheduleLabel(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 'the date we have on file'
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function renderDetailingBookingSms(kind, booking = {}, random = Math.random) {
  const pool = kind === 'crew' ? CREW_LINES : CUSTOMER_LINES
  const roll = Number(random())
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor((Number.isFinite(roll) ? roll : 0) * pool.length)))
  const first = smsCustomerName(booking) || 'there'
  const car = smsCarLabel(booking)
  const service = smsToken(booking.service_name || booking.services?.name || 'detailing', 40)
  const when = detailingScheduleLabel(booking.scheduled_start)
  let text = pool[index]
    .replaceAll('{FirstName}', first)
    .replaceAll('{Car}', car)
    .replaceAll('{Service}', service)
    .replaceAll('{Date}', when)
  const specialist = smsToken(booking.specialist_name, 40)
  if (kind === 'crew' && specialist) text += ` Your specialist is ${specialist}.`
  return text.replace(/\s{2,}/g, ' ').trim()
}

export const DETAILING_REMINDER_DAYS = [7, 3, 1]

export function renderDetailingReminderSms(booking, days) {
  const first = smsCustomerName(booking) || 'there'
  const car = smsCarLabel(booking)
  const service = smsToken(booking.service_name || booking.services?.name || 'detailing', 40)
  const when = detailingScheduleLabel(booking.scheduled_start)
  const left = days === 1 ? 'tomorrow' : `in ${days} days`
  return `Hi ${first}! Reminder: your ${service} for your ${car} at Hakum is ${left} (${when}). Reply is not needed — just come on that schedule.`
}
