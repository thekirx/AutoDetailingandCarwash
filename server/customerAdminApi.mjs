/**
 * Admin / CRM customer & vehicle lifecycle API (service role, strict RBAC).
 * Used via /api/customer?operation=manage-customer in Vercel and Vite dev.
 */
import { canEditCrm, getBranchScopeList, isAssistantSuperAdmin, isSuperAdmin } from '../src/auth/permissions.js'
import { canTransferVehicle } from '../src/lib/vehicleTransfer.js'
import { canonicalPhMobile, normalizePlate, phoneLoginEmail, plateValidationError } from '../src/lib/customerAuth.js'
import { normalizePricingSize } from '../src/lib/servicePricing.js'
import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'
import { adminClient } from './supabaseAdmin.mjs'

const SYNTHETIC_EMAIL = /@customers\.hakumautocare\.com$/i

async function requireCrmStaff(admin, accessToken) {
  if (!accessToken) throw Object.assign(new Error('Unauthorized'), { status: 401 })
  const { data: userRes, error: authErr } = await admin.auth.getUser(accessToken)
  if (authErr || !userRes?.user) throw Object.assign(new Error('Unauthorized'), { status: 401 })

  const { data: staff, error: staffErr } = await admin
    .from('staff_profiles')
    .select('id, role, full_name, is_active, permission_grants, branch_slug')
    .eq('id', userRes.user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (staffErr) throw Object.assign(new Error(staffErr.message), { status: 500 })
  if (!staff || !canEditCrm(staff)) {
    throw Object.assign(new Error('Only Super Admin, General Admin, Branch Admin, or Customer Rep can manage customers.'), { status: 403 })
  }

  let branchSlugs = getBranchScopeList(staff)
  if (Array.isArray(branchSlugs)) {
    const { data: assigns } = await admin
      .from('staff_branch_assignments')
      .select('branch_slug')
      .eq('staff_id', staff.id)
    if (assigns?.length) {
      branchSlugs = [...new Set([...branchSlugs, ...assigns.map((a) => a.branch_slug).filter(Boolean)])]
    }
  }

  return { ...staff, branchSlugs }
}

async function assertCustomerInBranchScope(admin, staff, customerId) {
  if (!Array.isArray(staff.branchSlugs)) return
  if (!staff.branchSlugs.length) {
    throw Object.assign(new Error('No branch assigned for your account.'), { status: 403 })
  }
  const { data: visits, error } = await admin
    .from('bookings')
    .select('branch')
    .eq('customer_id', customerId)
    .eq('is_archived', false)
    .limit(100)
  if (error) throw Object.assign(new Error(error.message), { status: 400 })
  const branches = [...new Set((visits || []).map((v) => v.branch).filter(Boolean))]
  if (!branches.some((b) => staff.branchSlugs.includes(b))) {
    throw Object.assign(new Error('Customer has no visits in your assigned branch scope.'), { status: 403 })
  }
}

async function writeAudit(admin, staffId, action, targetId, metadata) {
  await admin.from('audit_logs').insert({
    actor_id: staffId,
    action,
    target_table: metadata?.target_table || 'customers',
    target_id: targetId,
    metadata,
  })
}

async function listArchivedCustomers(admin) {
  const { data, error } = await admin
    .from('customers')
    .select('id, full_name, first_name, last_name, phone, email, date_of_birth, loyalty_points, loyalty_stamps, created_at, updated_at, notify_sms, notify_push, is_disabled, is_archived')
    .eq('role', 'customer')
    .eq('is_archived', true)
    .order('updated_at', { ascending: false })
    .limit(500)
  if (error) throw Object.assign(new Error(error.message), { status: 400 })
  return { customers: data || [] }
}

async function updateCustomer(admin, staff, body) {
  const customerId = String(body.customer_id || '').trim()
  if (!customerId) throw Object.assign(new Error('Customer id is required.'), { status: 400 })

  await assertCustomerInBranchScope(admin, staff, customerId)

  const { data: existing, error: findErr } = await admin
    .from('customers')
    .select('id, first_name, last_name, full_name, phone, email, date_of_birth, notify_sms, notify_push, is_disabled, role')
    .eq('id', customerId)
    .eq('role', 'customer')
    .maybeSingle()
  if (findErr) throw Object.assign(new Error(findErr.message), { status: 400 })
  if (!existing) throw Object.assign(new Error('Customer not found.'), { status: 404 })

  const first = String(body.first_name ?? existing.first_name ?? '').trim()
  const last = String(body.last_name ?? existing.last_name ?? '').trim()
  const fullName = String(body.full_name || `${first} ${last}`.trim() || existing.full_name || '').trim()
  if (!fullName) throw Object.assign(new Error('Customer name is required.'), { status: 400 })

  const rawPhone = body.phone !== undefined ? String(body.phone || '').trim() : (existing.phone || '')
  const phone = rawPhone ? (canonicalPhMobile(rawPhone) || rawPhone) : ''

  const rawEmail = body.email !== undefined ? String(body.email || '').trim().toLowerCase() : (existing.email || '')
  const realEmail = rawEmail && !SYNTHETIC_EMAIL.test(rawEmail) ? rawEmail : ''

  if (phone) {
    const { data: dupPhone } = await admin
      .from('customers')
      .select('id')
      .eq('role', 'customer')
      .eq('is_archived', false)
      .eq('phone', phone)
      .neq('id', customerId)
      .limit(1)
      .maybeSingle()
    if (dupPhone) throw Object.assign(new Error('Another active customer already uses that phone number.'), { status: 409 })
  }
  if (realEmail) {
    const { data: dupEmail } = await admin
      .from('customers')
      .select('id')
      .eq('role', 'customer')
      .eq('is_archived', false)
      .ilike('email', realEmail.replace(/[\\%_]/g, '\\$&'))
      .neq('id', customerId)
      .limit(1)
      .maybeSingle()
    if (dupEmail) throw Object.assign(new Error('Another active customer already uses that email address.'), { status: 409 })
  }

  const dobRaw = body.date_of_birth !== undefined ? String(body.date_of_birth || '').trim() : (existing.date_of_birth || '')
  const dateOfBirth = dobRaw && /^\d{4}-\d{2}-\d{2}$/.test(dobRaw) ? dobRaw : null
  const isDisabled = body.is_disabled !== undefined ? Boolean(body.is_disabled) : Boolean(existing.is_disabled)
  const notifySms = body.notify_sms !== undefined ? Boolean(body.notify_sms) : existing.notify_sms !== false
  const notifyPush = body.notify_push !== undefined ? Boolean(body.notify_push) : existing.notify_push !== false

  const storedEmail = realEmail || (existing.email && SYNTHETIC_EMAIL.test(existing.email) ? existing.email : phone ? phoneLoginEmail(phone) : null)
  const now = new Date().toISOString()

  const { data: updated, error: updErr } = await admin
    .from('customers')
    .update({
      first_name: first || null,
      last_name: last || null,
      full_name: fullName,
      phone: phone || null,
      email: storedEmail,
      date_of_birth: dateOfBirth,
      notify_sms: notifySms,
      notify_push: notifyPush,
      is_disabled: isDisabled,
      updated_at: now,
    })
    .eq('id', customerId)
    .select('id, full_name, first_name, last_name, phone, email, date_of_birth, loyalty_points, loyalty_stamps, created_at, notify_sms, notify_push, is_disabled, is_archived')
    .single()
  if (updErr) throw Object.assign(new Error(updErr.message), { status: 400 })

  const authPatch = {
    ban_duration: isDisabled ? '876000h' : 'none',
    user_metadata: { role: 'customer', full_name: fullName, phone: phone || null },
  }
  if (realEmail && realEmail !== existing.email) authPatch.email = realEmail
  await admin.auth.admin.updateUserById(customerId, authPatch).catch(() => null)

  await writeAudit(admin, staff.id, 'crm.customer.updated', customerId, {
    target_table: 'customers',
    full_name: fullName,
    is_disabled: isDisabled,
  })
  return { customer: updated }
}

async function archiveOrRestoreCustomer(admin, staff, customerId, archive) {
  if (!isSuperAdmin(staff) && !isAssistantSuperAdmin(staff)) {
    throw Object.assign(new Error('Only Super Admin or General Admin can archive or restore customer accounts.'), { status: 403 })
  }
  if (!customerId) throw Object.assign(new Error('Customer id is required.'), { status: 400 })

  const { data: existing, error: findErr } = await admin
    .from('customers')
    .select('id, full_name, role, is_archived')
    .eq('id', customerId)
    .eq('role', 'customer')
    .maybeSingle()
  if (findErr) throw Object.assign(new Error(findErr.message), { status: 400 })
  if (!existing) throw Object.assign(new Error('Customer not found.'), { status: 404 })

  const now = new Date().toISOString()
  const { error: updErr } = await admin
    .from('customers')
    .update({
      is_archived: archive,
      is_disabled: archive,
      updated_at: now,
    })
    .eq('id', customerId)
  if (updErr) throw Object.assign(new Error(updErr.message), { status: 400 })

  await admin
    .from('vehicles')
    .update({ is_archived: archive, updated_at: now })
    .eq('customer_id', customerId)

  await admin.auth.admin.updateUserById(customerId, {
    ban_duration: archive ? '876000h' : 'none',
  }).catch(() => null)

  await writeAudit(admin, staff.id, archive ? 'crm.customer.archived' : 'crm.customer.restored', customerId, {
    target_table: 'customers',
    full_name: existing.full_name,
  })
  return { ok: true, archived: archive }
}

async function deleteCustomerPermanently(admin, staff, customerId) {
  if (!isSuperAdmin(staff) && !isAssistantSuperAdmin(staff)) {
    throw Object.assign(new Error('Only Super Admin or General Admin can permanently delete customer accounts.'), { status: 403 })
  }
  if (!customerId) throw Object.assign(new Error('Customer id is required.'), { status: 400 })

  const { data: existing, error: findErr } = await admin
    .from('customers')
    .select('id, full_name, role')
    .eq('id', customerId)
    .eq('role', 'customer')
    .maybeSingle()
  if (findErr) throw Object.assign(new Error(findErr.message), { status: 400 })
  if (!existing) throw Object.assign(new Error('Customer not found.'), { status: 404 })

  const [{ count: bookingCount }, { count: salesCount }] = await Promise.all([
    admin.from('bookings').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
    admin.from('sales').select('id', { count: 'exact', head: true }).eq('customer_id', customerId),
  ])
  if ((bookingCount || 0) > 0 || (salesCount || 0) > 0) {
    throw Object.assign(
      new Error(`Customer has ${bookingCount || 0} visit(s) and ${salesCount || 0} receipt(s). Archive instead to keep financial history intact.`),
      { status: 409 },
    )
  }

  await Promise.all([
    admin.from('vehicles').delete().eq('customer_id', customerId),
    admin.from('customer_notes').delete().eq('customer_id', customerId),
    admin.from('loyalty_ledger').delete().eq('customer_id', customerId),
    admin.from('customer_birthday_perks').delete().eq('customer_id', customerId),
    admin.from('customer_memberships').delete().eq('customer_id', customerId),
    admin.from('user_notifications').delete().eq('user_id', customerId),
  ])

  const { error: delErr } = await admin.from('customers').delete().eq('id', customerId)
  if (delErr) throw Object.assign(new Error(delErr.message), { status: 400 })

  await admin.auth.admin.deleteUser(customerId).catch(() => null)
  await writeAudit(admin, staff.id, 'crm.customer.deleted', customerId, {
    target_table: 'customers',
    full_name: existing.full_name,
  })
  return { ok: true, deleted: true }
}

async function updateVehicle(admin, staff, body) {
  const vehicleId = String(body.vehicle_id || '').trim()
  if (!vehicleId) throw Object.assign(new Error('Vehicle id is required.'), { status: 400 })

  const { data: existing, error: findErr } = await admin
    .from('vehicles')
    .select('id, customer_id, plate_number, normalized_plate_number, is_archived')
    .eq('id', vehicleId)
    .maybeSingle()
  if (findErr) throw Object.assign(new Error(findErr.message), { status: 400 })
  if (!existing || existing.is_archived) throw Object.assign(new Error('Vehicle not found.'), { status: 404 })

  await assertCustomerInBranchScope(admin, staff, existing.customer_id)

  const plate = String(body.plate_number || existing.plate_number || '').trim().toUpperCase()
  const plateError = plateValidationError(plate)
  if (plateError) throw Object.assign(new Error(plateError), { status: 400 })

  const normalized = normalizePlate(plate)
  const { data: dup } = await admin
    .from('vehicles')
    .select('id')
    .eq('customer_id', existing.customer_id)
    .eq('normalized_plate_number', normalized)
    .eq('is_archived', false)
    .neq('id', vehicleId)
    .limit(1)
    .maybeSingle()
  if (dup) throw Object.assign(new Error('This customer already has another vehicle with that plate.'), { status: 409 })

  const yearRaw = Number(body.vehicle_year)
  const { data: updated, error: updErr } = await admin
    .from('vehicles')
    .update({
      plate_number: plate,
      normalized_plate_number: normalized,
      vehicle_make: String(body.vehicle_make || '').trim() || null,
      vehicle_model: String(body.vehicle_model || '').trim() || null,
      vehicle_year: Number.isInteger(yearRaw) && yearRaw >= 1950 && yearRaw <= 2100 ? yearRaw : null,
      vehicle_type: normalizePricingSize(body.vehicle_type),
      color: String(body.color || '').trim() || null,
      icon: String(body.icon || '').trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', vehicleId)
    .select('id, customer_id, plate_number, vehicle_make, vehicle_model, vehicle_year, vehicle_type, color, icon, total_visits, last_visit_at')
    .single()
  if (updErr) throw Object.assign(new Error(updErr.message), { status: 400 })

  await writeAudit(admin, staff.id, 'crm.vehicle.updated', vehicleId, {
    target_table: 'vehicles',
    plate_number: plate,
    customer_id: existing.customer_id,
  })
  return { vehicle: updated }
}

async function archiveVehicle(admin, staff, vehicleId) {
  if (!vehicleId) throw Object.assign(new Error('Vehicle id is required.'), { status: 400 })
  const { data: existing, error: findErr } = await admin
    .from('vehicles')
    .select('id, customer_id, plate_number, is_archived')
    .eq('id', vehicleId)
    .maybeSingle()
  if (findErr) throw Object.assign(new Error(findErr.message), { status: 400 })
  if (!existing || existing.is_archived) throw Object.assign(new Error('Vehicle not found.'), { status: 404 })

  await assertCustomerInBranchScope(admin, staff, existing.customer_id)
  if (!canTransferVehicle(staff) && !isSuperAdmin(staff) && !isAssistantSuperAdmin(staff) && staff.role !== 'sales') {
    throw Object.assign(new Error('Not allowed to remove vehicles.'), { status: 403 })
  }

  const { error: updErr } = await admin
    .from('vehicles')
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq('id', vehicleId)
  if (updErr) throw Object.assign(new Error(updErr.message), { status: 400 })

  await writeAudit(admin, staff.id, 'crm.vehicle.archived', vehicleId, {
    target_table: 'vehicles',
    plate_number: existing.plate_number,
    customer_id: existing.customer_id,
  })
  return { ok: true }
}

export async function handleManageCustomerRequest(req, res, helpers = {}) {
  setCors(res, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  try {
    const token = helpers.getAccessToken ? helpers.getAccessToken() : bearer(req)
    const admin = adminClient()
    const staff = await requireCrmStaff(admin, token)
    const body = helpers.getBody ? await helpers.getBody() : await readJsonBody(req)
    const action = String(body?.action || '')

    if (action === 'list-archived') {
      if (!isSuperAdmin(staff) && !isAssistantSuperAdmin(staff)) {
        return json(res, 403, { error: 'Only Super Admin or General Admin can view archived customers.' })
      }
      return json(res, 200, await listArchivedCustomers(admin))
    }
    if (action === 'update') return json(res, 200, await updateCustomer(admin, staff, body))
    if (action === 'archive') return json(res, 200, await archiveOrRestoreCustomer(admin, staff, body.customer_id, true))
    if (action === 'restore') return json(res, 200, await archiveOrRestoreCustomer(admin, staff, body.customer_id, false))
    if (action === 'delete') return json(res, 200, await deleteCustomerPermanently(admin, staff, body.customer_id))
    if (action === 'update-vehicle') return json(res, 200, await updateVehicle(admin, staff, body))
    if (action === 'archive-vehicle') return json(res, 200, await archiveVehicle(admin, staff, body.vehicle_id))

    return json(res, 400, { error: `Unknown action: ${action || 'none'}` })
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || String(err) })
  }
}
