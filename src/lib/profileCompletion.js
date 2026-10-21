/**
 * Customer profile completion — Home card + Me checklist (approved 2026-10-17,
 * design-mocks/birthday-profile-referral-2026-10-17 board 02).
 * Pure: works on the profile + vehicles that /api/customer-portal already returns.
 */
import { isSyntheticCustomerEmail } from './customerOnboarding.js'
import { BIRTHDAY_GIFT_LABEL } from './birthdayPerk.js'

const MORE = '/account/more'

function hasText(value) {
  return String(value ?? '').trim().length > 0
}

/** Step definitions in display order. `next` picks from NEXT_ORDER instead. */
export const PROFILE_STEPS = [
  { id: 'basics', label: 'Name & phone', hint: '' },
  {
    id: 'car',
    label: 'A car in My cars',
    hint: 'Queue tracking and one-tap booking',
    action: 'Add car',
    nextLine: 'Next: add your car — booking and queue tracking become one tap.',
  },
  {
    id: 'car_details',
    label: 'Car make & model',
    hint: 'The right size price at the counter',
    action: 'Add details',
    nextLine: 'Next: add your car’s make and model — for the right size price.',
  },
  {
    id: 'birthday',
    label: 'Birthday',
    hint: `Unlocks the ${BIRTHDAY_GIFT_LABEL} on your day`,
    action: 'Add birthday',
    nextLine: `Next: add your birthday — ${BIRTHDAY_GIFT_LABEL} on your day.`,
  },
  {
    id: 'email',
    label: 'Real email',
    hint: 'For receipts and password resets',
    action: 'Add email',
    nextLine: 'Next: add a real email — for receipts and password resets.',
  },
]

const NEXT_ORDER = ['birthday', 'email', 'car', 'car_details']

function stepDone(id, profile, vehicles) {
  switch (id) {
    case 'basics':
      return hasText(profile?.full_name) && hasText(profile?.phone)
    case 'car':
      return vehicles.length > 0
    case 'car_details':
      return vehicles.length > 0 && vehicles.every((v) => hasText(v.vehicle_make) && hasText(v.vehicle_model))
    case 'birthday':
      return hasText(profile?.date_of_birth)
    case 'email':
      return hasText(profile?.email) && !isSyntheticCustomerEmail(profile.email)
    default:
      return false
  }
}

function stepLink(id, vehicles) {
  switch (id) {
    case 'car':
      return `${MORE}?tab=garage&add=1`
    case 'car_details': {
      const missing = vehicles.find((v) => !hasText(v.vehicle_make) || !hasText(v.vehicle_model))
      return missing?.id ? `${MORE}?tab=garage&vehicle=${missing.id}` : `${MORE}?tab=garage`
    }
    case 'birthday':
      return `${MORE}?tab=account#birthday`
    case 'email':
      return `${MORE}?tab=account#email`
    default:
      return `${MORE}?tab=account`
  }
}

/** → { steps, done, total, percent, complete, next } — next is the first undone step in NEXT_ORDER, or null. */
export function profileCompletion(profile, vehicles) {
  const cars = (vehicles || []).filter(Boolean)
  const steps = PROFILE_STEPS.map((step) => ({
    ...step,
    done: stepDone(step.id, profile, cars),
    to: stepLink(step.id, cars),
  }))
  const done = steps.filter((s) => s.done).length
  const total = steps.length
  const nextId = NEXT_ORDER.find((id) => !steps.find((s) => s.id === id)?.done)
  return {
    steps,
    done,
    total,
    percent: Math.round((done / total) * 100),
    complete: done === total,
    next: nextId ? steps.find((s) => s.id === nextId) : null,
  }
}
