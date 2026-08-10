/**
 * Ops customer History API — plate / phone ledger (bookings + maintenance + POS sales).
 * Branch Admin / TL: scoped to their branch(es). SA / ASA / Sales / Marketing: all branches.
 */
import { createClient } from '@supabase/supabase-js'
import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'
import {
  HISTORY_ROLES,
  buildHistoryTimeline,
  classifyHistoryQuery,
  normalizeHistoryPlate,
  phoneMatchKey,
  platesMatch,
  phonesMatch,
  summarizeHistoryIdentity,
} from '../src/lib/customerHistory.js'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function resolveBranchScope(db, staff) {
  if (['BossMich', 'assistant_super_admin', 'sales', 'marketing'].includes(staff.role)) {
    return null
  }
  let branches = staff.branch_slug ? [staff.branch_slug] : []
  if (staff.role === 'admin') {
    const { data: assigns } = await db
      .from('staff_branch_assignments')
      .select('branch_slug')
      .eq('staff_id', staff.id)
    if (assigns?.length) branches = assigns.map((a) => a.branch_slug).filter(Boolean)
  }
  return branches.length ? branches : staff.branch_slug ? [staff.branch_slug] : []
}

function bookingMatchesQuery(row, classified) {
  if (classified.kind === 'phone' || classified.kind === 'mixed') {
    if (classified.phone && phonesMatch(row.customer_phone, classified.phone)) return true
  }
  if (classified.kind === 'plate' || classified.kind === 'mixed') {
    if (classified.plate && platesMatch(row.vehicle_plate, classified.plate)) return true
  }
  return false
}

function applyBranchFilter(query, branchSlugs) {
  if (branchSlugs == null) return query
  if (!branchSlugs.length) return query.eq('branch', '__none__')
  return query.in('branch', branchSlugs)
}

/**
 * GET/POST /api/customer-history
 * Body/query: { q, status?, kind?, limit? }
 */
export async function handleCustomerHistoryRequest(req, res) {
  setCors(res, 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' })
  }

  try {
    const token = bearer(req)
    if (!token) return json(res, 401, { error: 'Unauthorized' })

    const db = admin()
    const { data: userData, error: userErr } = await db.auth.getUser(token)
    if (userErr || !userData?.user) return json(res, 401, { error: 'Unauthorized' })

    const { data: staff } = await db
      .from('staff_profiles')
      .select('id, role, is_active, branch_slug, permission_grants')
      .eq('id', userData.user.id)
      .eq('is_active', true)
      .maybeSingle()
    if (!staff || !HISTORY_ROLES.includes(staff.role)) {
      return json(res, 403, { error: 'Forbidden' })
    }

    const body = req.method === 'POST' ? await readJsonBody(req) : {}
    const url = new URL(req.url || '/', 'http://localhost')
    const q = String(body.q ?? url.searchParams.get('q') ?? '').trim()
    const statusFilter = String(body.status ?? url.searchParams.get('status') ?? 'all')
    const limit = Math.min(200, Math.max(20, Number(body.limit || url.searchParams.get('limit') || 100) || 100))

    if (q.length < 3) {
      return json(res, 400, { error: 'Enter at least 3 characters of a plate or mobile number.' })
    }

    const classified = classifyHistoryQuery(q)
    if (
      (classified.kind === 'plate' && classified.plate.length < 3) ||
      (classified.kind === 'phone' && classified.phone.length < 7) ||
      (classified.kind === 'mixed' && classified.plate.length < 3 && classified.phone.length < 7)
    ) {
      return json(res, 400, { error: 'Use a fuller plate (3+) or mobile number (7+ digits).' })
    }

    const branchSlugs = await resolveBranchScope(db, staff)
    if (Array.isArray(branchSlugs) && branchSlugs.length === 0) {
      return json(res, 403, { error: 'No branch assigned for history search.' })
    }

    const bookingSelect =
      'id, customer_id, customer_name, customer_phone, vehicle_plate, vehicle_make, vehicle_model, branch, status, scheduled_start, scheduled_end, completed_at, created_at, updated_at, final_price_minor, price_minor, notes, service_id, services(name, slug, pay_category)'

    // Broad candidate pull (ilike), then normalize-match in process — keeps PostgREST simple + indexed.
    let candidateQ = db.from('bookings').select(bookingSelect).order('created_at', { ascending: false }).limit(80)
    candidateQ = applyBranchFilter(candidateQ, branchSlugs)

    const orParts = []
    if (classified.plate) orParts.push(`vehicle_plate.ilike.%${classified.plate}%`)
    if (classified.phone) {
      const last10 = phoneMatchKey(classified.phone)
      orParts.push(`customer_phone.ilike.%${classified.phone}%`)
      if (last10 && last10 !== classified.phone) orParts.push(`customer_phone.ilike.%${last10}%`)
      // Common PH prefixes
      if (last10.length === 10 && last10.startsWith('9')) {
        orParts.push(`customer_phone.ilike.%0${last10}%`)
        orParts.push(`customer_phone.ilike.%63${last10}%`)
      }
    }
    if (orParts.length) candidateQ = candidateQ.or(orParts.join(','))

    const { data: candidates, error: candErr } = await candidateQ
    if (candErr) return json(res, 400, { error: candErr.message })

    const matched = (candidates || []).filter((row) => bookingMatchesQuery(row, classified))

    // Also try vehicles catalog by plate → customer_id
    let vehicleHits = []
    if (classified.plate) {
      const { data: vehicles } = await db
        .from('vehicles')
        .select('id, customer_id, plate_number, normalized_plate_number, vehicle_make, vehicle_model')
        .or(
          `plate_number.ilike.%${classified.plate}%,normalized_plate_number.ilike.%${classified.plate.toLowerCase()}%`,
        )
        .eq('is_archived', false)
        .limit(20)
      vehicleHits = (vehicles || []).filter((v) => platesMatch(v.plate_number || v.normalized_plate_number, classified.plate))
    }

    const customerIds = new Set()
    const plateNorms = new Set()
    const phoneKeys = new Set()

    for (const row of matched) {
      if (row.customer_id) customerIds.add(row.customer_id)
      const pn = normalizeHistoryPlate(row.vehicle_plate)
      if (pn) plateNorms.add(pn)
      const pk = phoneMatchKey(row.customer_phone)
      if (pk) phoneKeys.add(pk)
    }
    for (const v of vehicleHits) {
      if (v.customer_id) customerIds.add(v.customer_id)
      const pn = normalizeHistoryPlate(v.plate_number)
      if (pn) plateNorms.add(pn)
    }
    if (classified.plate) plateNorms.add(classified.plate)
    if (classified.phone) phoneKeys.add(phoneMatchKey(classified.phone))

    // Full ledger for identities found
    let historyQ = db.from('bookings').select(bookingSelect).order('created_at', { ascending: false }).limit(limit)
    historyQ = applyBranchFilter(historyQ, branchSlugs)

    const identityOr = []
    if (customerIds.size) identityOr.push(...[...customerIds].map((id) => `customer_id.eq.${id}`))
    for (const pn of plateNorms) {
      if (pn.length >= 3) identityOr.push(`vehicle_plate.ilike.%${pn}%`)
    }
    for (const pk of phoneKeys) {
      if (pk.length >= 7) identityOr.push(`customer_phone.ilike.%${pk}%`)
    }

    let bookings = matched
    if (identityOr.length) {
      const { data: full, error: fullErr } = await historyQ.or(identityOr.slice(0, 40).join(','))
      if (fullErr) return json(res, 400, { error: fullErr.message })
      bookings = (full || []).filter((row) => {
        if (customerIds.size && row.customer_id && customerIds.has(row.customer_id)) return true
        if ([...plateNorms].some((pn) => platesMatch(row.vehicle_plate, pn))) return true
        if ([...phoneKeys].some((pk) => phonesMatch(row.customer_phone, pk))) return true
        return false
      })
    }

    if (statusFilter && statusFilter !== 'all') {
      bookings = bookings.filter((b) => b.status === statusFilter)
    }

    // Maintenance schedules
    let maintQ = db
      .from('vehicle_maintenance_schedules')
      .select(
        'id, customer_id, booking_id, service_slug, plate_number, plate_normalized, program_key, customer_phone, customer_name, coated_at, last_maintenance_at, next_due_at, branch_slug, status, last_notified_at, notes, created_at, updated_at',
      )
      .order('updated_at', { ascending: false })
      .limit(50)

    if (branchSlugs) maintQ = maintQ.in('branch_slug', branchSlugs)

    const maintOr = []
    for (const pn of plateNorms) {
      if (pn) maintOr.push(`plate_normalized.eq.${pn}`)
    }
    for (const id of customerIds) maintOr.push(`customer_id.eq.${id}`)
    for (const pk of phoneKeys) {
      if (pk.length >= 7) maintOr.push(`customer_phone.ilike.%${pk}%`)
    }

    let maintenance = []
    if (maintOr.length) {
      const { data: maintRows } = await maintQ.or(maintOr.slice(0, 40).join(','))
      maintenance = (maintRows || []).filter((m) => {
        if (customerIds.size && m.customer_id && customerIds.has(m.customer_id)) return true
        if ([...plateNorms].some((pn) => platesMatch(m.plate_number || m.plate_normalized, pn))) return true
        if ([...phoneKeys].some((pk) => phonesMatch(m.customer_phone, pk))) return true
        return false
      })
    }

    // POS sales linked by customer / booking
    let sales = []
    const bookingIds = bookings.map((b) => b.id).filter(Boolean)
    if (customerIds.size || bookingIds.length) {
      let salesQ = db
        .from('sales')
        .select(
          'id, branch, customer_id, booking_id, status, payment_method, subtotal_minor, total_minor, notes, occurred_at, created_at',
        )
        .order('occurred_at', { ascending: false })
        .limit(80)
      if (branchSlugs) salesQ = salesQ.in('branch', branchSlugs)
      const saleOr = []
      for (const id of customerIds) saleOr.push(`customer_id.eq.${id}`)
      for (const id of bookingIds.slice(0, 30)) saleOr.push(`booking_id.eq.${id}`)
      if (saleOr.length) {
        const { data: saleRows } = await salesQ.or(saleOr.slice(0, 40).join(','))
        sales = saleRows || []
      }
    }

    // Customer profile (first id)
    let customer = null
    const firstCustomerId = [...customerIds][0]
    if (firstCustomerId) {
      const { data } = await db
        .from('customers')
        .select('id, full_name, first_name, last_name, phone, email, created_at')
        .eq('id', firstCustomerId)
        .maybeSingle()
      customer = data || null
    }

    const identity = summarizeHistoryIdentity(bookings, maintenance)
    const timeline = buildHistoryTimeline({ bookings, maintenance, sales })

    return json(res, 200, {
      query: classified,
      scope: branchSlugs == null ? 'all' : branchSlugs,
      customer,
      identity,
      counts: {
        bookings: bookings.length,
        maintenance: maintenance.length,
        sales: sales.length,
        events: timeline.length,
      },
      bookings,
      maintenance,
      sales,
      timeline,
    })
  } catch (err) {
    console.error('[customer-history]', err)
    return json(res, 500, { error: String(err.message || err) })
  }
}
