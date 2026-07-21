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
