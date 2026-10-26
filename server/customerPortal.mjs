/**
 * Customer portal data (service role) — JWT customer → history / garage / queue / loyalty.
 * POST actions: add-vehicle | update-vehicle | archive-vehicle | sync-email | update-phone | update-birthday | submit-review | request-reschedule | claim-birthday | redeem-accessory
 * (kept in step with mutateCustomerPortal by scripts/check-portal-actions.mjs)
 */
import { createClient } from '@supabase/supabase-js'
import { getQueueCounts, buildVisitProgress, formatQueueNumber, normalizePlate } from '../src/queue/queueLogic.js'
import { isBookingBoardService } from '../src/lib/serviceKinds.js'
import { maintenanceNeedsOpsAttention } from '../src/lib/paintMaintenance.js'
import { isValidCustomerPlate, plateValidationError, safeVehiclePhotoUrl } from '../src/lib/customerAuth.js'
import { buildLoyaltyProgress } from '../src/lib/loyaltyLogic.js'
import { buildThumbReview } from '../src/lib/serviceReviews.js'
import { thumbDownComplaintPayload } from '../src/lib/opsForms.js'
import { notifyOpsFormComplaint } from './notifyOpsForm.mjs'
import { CUSTOMER_ACTIVE_VISIT_STATUSES } from '../src/lib/customerPortalActive.js'
import { prepareGaragePlateChange } from '../src/lib/customerGarage.js'
import { inferPhPricingSize } from '../src/lib/phVehicleSizes.js'
import { normalizePricingSize } from '../src/lib/servicePricing.js'
import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'
import { branchName, notifyStaffEvent } from './notifyOpsEvent.mjs'
import { requestBookingReschedule } from './bookingReschedule.mjs'
import { birthdayLockError, birthdayQueryDays, isBirthdayToday } from '../src/lib/birthdayPerk.js'
import { normalizeReferralProgram } from '../src/lib/referralProgram.js'
import { mintReferralCode } from '../src/lib/friendReferral.js'
import { ensureBirthdayPerk } from './birthdayGreetings.mjs'

async function ensureReferralCode(admin, customerId, existing) {
  if (existing) return existing
  for (let i = 0; i < 6; i += 1) {
    const code = mintReferralCode()
    const { data, error } = await admin
      .from('customers')
      .update({ referral_code: code })
      .eq('id', customerId)
      .is('referral_code', null)
      .select('referral_code')
      .maybeSingle()
    if (data?.referral_code) return data.referral_code
    if (error && error.code !== '23505') return null
  }
  const { data } = await admin.from('customers').select('referral_code').eq('id', customerId).maybeSingle()
  return data?.referral_code || null
}

async function googleReviewUrl(admin, slug) {
  if (!slug) return null
  const { data } = await admin.from('branches').select('google_review_url').eq('slug', slug).maybeSingle()
  return data?.google_review_url || null
}

function resolveGarageSize(body) {
  const raw = String(body?.vehicle_type || '').trim()
  if (raw) return normalizePricingSize(raw)
  return inferPhPricingSize(body?.vehicle_make, body?.vehicle_model)
}

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function visitKindFromService(svc) {
  return isBookingBoardService(svc) ? 'detailing' : 'service'
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

export async function loadCustomerPortal({ accessToken, origin = '' }) {
  const { admin, userId, user, customer } = await requireCustomer(accessToken)

  const [branches, history, purchases, active, queue, loyaltySettings, loyaltyMilestones, customerRow, vehicles, membershipRow, maint, visitCountRes] =
    await Promise.all([
      admin.from('branches').select('slug, name, address, is_active, latitude, longitude, google_review_url').eq('is_active', true).eq('is_archived', false).order('name'),
      admin
        .from('bookings')
        .select('id, branch, status, vehicle_plate, vehicle_make, vehicle_model, final_price_minor, scheduled_start, created_at, customer_name, service_id, visit_group_id, for_payment_at, completed_at, services(name, slug, pay_category)')
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
        .select('id, branch, status, vehicle_plate, vehicle_make, vehicle_model, scheduled_start, notes, reschedule_requested_at, final_price_minor, queue_number, service_id, visit_group_id, for_payment_at, completed_at, services(name, slug, pay_category)')
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
      admin.from('customers').select('loyalty_stamps, loyalty_points, phone, email, full_name, date_of_birth, referral_code').eq('id', userId).maybeSingle(),
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
      admin
        .from('vehicle_maintenance_schedules')
        .select('id, plate_number, next_due_at, status, branch_slug, service_slug, last_notified_at')
        .eq('customer_id', userId)
        .in('status', ['scheduled', 'notified']),
      admin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', userId)
        .eq('status', 'completed'),
    ])

  const { data: perkRow } = await admin
    .from('customer_birthday_perks')
    .select('id, perk_year, status, expires_at, claimed_at, greeting_sent_at, code')
    .eq('customer_id', userId)
    .eq('status', 'available')
    .gt('expires_at', new Date().toISOString())
    .order('perk_year', { ascending: false })
    .limit(1)
    .maybeSingle()
  const birthdayPerk = perkRow || null
  const { data: usedPerk } = await admin
    .from('customer_birthday_perks')
    .select('id')
    .eq('customer_id', userId)
    .eq('perk_year', birthdayQueryDays().year)
    .eq('status', 'claimed')
    .maybeSingle()

  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  const [{ data: promoRows }, { data: promoHistory }] = await Promise.all([
    admin
      .from('promo_vouchers')
      .select(
        'id, code, title, rules_text, discount_kind, discount_percent, applies_to, starts_on, ends_on, max_uses, uses_count, is_active',
      )
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(40),
    admin
      .from('promo_voucher_redemptions')
      .select(
        'id, discount_minor, consumed_at, created_at, promo_vouchers(code, title), bookings(vehicle_plate, branch, status)',
      )
      .eq('customer_id', userId)
      .order('created_at', { ascending: false })
      .limit(40),
  ])
  const activePromos = (promoRows || []).filter((row) => {
    const start = row.starts_on ? String(row.starts_on).slice(0, 10) : ''
    const end = row.ends_on ? String(row.ends_on).slice(0, 10) : ''
    if (start && todayKey < start) return false
    if (end && todayKey > end) return false
    return Number(row.max_uses) - Number(row.uses_count) > 0
  })

  // Refer a friend: null while the program is off or the migration isn't applied.
  let referral = null
  try {
    const { portalReferral } = await import('./referral.mjs')
    referral = await portalReferral(admin, {
      userId,
      fullName: customerRow.data?.full_name || customer?.full_name || '',
      origin: origin || undefined,
    })
  } catch {
    /* never block portal on referrals */
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

  const decorateVisit = (row) => {
    const kind = visitKindFromService(row.services)
    return {
      ...row,
      service_name: row.services?.name || null,
      kind,
      queue_label: row.queue_number != null ? formatQueueNumber(row.queue_number, row.services?.pay_category) : null,
      visit: buildVisitProgress(row.status, kind),
    }
  }

  const activeBookings = (active.data || []).map(decorateVisit)

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
    referral_code: null,
    role: 'customer',
  }
  profile.referral_code = await ensureReferralCode(admin, userId, customerRow.data?.referral_code)

  const [credits, shop, redemptions, programRow] = await Promise.all([
    admin
      .from('referral_credits')
      .select('id, status')
      .eq('referrer_customer_id', userId)
      .eq('status', 'available'),
    admin
      .from('products')
      .select('id, name, points_price, product_branch_stock(branch_slug, qty)')
      .or('usage_kind.is.null,usage_kind.neq.internal')
      .eq('is_active', true)
      .eq('is_archived', false)
      .gt('points_price', 0)
      .order('name'),
    admin
      .from('accessory_redemptions')
      .select('id, points_spent, status, created_at, branch_slug, products(name)')
      .eq('customer_id', userId)
      .order('created_at', { ascending: false })
      .limit(12),
    admin.rpc('referral_program_settings'),
  ])

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
    history: withPhotos(historyRows.map(decorateVisit)),
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
      visitCount: Number(visitCountRes?.count) || 0,
      milestones: stampsEnabled ? (loyaltyMilestones.data || []) : [],
      membership,
    },
    birthday: {
      date_of_birth: profile.date_of_birth,
      is_today: isBirthdayToday(profile.date_of_birth),
      perk: birthdayPerk && birthdayPerk.status === 'available' ? birthdayPerk : null,
      used: Boolean(usedPerk),
    },
    vouchers: {
      active: activePromos,
      history: promoHistory || [],
    },
    rewards: {
      referral_code: profile.referral_code,
      available_discounts: (credits.data || []).length,
      program: normalizeReferralProgram(Array.isArray(programRow.data) ? programRow.data[0] : programRow.data),
      shop: shop.data || [],
      redemptions: redemptions.data || [],
    },
    maintenanceDue: (maint.data || []).filter((row) => maintenanceNeedsOpsAttention(row)),
    maintenanceSchedules: maint.data || [],
    referral,
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
      vehicle_type: resolveGarageSize(body),
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
      vehicle_type: resolveGarageSize(body),
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
    const { data: saved, error: savedErr } = await admin.from('customers').select('date_of_birth').eq('id', userId).maybeSingle()
    if (savedErr) throw Object.assign(new Error(savedErr.message), { status: 400 })
    const lock = birthdayLockError(saved?.date_of_birth, raw)
    if (lock) throw Object.assign(new Error(lock), { status: 400 })
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

  if (action === 'submit-review') {
    const bookingId = String(body.booking_id || '').trim()
    if (!bookingId) throw Object.assign(new Error('booking_id required.'), { status: 400 })

    const thumb = body.vote === 'up' || body.vote === 'down' ? buildThumbReview(body.vote, body.comment) : null
    const overall = thumb ? thumb.overall_rating : Number(body.overall_rating)
    const app = thumb ? thumb.app_rating : Number(body.app_rating)
    const service = thumb
      ? thumb.service_rating
      : body.service_rating == null || body.service_rating === ''
        ? null
        : Number(body.service_rating)
    const detailing = thumb
      ? thumb.detailing_rating
      : body.detailing_rating == null || body.detailing_rating === ''
        ? null
        : Number(body.detailing_rating)
    const score = (n) => Number.isInteger(n) && n >= 1 && n <= 5
    if (!score(overall) || !score(app)) {
      throw Object.assign(new Error('Rate customer experience and the app (1-5).'), { status: 400 })
    }

    const { data: booking, error: bookingErr } = await admin
      .from('bookings')
      .select('id, branch, status, customer_id, customer_name, services(name, slug, pay_category)')
      .eq('id', bookingId)
      .eq('customer_id', userId)
      .eq('status', 'completed')
      .maybeSingle()
    if (bookingErr) throw Object.assign(new Error(bookingErr.message), { status: 400 })
    if (!booking) {
      throw Object.assign(new Error('Only your completed visits can be reviewed.'), { status: 403 })
    }
    const kind = visitKindFromService(booking.services)
    if (kind === 'detailing' && !score(detailing)) {
      throw Object.assign(new Error('Rate the detailing on this visit (1-5).'), { status: 400 })
    }
    if (kind !== 'detailing' && !score(service)) {
      throw Object.assign(new Error('Rate the service or package on this visit (1-5).'), { status: 400 })
    }

    const { data: existing } = await admin
      .from('service_reviews')
      .select('id')
      .eq('booking_id', bookingId)
      .maybeSingle()
    const google_review_url = body.vote === 'up' ? await googleReviewUrl(admin, booking.branch) : null
    if (existing?.id) return { ok: true, already: true, id: existing.id, google_review_url }

    const { data: profile } = await admin.from('customers').select('full_name, phone').eq('id', userId).maybeSingle()
    let complaint_id = null
    if (body.vote === 'down') {
      const complaint = thumbDownComplaintPayload({
        name: profile?.full_name || booking.customer_name,
        phone: profile?.phone,
        branch: booking.branch,
        category: body.category,
        description: body.description || body.comment,
        bookingId,
      })
      if (!complaint) {
        throw Object.assign(new Error('Choose what went wrong and tell us what happened.'), { status: 400 })
      }
      const { data: prior } = await admin
        .from('ops_form_submissions')
        .select('id')
        .contains('payload', { booking_id: bookingId })
        .limit(1)
        .maybeSingle()
      if (prior?.id) {
        complaint_id = prior.id
      } else {
        const { data: filed, error: formErr } = await admin.rpc('submit_public_ops_form', {
          p_slug: 'customer-complaints',
          p_payload: complaint,
          p_calendar_at: null,
          p_respondent_label: complaint.customer_name,
        })
        if (formErr) throw Object.assign(new Error(formErr.message), { status: 400 })
        complaint_id = filed?.id || null
        try {
          await notifyOpsFormComplaint({
            formName: 'Customer Complaints',
            payload: complaint,
            submissionId: complaint_id,
            branch: booking.branch || null,
          })
        } catch {
          /* complaint is saved; staff alert is best-effort */
        }
      }
    }
    const { data, error } = await admin
      .from('service_reviews')
      .insert({
        booking_id: bookingId,
        customer_id: userId,
        customer_name: profile?.full_name || booking.customer_name || 'Customer',
        branch: booking.branch || '',
        overall_rating: overall,
        app_rating: app,
        service_rating: service,
        detailing_rating: detailing,
        comment: String(body.comment || '').trim() || null,
      })
      .select('id')
      .single()
    if (error) {
      if (error.code === '23505') return { ok: true, already: true }
      throw Object.assign(new Error(error.message), { status: 400 })
    }
    if (body.vote !== 'down') {
      try {
        await notifyStaffEvent(admin, 'review', {
          id: data?.id,
          rating: overall,
          name: profile?.full_name || booking.customer_name,
          branchName: await branchName(admin, booking.branch),
          comment: body.comment,
        }, { branch: booking.branch || null })
      } catch {
        /* ponytail: review is saved; staff alert is best-effort */
      }
    }
    return { ok: true, id: data?.id, google_review_url, complaint_id }
  }

  if (action === 'request-reschedule') {
    return requestBookingReschedule(admin, { userId, bookingId: body.booking_id })
  }

  if (action === 'claim-birthday') {
    const { data: cust, error } = await admin
      .from('customers')
      .select('id, date_of_birth, full_name')
      .eq('id', userId)
      .maybeSingle()
    if (error) throw Object.assign(new Error(error.message), { status: 400 })
    if (!cust?.date_of_birth) {
      throw Object.assign(new Error('Add your birthday in Settings first.'), { status: 400 })
    }
    if (!isBirthdayToday(cust.date_of_birth)) {
      throw Object.assign(new Error('The free car wash is available on your birthday.'), { status: 400 })
    }
    const perk = await ensureBirthdayPerk(admin, cust)
    if (perk?.status === 'claimed') {
      throw Object.assign(new Error('This year\'s birthday car wash is already used.'), { status: 400 })
    }
    return { ok: true, perk }
  }

  if (action === 'redeem-accessory') {
    const productId = String(body.product_id || '').trim()
    const branch = String(body.branch_slug || '').trim()
    if (!productId) throw Object.assign(new Error('Choose an item.'), { status: 400 })
    if (!branch) throw Object.assign(new Error('Choose a pickup branch.'), { status: 400 })
    const { data, error } = await admin.rpc('redeem_accessory', {
      p_customer: userId,
      p_product: productId,
      p_branch: branch,
    })
    if (error) throw Object.assign(new Error(error.message), { status: 400 })
    return data
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
    const host = req.headers?.['x-forwarded-host'] || req.headers?.host || ''
    const proto = req.headers?.['x-forwarded-proto'] || (String(host).startsWith('localhost') ? 'http' : 'https')
    const result = await loadCustomerPortal({ accessToken, origin: host ? `${proto}://${host}` : '' })
    return json(res, 200, result)
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || String(err) })
  }
}
