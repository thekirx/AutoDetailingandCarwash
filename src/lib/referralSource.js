/**
 * Where a detailing booking came from.
 * Talked to an employee stores the name and, when it matches, the staff id.
 */
export const REFERRAL_SOURCES = Object.freeze([
  { id: 'facebook_ads', label: 'Saw your Facebook ads' },
  { id: 'talked_to_employee', label: 'Talked to an employee' },
  { id: 'friend_referral', label: 'Referred by a customer' },
  { id: 'facebook_page', label: 'Inquiry on Facebook page' },
  { id: 'social_media', label: 'Social media' },
])

export const STAFF_REFERRAL = 'talked_to_employee'
export const FRIEND_REFERRAL = 'friend_referral'

const SOURCE_IDS = new Set(REFERRAL_SOURCES.map((row) => row.id))

export function referralSourceLabel(id) {
  return REFERRAL_SOURCES.find((row) => row.id === id)?.label || ''
}

/** "Mia Santos · Bacoor" for crew, "Mia Santos · Admin" when no branch is set. */
export function referralStaffOptionLabel(row = {}, branchNames = {}) {
  const name = String(row.full_name || '').trim()
  const slugs = [...new Set([...(row.branch_slugs || []), row.branch_slug].filter(Boolean))]
  const places = slugs.map((slug) => branchNames[slug] || slug)
  const place = places.join(', ')
  if (row.role === 'admin') return place ? `${name} · ${place} · Admin` : `${name} · Admin`
  return place ? `${name} · ${place}` : name
}

export function normalizeFriendCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
}

export function normalizeReferral({ source, name, staff = [] } = {}) {
  const referral_source = SOURCE_IDS.has(source) ? source : ''
  if (referral_source === FRIEND_REFERRAL) {
    const code = normalizeFriendCode(name)
    return { referral_source, referred_by_name: code || null, referred_by_staff_id: null }
  }
  if (referral_source !== STAFF_REFERRAL) {
    return { referral_source: referral_source || null, referred_by_name: null, referred_by_staff_id: null }
  }
  const typed = String(name || '').replace(/\s+/g, ' ').trim()
  const needle = typed.toLowerCase()
  const match = (staff || []).find((row) => {
    const full = String(row.full_name || '').trim().toLowerCase()
    const label = String(row.label || '').trim().toLowerCase()
    return full === needle || (label && label === needle)
  })
  return {
    referral_source,
    referred_by_name: match?.full_name || typed || null,
    referred_by_staff_id: match?.id || null,
  }
}

export const FRIEND_CODE_ACCOUNT_ERROR = 'Link this booking to a customer account before using a friend code.'

/** Empty when the booking may store a friend code. The database trigger repeats this sentence. */
export function friendCodeAccountError(fields = {}, customerId) {
  if (fields.referral_source !== FRIEND_REFERRAL) return ''
  if (customerId) return ''
  return FRIEND_CODE_ACCOUNT_ERROR
}

export function referralRequiredError(fields = {}) {
  if (!fields.referral_source) return 'Choose where you heard about Hakum.'
  if (fields.referral_source === STAFF_REFERRAL && !String(fields.referred_by_name || '').trim()) {
    return 'Choose an employee or type their name.'
  }
  if (fields.referral_source === FRIEND_REFERRAL && normalizeFriendCode(fields.referred_by_name).length < 4) {
    return "Enter your friend's referral code."
  }
  return ''
}

/** Ranked sources, then ranked staff names. Shares are of answered bookings, and of staff referrals. */
export function rankReferrals(rows = []) {
  const answered = (rows || []).filter((row) => SOURCE_IDS.has(row?.referral_source))
  const sourceCounts = new Map()
  const staffCounts = new Map()
  for (const row of answered) {
    sourceCounts.set(row.referral_source, (sourceCounts.get(row.referral_source) || 0) + 1)
    if (row.referral_source === STAFF_REFERRAL) {
      const name = String(row.referred_by_name || '').trim() || 'Unnamed'
      staffCounts.set(name, (staffCounts.get(name) || 0) + 1)
    }
  }
  const sources = [...sourceCounts.entries()]
    .map(([id, count]) => ({
      id,
      label: referralSourceLabel(id),
      count,
      share: answered.length ? count / answered.length : 0,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  const staffTotal = [...staffCounts.values()].reduce((sum, n) => sum + n, 0)
  const staff = [...staffCounts.entries()]
    .map(([name, count]) => ({
      name,
      count,
      share: staffTotal ? count / staffTotal : 0,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  return { sources, staff, answered: answered.length, total: (rows || []).length }
}
