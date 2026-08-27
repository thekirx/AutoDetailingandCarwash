/**
 * Customer portal data (service role) — JWT customer → history / garage / queue / loyalty.
 * POST actions: add-vehicle | update-vehicle | archive-vehicle | sync-email | update-phone
 */
import { createClient } from '@supabase/supabase-js'
import { getQueueCounts, buildVisitProgress, formatQueueNumber, normalizePlate } from '../src/queue/queueLogic.js'
import { isValidCustomerPlate, plateValidationError, safeVehiclePhotoUrl } from '../src/lib/customerAuth.js'
import { buildLoyaltyProgress } from '../src/lib/loyaltyLogic.js'
import { CUSTOMER_ACTIVE_VISIT_STATUSES } from '../src/lib/customerPortalActive.js'
import { prepareGaragePlateChange } from '../src/lib/customerGarage.js'
import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function requireCustomer(accessToken) {
  if (!accessToken) throw Object.assign(new Error('Unauthorized'), { status: 401 })
  const admin = adminClient()
  const { data: userData, error: userError } = await admin.auth.getUser(accessToken)
  if (userError || !userData?.user) throw Object.assign(new Error('Unauthorized'), { status: 401 })

  const userId = userData.user.id
  const { data: customer, error: customerError } = await admin
    .from('customers')
    .select('id, full_name, phone, email, role, date_of_birth')
    .eq('id', userId)
    .eq('role', 'customer')
    .eq('is_archived', false)
    .maybeSingle()

  // ponytail: never trust user_metadata.role — client can set it via updateUser
  if (customerError || !customer) {
    throw Object.assign(new Error('Customer account required.'), { status: 403 })
  }
  return { admin, userId, user: userData.user, customer }
}

export async function loadCustomerPortal({ accessToken }) {
  const { admin, userId, user, customer } = await requireCustomer(accessToken)

  const [branches, history, purchases, active, queue, loyaltySettings, loyaltyMilestones, customerRow, vehicles, membershipRow] =
    await Promise.all([
      admin.from('branches').select('slug, name, address, is_active').eq('is_active', true).eq('is_archived', false).order('name'),
      admin
        .from('bookings')
        .select('id, branch, status, vehicle_plate, vehicle_make, vehicle_model, final_price_minor, scheduled_start, created_at, customer_name')
        .eq('customer_id', userId)
        .order('created_at', { ascending: false })
        .limit(40),
      admin
        .from('sales')
        .select('id, branch, total_minor, payment_method, occurred_at, status')
        .eq('customer_id', userId)
        .eq('status', 'paid')
        .order('occurred_at', { ascending: false })
        .limit(40),
      admin
        .from('bookings')
        .select('id, branch, status, vehicle_plate, vehicle_make, vehicle_model, scheduled_start, notes, final_price_minor, queue_number, service_id, services(name)')
        .eq('customer_id', userId)
        .in('status', CUSTOMER_ACTIVE_VISIT_STATUSES)
        .order('scheduled_start', { ascending: true }),
      admin
        .from('bookings')
        .select('id, branch, status')
        .in('status', ['waiting', 'in_progress', 'final_checking'])
        .eq('is_archived', false),
      admin
        .from('loyalty_program_settings')
        .select(
          'card_slots, stamps_enabled, points_enabled, memberships_enabled, stamp_earn_mode, stamp_pay_categories',
        )
        .eq('id', 1)
        .maybeSingle(),
      admin
        .from('loyalty_milestones')
        .select('id, threshold_points, reward_label, reward_description, sort_order')
        .eq('is_active', true)
        .order('sort_order')
        .order('threshold_points'),
      admin.from('customers').select('loyalty_stamps, loyalty_points, phone, email, full_name, date_of_birth').eq('id', userId).maybeSingle(),
      admin
        .from('vehicles')
        .select('id, plate_number, vehicle_make, vehicle_model, vehicle_year, vehicle_type, color, photo_url, icon')
        .eq('customer_id', userId)
        .eq('is_archived', false)
        .order('plate_number'),
      admin
        .from('customer_memberships')
        .select('id, starts_at, ends_at, membership_tiers(name, discount_percent, loyalty_multiplier)')
        .eq('customer_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

  let birthdayPerk = null
  try {
    const { grantBirthdayIfDue } = await import('./birthdayGreetings.mjs')
    const granted = await grantBirthdayIfDue(admin, {
      id: userId,
      full_name: customerRow.data?.full_name || customer.full_name,
      phone: customerRow.data?.phone || customer.phone,
      date_of_birth: customerRow.data?.date_of_birth || customer.date_of_birth,
    })
    if (granted?.perk) birthdayPerk = granted.perk
  } catch {
    /* never block portal on birthday */
  }

  if (!birthdayPerk) {
    const { data: perkRow } = await admin
      .from('customer_birthday_perks')
      .select('id, perk_year, status, expires_at, claimed_at, greeting_sent_at')
      .eq('customer_id', userId)
      .eq('status', 'available')
      .gt('expires_at', new Date().toISOString())
      .order('perk_year', { ascending: false })
      .limit(1)
      .maybeSingle()
    birthdayPerk = perkRow || null
  }

  const queueRows = queue.data || []
  const queueByBranch = {}
  for (const row of queueRows) {
    if (!queueByBranch[row.branch]) queueByBranch[row.branch] = []
    queueByBranch[row.branch].push(row)
  }
  const queueCounts = Object.fromEntries(
    Object.entries(queueByBranch).map(([slug, rows]) => [slug, getQueueCounts(rows)]),
  )

  const settings = loyaltySettings.data || {}
  const stampsEnabled = settings.stamps_enabled !== false
  const pointsEnabled = settings.points_enabled !== false
  const membershipsEnabled = settings.memberships_enabled !== false

  const loyalty = stampsEnabled
    ? buildLoyaltyProgress(
        customerRow.data?.loyalty_stamps ?? 0,
        loyaltyMilestones.data || [],
        settings.card_slots ?? 15,
      )
    : null

  const activeBookings = (active.data || []).map((row) => ({
    ...row,
    service_name: row.services?.name || null,
    queue_label: row.queue_number != null ? formatQueueNumber(row.queue_number) : null,
    visit: buildVisitProgress(row.status),
  }))

  const historyRows = history.data || []
  const photoBookingIds = [
    ...new Set([...historyRows.map((r) => r.id), ...activeBookings.map((r) => r.id)].filter(Boolean)),
  ]
  const updatePhotosByBooking = {}
  await Promise.all(
    photoBookingIds.map(async (bookingId) => {
      const { data: files } = await admin.storage.from('booking-updates').list(String(bookingId), { limit: 24 })
      const names = (files || []).map((f) => f.name).filter((n) => n && !n.endsWith('/'))
      if (!names.length) return
      const paths = names.map((n) => `${bookingId}/${n}`)
      const { data: signed } = await admin.storage.from('booking-updates').createSignedUrls(paths, 3600)
      updatePhotosByBooking[bookingId] = (signed || [])
        .filter((row) => row?.signedUrl)
        .map((row) => ({ path: row.path, url: row.signedUrl }))
    }),
  )

  const withPhotos = (rows) =>
    (rows || []).map((row) => ({
      ...row,
      update_photos: updatePhotosByBooking[row.id] || [],
    }))

  const profile = {
    id: userId,
    full_name: customerRow.data?.full_name || customer?.full_name || user.user_metadata?.full_name || 'Customer',
    phone: customerRow.data?.phone || customer?.phone || user.user_metadata?.phone || null,
    email: customerRow.data?.email || customer?.email || user.email,
    date_of_birth: customerRow.data?.date_of_birth || customer?.date_of_birth || null,
    role: 'customer',
  }

  const membership = membershipsEnabled && membershipRow.data
    ? {
        id: membershipRow.data.id,
        starts_at: membershipRow.data.starts_at,
        ends_at: membershipRow.data.ends_at,
        tier_name: membershipRow.data.membership_tiers?.name || null,
        discount_percent: membershipRow.data.membership_tiers?.discount_percent ?? null,
        loyalty_multiplier: membershipRow.data.membership_tiers?.loyalty_multiplier ?? null,
      }
    : null

  return {
    profile,
    branches: branches.data || [],
    history: withPhotos(historyRows),
    purchases: purchases.data || [],
    bookings: withPhotos(activeBookings),
    vehicles: vehicles.data || [],
    queueCounts,
    loyalty: {
      ...(loyalty || { cardSlots: settings.card_slots ?? 15, completed: 0, progress: 0, milestones: [], earnedMilestones: [], nextMilestone: null, encouragement: '' }),
      stampsEnabled,
      pointsEnabled,
      membershipsEnabled,
      loyaltyPoints: pointsEnabled ? (customerRow.data?.loyalty_points ?? 0) : 0,
      milestones: stampsEnabled ? (loyaltyMilestones.data || []) : [],
      membership,
    },
    birthday: {
      date_of_birth: profile.date_of_birth,
      perk: birthdayPerk && birthdayPerk.status === 'available' ? birthdayPerk : null,
    },
  }
}

export async function mutateCustomerPortal({ accessToken, body }) {
  const { admin, userId } = await requireCustomer(accessToken)
  const action = String(body?.action || '').trim()

  if (action === 'add-vehicle') {
    const plate = String(body.plate_number || body.vehicle_plate || '').trim()
    const normalized = normalizePlate(plate)
    if (!normalized) throw Object.assign(new Error('Plate number is required.'), { status: 400 })
    if (!isValidCustomerPlate(plate)) {
      throw Object.assign(new Error(plateValidationError(plate)), { status: 400 })
    }

    const payload = {
      customer_id: userId,
      plate_number: plate.toUpperCase(),
      normalized_plate_number: normalized,
      vehicle_make: String(body.vehicle_make || '').trim() || null,
      vehicle_model: String(body.vehicle_model || '').trim() || null,
      vehicle_type: String(body.vehicle_type || 'sedan').trim() || 'sedan',
      color: String(body.color || '').trim() || null,
      photo_url: safeVehiclePhotoUrl(body.photo_url),
      icon: String(body.icon || '').trim().toLowerCase() || null,
      is_archived: false,
    }

    // Own row only — never upsert across customer_id (plate hijack)
    const { data: ownUpdate, error: ownErr } = await admin
      .from('vehicles')
      .update(payload)
      .eq('normalized_plate_number', normalized)
      .eq('customer_id', userId)
      .select('id, plate_number, vehicle_make, vehicle_model, vehicle_year, vehicle_type, color, photo_url, icon')
      .maybeSingle()
    if (ownErr) throw Object.assign(new Error(ownErr.message), { status: 400 })
    if (ownUpdate) return { ok: true, vehicle: ownUpdate }

    const { data: taken } = await admin
      .from('vehicles')
      .select('customer_id')
      .eq('normalized_plate_number', normalized)
      .maybeSingle()
    if (taken?.customer_id) {
      throw Object.assign(new Error('This plate is already linked to another account.'), { status: 409 })
    }

    const { data, error } = await admin
      .from('vehicles')
      .insert(payload)
      .select('id, plate_number, vehicle_make, vehicle_model, vehicle_year, vehicle_type, color, photo_url, icon')
      .single()
    if (error) {
      // Race: another writer claimed the plate between select and insert
      if (error.code === '23505') {
        throw Object.assign(new Error('This plate is already linked to another account.'), { status: 409 })
      }
      throw Object.assign(new Error(error.message), { status: 400 })
    }
    return { ok: true, vehicle: data }
  }

  if (action === 'update-vehicle') {
    const vehicleId = String(body.vehicle_id || '').trim()
    const plate = String(body.plate_number || body.vehicle_plate || '').trim()
    const { data: current, error: currentErr } = await admin
      .from('vehicles')
      .select('id, plate_number, normalized_plate_number, customer_id')
      .eq('id', vehicleId)
      .eq('customer_id', userId)
      .maybeSingle()
    if (currentErr) throw Object.assign(new Error(currentErr.message), { status: 400 })
    if (!current) throw Object.assign(new Error('Vehicle not found.'), { status: 404 })

    const nextNorm = normalizePlate(plate)
    const { data: occupant } = nextNorm
      ? await admin.from('vehicles').select('id').eq('normalized_plate_number', nextNorm).maybeSingle()
      : { data: null }

    const prepared = prepareGaragePlateChange({
      vehicleId,
      currentPlate: current.plate_number,
      nextPlate: plate,
      occupantVehicleId: occupant?.id || null,
    })
    if (!prepared.ok) throw Object.assign(new Error(prepared.error), { status: prepared.status || 400 })

    const payload = {
      plate_number: prepared.plate_number,
      normalized_plate_number: prepared.normalized_plate_number,
      vehicle_make: String(body.vehicle_make || '').trim() || null,
      vehicle_model: String(body.vehicle_model || '').trim() || null,
      vehicle_type: String(body.vehicle_type || 'sedan').trim() || 'sedan',
      color: String(body.color || '').trim() || null,
      photo_url: safeVehiclePhotoUrl(body.photo_url),
      icon: String(body.icon || '').trim().toLowerCase() || null,
      is_archived: false,
    }

    const { data, error } = await admin
      .from('vehicles')
      .update(payload)
      .eq('id', vehicleId)
      .eq('customer_id', userId)
      .select('id, plate_number, vehicle_make, vehicle_model, vehicle_year, vehicle_type, color, photo_url, icon')
      .single()
    if (error) {
      if (error.code === '23505') {
        throw Object.assign(new Error('This plate is already linked to another account.'), { status: 409 })
      }
      throw Object.assign(new Error(error.message), { status: 400 })
    }

    if (prepared.plateChanged) {
      await admin
        .from('bookings')
        .update({ vehicle_plate: prepared.plate_number })
        .eq('vehicle_id', vehicleId)
        .eq('customer_id', userId)
        .eq('is_archived', false)
        .in('status', CUSTOMER_ACTIVE_VISIT_STATUSES)
    }

    return { ok: true, vehicle: data }
  }

  if (action === 'archive-vehicle') {
    const vehicleId = String(body.vehicle_id || '').trim()
    if (!vehicleId) throw Object.assign(new Error('vehicle_id required.'), { status: 400 })

    // Block archive while an active visit is open for this plate/vehicle
    const { data: vehicle, error: vErr } = await admin
      .from('vehicles')
      .select('id, plate_number, customer_id')
      .eq('id', vehicleId)
      .eq('customer_id', userId)
      .maybeSingle()
    if (vErr) throw Object.assign(new Error(vErr.message), { status: 400 })
    if (!vehicle) throw Object.assign(new Error('Vehicle not found.'), { status: 404 })

    const { data: active } = await admin
      .from('bookings')
      .select('id')
      .eq('customer_id', userId)
      .eq('is_archived', false)
      .in('status', ['pending', 'confirmed', 'waiting', 'in_progress', 'final_checking', 'for_payment'])
      .or(`vehicle_id.eq.${vehicleId},vehicle_plate.eq.${vehicle.plate_number}`)
      .limit(1)
      .maybeSingle()
    if (active?.id) {
      throw Object.assign(new Error('Cannot remove a car with an active visit. Ask the branch when the job is done.'), { status: 409 })
    }

    const { error } = await admin
      .from('vehicles')
      .update({ is_archived: true })
      .eq('id', vehicleId)
      .eq('customer_id', userId)
    if (error) throw Object.assign(new Error(error.message), { status: 400 })
    return { ok: true, archived: vehicleId }
  }

  if (action === 'sync-email') {
    const email = String(body.email || '').trim().toLowerCase()
    if (!email || !email.includes('@')) throw Object.assign(new Error('Valid email required.'), { status: 400 })
    const { error } = await admin.from('customers').update({ email }).eq('id', userId)
    if (error) throw Object.assign(new Error(error.message), { status: 400 })
    return { ok: true, email }
  }

  if (action === 'update-birthday') {
    const raw = String(body.date_of_birth || '').trim()
    if (!raw) {
      const { error } = await admin.from('customers').update({ date_of_birth: null }).eq('id', userId)
      if (error) throw Object.assign(new Error(error.message), { status: 400 })
      return { ok: true, date_of_birth: null }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      throw Object.assign(new Error('Use a valid birthday date.'), { status: 400 })
    }
    const year = Number(raw.slice(0, 4))
    if (year < 1920 || year > new Date().getFullYear()) {
      throw Object.assign(new Error('Birthday year looks off.'), { status: 400 })
    }
    const { error } = await admin.from('customers').update({ date_of_birth: raw }).eq('id', userId)
    if (error) throw Object.assign(new Error(error.message), { status: 400 })
    try {
      const { grantBirthdayIfDue } = await import('./birthdayGreetings.mjs')
      const { data: row } = await admin.from('customers').select('id, full_name, phone, date_of_birth').eq('id', userId).maybeSingle()
      if (row) await grantBirthdayIfDue(admin, row)
    } catch {
      /* greeting is best-effort */
    }
    return { ok: true, date_of_birth: raw }
  }

  if (action === 'update-phone') {
    const phone = String(body.phone || '').trim()
    if (phone.length < 7) throw Object.assign(new Error('Valid phone required.'), { status: 400 })
    const { data: taken } = await admin
      .from('customers')
      .select('id')
      .eq('role', 'customer')
      .eq('is_archived', false)
      .eq('phone', phone)
      .neq('id', userId)
      .limit(1)
      .maybeSingle()
    if (taken) throw Object.assign(new Error('That phone is already on another Hakum account.'), { status: 409 })
    const { error } = await admin.from('customers').update({ phone }).eq('id', userId)
    if (error) throw Object.assign(new Error(error.message), { status: 400 })
    return { ok: true, phone }
  }

  throw Object.assign(new Error('Unknown action.'), { status: 400 })
}

export async function handleCustomerPortalRequest(req, res, { getAccessToken }) {
  setCors(res)
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }
    const accessToken = getAccessToken?.() || bearer(req)
    if (req.method === 'POST') {
      const body = await readJsonBody(req)
      if (body?.action) {
        const result = await mutateCustomerPortal({ accessToken, body })
        return json(res, 200, result)
      }
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
      return json(res, 405, { error: 'Method not allowed' })
    }
    const result = await loadCustomerPortal({ accessToken })
    return json(res, 200, result)
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || String(err) })
  }
}
