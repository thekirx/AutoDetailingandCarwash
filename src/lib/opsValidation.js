/** Shared ops CRUD validation — used by adminApi + tests. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const BRANCH_CODE_RE = /^[A-Z]{2,5}$/
const EDITABLE_ROLES = new Set(['admin', 'team_lead', 'staff', 'cashier', 'marketing', 'sales'])

export function validateBranchInput({ name, slug, code, address }, { requireSlug = true } = {}) {
  const errors = []
  const trimmedName = String(name || '').trim()
  if (!trimmedName) errors.push('Branch name is required.')
  const normalizedSlug = String(slug || '').trim().toLowerCase()
  if (requireSlug) {
    if (!normalizedSlug) errors.push('Branch slug is required.')
    else if (!SLUG_RE.test(normalizedSlug)) errors.push('Slug must be lowercase and URL-safe (e.g. imus).')
  }
  const normalizedCode = String(code || '').trim().toUpperCase()
  if (!BRANCH_CODE_RE.test(normalizedCode)) errors.push('Code must be 2–5 uppercase letters.')
  if (errors.length) throw new Error(errors[0])
  return {
    name: trimmedName,
    slug: normalizedSlug,
    code: normalizedCode,
    address: String(address || '').trim(),
  }
}

export function validateServiceInput({ name, slug, price, duration_minutes, display_order }) {
  const errors = []
  const trimmedName = String(name || '').trim()
  if (!trimmedName) errors.push('Service name is required.')

  let normalizedSlug = String(slug || '').trim().toLowerCase()
  if (!normalizedSlug) {
    normalizedSlug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }
  if (!normalizedSlug || !SLUG_RE.test(normalizedSlug)) {
    errors.push('Service slug must be lowercase and URL-safe.')
  }

  const priceNum = Number(price)
  if (!Number.isFinite(priceNum) || priceNum < 0) errors.push('Price must be a number 0 or greater.')

  const duration = Number(duration_minutes)
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isInteger(duration)) {
    errors.push('Duration must be a whole number of minutes greater than 0.')
  }

  const order = display_order == null || display_order === '' ? 0 : Number(display_order)
  if (!Number.isFinite(order) || order < 0) errors.push('Display order must be 0 or greater.')

  if (errors.length) throw new Error(errors[0])
  return {
    name: trimmedName,
    slug: normalizedSlug,
    price_minor: Math.round(priceNum * 100),
    duration_minutes: duration,
    display_order: order,
  }
}

export function validateStaffUpdate({ id, full_name, role, branch_slug, phone }) {
  if (!id) throw new Error('Staff id is required.')
  if (role === 'BossMich') throw new Error('Cannot reassign Super Admin via this form.')
  const name = String(full_name || '').trim()
  if (!name) throw new Error('Full name is required.')
  if (role && !EDITABLE_ROLES.has(role)) throw new Error(`Role "${role}" cannot be assigned here.`)
  if (['admin', 'team_lead', 'staff', 'cashier', 'marketing', 'sales'].includes(role) && !branch_slug) {
    throw new Error('Branch is required for this role.')
  }
  const phoneDigits = String(phone || '').replace(/\D/g, '')
  if (phone && phoneDigits.length > 0 && phoneDigits.length < 10) {
    throw new Error('Phone must have at least 10 digits.')
  }
  return {
    id,
    full_name: name,
    role,
    branch_slug: branch_slug || null,
    phone: phone?.trim() || null,
  }
}

export function validateMembershipTierInput({
  name,
  starting_price,
  discount_percent,
  loyalty_multiplier,
  benefits,
  included_services,
}) {
  const trimmedName = String(name || '').trim()
  if (!trimmedName) throw new Error('Tier name is required.')

  const priceNum = Number(starting_price)
  if (!Number.isFinite(priceNum) || priceNum < 0) throw new Error('Starting price must be 0 or greater.')

  const discount = Number(discount_percent)
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
    throw new Error('Discount must be between 0 and 100.')
  }

  const multiplier = Number(loyalty_multiplier)
  if (!Number.isFinite(multiplier) || multiplier < 0 || multiplier > 10) {
    throw new Error('Loyalty multiplier must be between 0 and 10.')
  }

  const benefitList = Array.isArray(benefits)
    ? benefits.map((b) => String(b).trim()).filter(Boolean)
    : String(benefits || '')
        .split(/[\n,]/)
        .map((b) => b.trim())
        .filter(Boolean)

  const includedList = Array.isArray(included_services)
    ? included_services.map((s) => String(s).trim()).filter(Boolean)
    : String(included_services || '')
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean)

  return {
    name: trimmedName,
    starting_price_minor: Math.round(priceNum * 100),
    discount_percent: discount,
    loyalty_multiplier: multiplier,
    benefits: benefitList,
    included_services: includedList,
  }
}

export function validateLoyaltyMilestoneInput({ threshold_points, reward_label, reward_description, sort_order }) {
  const threshold = Number(threshold_points)
  if (!Number.isFinite(threshold) || threshold <= 0 || !Number.isInteger(threshold)) {
    throw new Error('Threshold must be a whole number greater than 0.')
  }
  const label = String(reward_label || '').trim()
  if (!label) throw new Error('Reward label is required.')
  const order = sort_order == null || sort_order === '' ? 0 : Number(sort_order)
  if (!Number.isFinite(order) || order < 0) throw new Error('Sort order must be 0 or greater.')
  return {
    threshold_points: threshold,
    reward_label: label,
    reward_description: String(reward_description || '').trim() || null,
    sort_order: order,
  }
}

export function validateLoyaltyProgramSettings({ card_slots }) {
  const slots = Number(card_slots)
  if (!Number.isFinite(slots) || slots < 5 || slots > 50 || !Number.isInteger(slots)) {
    throw new Error('Card slots must be a whole number between 5 and 50.')
  }
  return { card_slots: slots }
}

export function validateServiceLoyaltyWeight(weight) {
  const n = Number(weight)
  if (!Number.isFinite(n) || n < 0 || n > 100 || !Number.isInteger(n)) {
    throw new Error('Loyalty score must be a whole number from 0 to 100.')
  }
  return n
}

export function validateProvisionStaffInput({ email, full_name, role, branch_slug, phone }) {
  const trimmedEmail = String(email || '').trim().toLowerCase()
  if (!EMAIL_RE.test(trimmedEmail)) throw new Error('Valid email is required.')
  const name = String(full_name || '').trim()
  if (!name) throw new Error('Full name is required.')
  if (!EDITABLE_ROLES.has(role)) throw new Error(`Role "${role}" is not allowed.`)
  if (['admin', 'team_lead', 'staff', 'cashier', 'marketing', 'sales'].includes(role) && !branch_slug) {
    throw new Error('Branch is required for this role.')
  }
  const phoneDigits = String(phone || '').replace(/\D/g, '')
  if (phone && phoneDigits.length > 0 && phoneDigits.length < 10) {
    throw new Error('Phone must have at least 10 digits.')
  }
  return {
    email: trimmedEmail,
    full_name: name,
    role,
    branch_slug: branch_slug || null,
    phone: phone?.trim() || null,
  }
}
