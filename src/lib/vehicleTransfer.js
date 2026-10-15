import { canonicalPhMobile } from './customerAuth.js'

export const EXISTING_HISTORY_MESSAGE = 'You have existing history with us.'

export const HISTORY_ATTACH_WARNING =
  'Your account is ready, but we could not attach your earlier visits. Ask the shop to link them.'

const TRANSFER_ROLES = new Set(['BossMich', 'assistant_super_admin', 'admin'])

export function canTransferVehicle(profile) {
  return TRANSFER_ROLES.has(profile?.role)
}

/** Queue and CRM store 09… and 63… for the same handset. */
export function phoneVariants(phone) {
  const local = canonicalPhMobile(phone)
  const out = new Set()
  if (local) out.add(local)
  if (local.startsWith('0') && local.length >= 11) out.add(`63${local.slice(1)}`)
  return [...out]
}

/** Stored queue phones may contain spaces, dashes, or a leading plus. */
export function sameHandset(stored, signupPhone) {
  const left = canonicalPhMobile(stored)
  const right = canonicalPhMobile(signupPhone)
  return Boolean(left) && left.length >= 11 && left === right
}

/** Digit regex so "0917 123 4567" still matches 09171234567. */
export function handsetMatchPattern(phone) {
  const local = canonicalPhMobile(phone)
  const digits = local.startsWith('0') ? local.slice(1) : local
  if (digits.length < 10) return ''
  return digits.split('').join('\\D*')
}

export function historySignupFlags({ count = 0, error = null } = {}) {
  if (error) return { existing_history: false, history_warning: HISTORY_ATTACH_WARNING }
  return { existing_history: Number(count) > 0, history_warning: '' }
}

/**
 * One plate row per account. Extra unowned rows are archived, not copied.
 * action: refresh | claim | insert | refuse
 */
export function garagePlatePlan({ rows = [], customerId } = {}) {
  const list = Array.isArray(rows) ? rows : []
  if (list.some((row) => row.customer_id && row.customer_id !== customerId)) {
    return { action: 'refuse', message: 'That plate is already linked to another Hakum account.' }
  }
  const own = list.find((row) => row.customer_id === customerId)
  const unowned = list.filter((row) => !row.customer_id)
  if (own) return { action: 'refresh', id: own.id, archiveIds: unowned.map((row) => row.id) }
  if (unowned.length) {
    return { action: 'claim', id: unowned[0].id, archiveIds: unowned.slice(1).map((row) => row.id) }
  }
  return { action: 'insert' }
}

/** A unique clash is a race. Read the rows again and claim or refuse. Never report success. */
export function plateInsertRecovery(error, rows, customerId) {
  if (error?.code !== '23505') {
    return { action: 'throw', message: error?.message || 'Could not save this plate.' }
  }
  const plan = garagePlatePlan({ rows, customerId })
  if (plan.action === 'insert') return { action: 'throw', message: 'That plate is already on file.' }
  return plan
}

export function maintenanceOwnerPatch(customer) {
  return {
    customer_id: customer?.id || null,
    customer_name: customer?.full_name || '',
    customer_phone: customer?.phone || '',
  }
}

/** SA and ASA move any car. A Branch Admin moves a car with a visit at their branch, or a car with no visits yet. */
export function transferBranchRefusal({ role, branchSlugs, visitBranches } = {}) {
  if (role === 'BossMich' || role === 'assistant_super_admin') return ''
  const visits = [...new Set((visitBranches || []).filter(Boolean))]
  if (!visits.length) return ''
  const allowed = new Set(branchSlugs || [])
  if (visits.some((branch) => allowed.has(branch))) return ''
  return 'This car has no visit at your branch.'
}

/**
 * Empty string means the transfer may proceed.
 * The new owner must already have a Hakum account (customer row + auth user).
 */
export function transferRefusal({ vehicle, toCustomer, toHasAuth } = {}) {
  if (!vehicle?.id) return 'Car not found.'
  if (!toCustomer || toCustomer.is_archived || !toHasAuth) {
    return 'The new owner needs a Hakum account before this car can move.'
  }
  if (vehicle.customer_id && vehicle.customer_id === toCustomer.id) {
    return 'That person already owns this car.'
  }
  return ''
}
