import { createClient } from '@supabase/supabase-js'
import {
  canTransferVehicle,
  maintenanceOwnerPatch,
  phoneVariants,
  transferBranchRefusal,
  transferRefusal,
} from '../src/lib/vehicleTransfer.js'
import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function visitBranchesFor(admin, vehicle) {
  const branches = new Set()
  const { data: byVehicle, error } = await admin
    .from('bookings')
    .select('branch')
    .eq('vehicle_id', vehicle.id)
    .limit(100)
  if (error) throw Object.assign(new Error(error.message), { status: 400 })
  for (const row of byVehicle || []) if (row.branch) branches.add(row.branch)
  if (vehicle.plate_number) {
    const { data: byPlate, error: plateErr } = await admin
      .from('bookings')
      .select('branch')
      .eq('vehicle_plate', vehicle.plate_number)
      .limit(100)
    if (plateErr) throw Object.assign(new Error(plateErr.message), { status: 400 })
    for (const row of byPlate || []) if (row.branch) branches.add(row.branch)
  }
  return [...branches]
}

async function openMaintenanceRows(admin, vehicle) {
  const plate = vehicle.normalized_plate_number
  let query = admin
    .from('vehicle_maintenance_schedules')
    .select('id, customer_id, customer_name, customer_phone')
    .in('status', ['scheduled', 'notified'])
  query = plate
    ? query.or(`vehicle_id.eq.${vehicle.id},plate_normalized.eq.${plate}`)
    : query.eq('vehicle_id', vehicle.id)
  const { data, error } = await query
  if (error) throw Object.assign(new Error(error.message), { status: 400 })
  return data || []
}

async function restoreVehicleOwner(admin, vehicle) {
  await admin
    .from('vehicles')
    .update({ customer_id: vehicle.customer_id, updated_at: new Date().toISOString() })
    .eq('id', vehicle.id)
}

async function restoreMaintenance(admin, rows) {
  for (const row of rows) {
    await admin
      .from('vehicle_maintenance_schedules')
      .update({
        customer_id: row.customer_id,
        customer_name: row.customer_name,
        customer_phone: row.customer_phone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
  }
}

export async function transferVehicle({ accessToken, vehicleId, toCustomerId }) {
  const admin = adminClient()
  const staff = await requireTransferStaff(admin, accessToken)
  const callerId = staff.id

  const { data: vehicle } = await admin
    .from('vehicles')
    .select('id, customer_id, plate_number, normalized_plate_number, is_archived')
    .eq('id', vehicleId)
    .maybeSingle()
  const { data: toCustomer } = await admin
    .from('customers')
    .select('id, full_name, phone, is_archived, role')
    .eq('id', toCustomerId)
    .maybeSingle()
  const { data: authWrap } = toCustomerId ? await admin.auth.admin.getUserById(toCustomerId) : { data: null }
  const reason = transferRefusal({
    vehicle: vehicle && !vehicle.is_archived ? vehicle : null,
    toCustomer: toCustomer?.role === 'customer' ? toCustomer : null,
    toHasAuth: Boolean(authWrap?.user),
  })
  if (reason) throw Object.assign(new Error(reason), { status: 400 })

  const branchReason = transferBranchRefusal({
    role: staff.role,
    branchSlugs: staff.branchSlugs,
    visitBranches: await visitBranchesFor(admin, vehicle),
  })
  if (branchReason) throw Object.assign(new Error(branchReason), { status: 403 })

  const plate = vehicle.normalized_plate_number
  if (plate) {
    const { data: dup, error: dupErr } = await admin
      .from('vehicles')
      .select('id')
      .eq('normalized_plate_number', plate)
      .eq('customer_id', toCustomerId)
      .eq('is_archived', false)
      .neq('id', vehicle.id)
      .maybeSingle()
    if (dup || dupErr) {
      throw Object.assign(new Error('That account already has this plate. Archive the extra row first.'), { status: 409 })
    }
  }

  const schedules = await openMaintenanceRows(admin, vehicle)
  const stamp = new Date().toISOString()
  const { error } = await admin
    .from('vehicles')
    .update({ customer_id: toCustomerId, updated_at: stamp })
    .eq('id', vehicle.id)
  if (error) throw Object.assign(new Error(error.message), { status: 400 })

  if (schedules.length) {
    const { error: maintErr } = await admin
      .from('vehicle_maintenance_schedules')
      .update({ ...maintenanceOwnerPatch(toCustomer), updated_at: stamp })
      .in('id', schedules.map((row) => row.id))
    if (maintErr) {
      await restoreVehicleOwner(admin, vehicle)
      throw Object.assign(new Error(maintErr.message), { status: 400 })
    }
  }

  const { error: auditErr } = await admin.from('audit_logs').insert({
    actor_id: callerId,
    actor_role: staff.role,
    action: 'vehicle_transfer',
    entity_type: 'vehicle',
    entity_id: vehicle.id,
    summary: `Moved ${vehicle.plate_number || 'car'} to ${toCustomer.full_name || 'another account'}`,
    meta: { from_customer_id: vehicle.customer_id, to_customer_id: toCustomerId },
  })
  if (auditErr) {
    await restoreMaintenance(admin, schedules)
    await restoreVehicleOwner(admin, vehicle)
    throw Object.assign(new Error('Could not record the transfer.'), { status: 500 })
  }

  return { ok: true, vehicle_id: vehicle.id, to_customer_id: toCustomerId }
}

async function requireTransferStaff(admin, accessToken) {
  if (!accessToken) throw Object.assign(new Error('Sign in required.'), { status: 401 })
  const { data: userData } = await admin.auth.getUser(accessToken)
  const callerId = userData?.user?.id
  if (!callerId) throw Object.assign(new Error('Sign in required.'), { status: 401 })
  const { data: staff } = await admin
    .from('staff_profiles')
    .select('id, role, is_active, branch_slug')
    .eq('id', callerId)
    .eq('is_active', true)
    .maybeSingle()
  if (!canTransferVehicle(staff)) {
    throw Object.assign(new Error('Only Super Admin, Assistant Super Admin, or Branch Admin can transfer a car.'), { status: 403 })
  }
  let branchSlugs = staff.branch_slug ? [staff.branch_slug] : []
  if (staff.role === 'admin') {
    const { data: assigns, error } = await admin
      .from('staff_branch_assignments')
      .select('branch_slug')
      .eq('staff_id', staff.id)
    if (error) throw Object.assign(new Error(error.message), { status: 400 })
    if (assigns?.length) branchSlugs = assigns.map((row) => row.branch_slug).filter(Boolean)
  }
  return { ...staff, branchSlugs }
}

export async function lookupTransfer({ accessToken, plate, phone }) {
  const admin = adminClient()
  await requireTransferStaff(admin, accessToken)
  if (plate) {
    const normalized = String(plate).trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    const { data } = await admin
      .from('vehicles')
      .select('id, plate_number, vehicle_make, vehicle_model, customer_id, customers(full_name)')
      .eq('normalized_plate_number', normalized)
      .eq('is_archived', false)
      .limit(5)
    return { vehicles: data || [] }
  }
  const variants = phoneVariants(String(phone || ''))
  const { data } = await admin
    .from('customers')
    .select('id, full_name, phone')
    .eq('role', 'customer')
    .eq('is_archived', false)
    .in('phone', variants)
    .limit(1)
  const row = data?.[0] || null
  if (!row) return { customer: null }
  const { data: authWrap } = await admin.auth.admin.getUserById(row.id)
  if (!authWrap?.user) return { customer: null, reason: 'The new owner needs a Hakum account before this car can move.' }
  return { customer: row }
}

export async function handleVehicleTransferRequest(req, res) {
  setCors(res, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
  try {
    const body = await readJsonBody(req)
    const token = bearer(req)
    if (body.action === 'lookup') {
      return json(res, 200, await lookupTransfer({ accessToken: token, plate: body.plate, phone: body.phone }))
    }
    const result = await transferVehicle({
      accessToken: token,
      vehicleId: body.vehicle_id,
      toCustomerId: body.to_customer_id,
    })
    return json(res, 200, result)
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || String(err) })
  }
}
