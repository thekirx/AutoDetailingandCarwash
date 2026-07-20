import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ACTIVE_QUEUE_STATUSES,
  buildPublicQueueModel,
  canEditQueueOperations,
  canOverrideQueueBranches,
  canViewQueueOperations,
  formatQueueActionError,
  getCrewAttendanceModel,
  getQueueCounts,
  isStaffAssignmentBusy,
  normalizeAssignmentStatus,
  getBranchScope,
  getPlateLookupStatus,
  hasValidTeamLeadBranch,
  normalizePlate,
  parsePesoInputToMinor,
  normalizeVehicleType,
} from '../src/queue/queueLogic.js'

describe('queue logic', () => {
  it('counts only active public queue statuses', () => {
    const counts = getQueueCounts([
      { status: 'waiting' },
      { status: 'waiting' },
      { status: 'in_progress' },
      { status: 'final_checking' },
      { status: 'for_payment' },
      { status: 'completed' },
    ])

    assert.deepEqual(counts, {
      waiting: 2,
      in_progress: 1,
      final_checking: 1,
      total: 4,
    })
  })

  it('builds a public model with queue numbers only', () => {
    const model = buildPublicQueueModel([
      {
        branch: 'bacoor',
        queue_number: 12,
        status: 'in_progress',
        customer_name: 'Private',
        plate_number: 'ABC123',
        service_name: 'Premium Wash',
      },
      { branch: 'bacoor', queue_number: 13, status: 'for_payment' },
      { branch: 'batangas', queue_number: 3, status: 'waiting' },
    ], 'bacoor')

    assert.equal(model.counts.total, 1)
    assert.deepEqual(model.groups.in_progress, [{ queueNumber: 'Q-012', status: 'in_progress' }])
    assert.equal(JSON.stringify(model).includes('Private'), false)
    assert.equal(JSON.stringify(model).includes('ABC123'), false)
    assert.equal(JSON.stringify(model).includes('Premium Wash'), false)
  })

  it('treats active assignments on active tickets as busy only', () => {
    assert.equal(isStaffAssignmentBusy({ status: 'active', booking_status: 'in_progress' }), true)
    assert.equal(isStaffAssignmentBusy({ status: 'released', booking_status: 'in_progress' }), false)
    assert.equal(isStaffAssignmentBusy({ status: 'active', booking_status: 'for_payment' }), false)
  })

  it('normalizes legacy assignment statuses into the MVP statuses', () => {
    assert.equal(normalizeAssignmentStatus('assigned'), 'active')
    assert.equal(normalizeAssignmentStatus('in_progress'), 'active')
    assert.equal(normalizeAssignmentStatus('completed'), 'released')
    assert.equal(normalizeAssignmentStatus('released'), 'released')
    assert.deepEqual(ACTIVE_QUEUE_STATUSES, ['waiting', 'in_progress', 'final_checking'])
  })

  it('uses the logged-in profile branch as the operations scope', () => {
    assert.equal(getBranchScope({ role: 'team_lead', branch_slug: 'bacoor' }), 'bacoor')
    assert.equal(getBranchScope({ role: 'admin', branch_slug: 'batangas' }), 'batangas')
    assert.equal(getBranchScope({ role: 'admin', branch_slug: null }), null)
    assert.equal(getBranchScope({ role: 'BossMich', branch_slug: null }), null)
    assert.equal(getBranchScope({ role: 'team_lead', branch_slug: null }), null)
    assert.equal(hasValidTeamLeadBranch({ role: 'team_lead', branch_slug: null }), false)
    assert.equal(hasValidTeamLeadBranch({ role: 'team_lead', branch_slug: 'batangas' }), true)
  })

  it('allows only team leads and BossMich to edit queue operations', () => {
    assert.equal(canEditQueueOperations({ role: 'team_lead' }), true)
    assert.equal(canEditQueueOperations({ role: 'BossMich' }), true)
    assert.equal(canEditQueueOperations({ role: 'admin' }), false)
    assert.equal(canEditQueueOperations({ role: 'cashier' }), false)
    assert.equal(canEditQueueOperations({ role: 'staff' }), false)
    assert.equal(canOverrideQueueBranches({ role: 'BossMich' }), true)
    assert.equal(canOverrideQueueBranches({ role: 'team_lead' }), false)
  })

  it('lets admins view operations data without queue edit permission', () => {
    assert.equal(canViewQueueOperations({ role: 'admin' }), true)
    assert.equal(canViewQueueOperations({ role: 'team_lead' }), true)
    assert.equal(canViewQueueOperations({ role: 'BossMich' }), true)
    assert.equal(canViewQueueOperations({ role: 'cashier' }), false)
  })

  it('describes plate lookup state without exposing duplicate fields', () => {
    assert.equal(getPlateLookupStatus('', false), '')
    assert.equal(getPlateLookupStatus('ABC123', true), 'Existing customer found')
    assert.equal(getPlateLookupStatus('ABC123', false), 'No record found. This will be added as a new customer/vehicle record.')
  })

  it('normalizes plate input for lookup and ticket creation', () => {
    assert.equal(normalizePlate('ABC 1234'), 'ABC1234')
    assert.equal(normalizePlate('wash 88'), 'WASH88')
    assert.equal(normalizePlate('WASH-88'), 'WASH88')
    assert.equal(normalizePlate(' WASH 88 '), 'WASH88')
  })

  it('normalizes vehicle type values to the booking constraint set', () => {
    assert.equal(normalizeVehicleType('Sedan'), 'sedan')
    assert.equal(normalizeVehicleType('SUV'), 'suv')
    assert.equal(normalizeVehicleType('Van'), 'van')
    assert.equal(normalizeVehicleType('Pickup'), 'pickup')
    assert.equal(normalizeVehicleType('pick-up'), 'pickup')
    assert.equal(normalizeVehicleType('Motorbike'), 'motorcycle')
    assert.equal(normalizeVehicleType(''), 'sedan')
    assert.equal(normalizeVehicleType('Coupe'), 'sedan')
  })

  it('converts visible peso inputs to minor units', () => {
    assert.equal(parsePesoInputToMinor('1200'), 120000)
    assert.equal(parsePesoInputToMinor('2,500'), 250000)
    assert.equal(parsePesoInputToMinor('1200.50'), 120050)
  })

  it('rejects invalid price inputs before saving', () => {
    assert.throws(() => parsePesoInputToMinor(''), /Price is required/)
    assert.throws(() => parsePesoInputToMinor('abc'), /positive number/)
    assert.throws(() => parsePesoInputToMinor('0'), /positive number/)
    assert.throws(() => parsePesoInputToMinor('-10'), /positive number/)
  })

  it('maps missing schema cache columns to an actionable queue migration error', () => {
    const error = formatQueueActionError({
      message: "Could not find the 'final_checking_at' column of 'bookings' in the schema cache",
    })

    assert.match(error.message, /Queue database columns are not fully migrated/)
    assert.match(error.message, /Supabase migration/)
  })

  it('maps recorded_by foreign key failures to a missing profile message', () => {
    const error = formatQueueActionError({
      message: 'insert or update on table "transactions" violates foreign key constraint "transactions_recorded_by_fkey"',
    })

    assert.equal(error.message, 'Your user profile is missing. Ask Super Admin to create or sync your profile before sending to payment.')
  })

  it('maps pre-migration staff pool columns to a staff attendance migration message', () => {
    const error = formatQueueActionError({
      message: "Could not find the 'is_archived' column of 'staff_profiles' in the schema cache",
    })

    assert.match(error.message, /Staff attendance is not fully migrated/)
  })

  it('maps staff profile RLS failures to a staff attendance migration message', () => {
    const error = formatQueueActionError({
      message: 'new row violates row-level security policy for table "staff_profiles"',
    })

    assert.match(error.message, /Staff attendance is not fully migrated/)
  })

  it('maps stale booking staff foreign key failures to a staff attendance migration message', () => {
    const error = formatQueueActionError({
      message: 'insert or update on table "bookings" violates foreign key constraint "bookings_assigned_staff_id_fkey"',
    })

    assert.match(error.message, /Staff attendance is not fully migrated/)
  })

  it('builds today crew availability from staff pool, attendance, and busy assignments', () => {
    const model = getCrewAttendanceModel({
      staffPool: [
        { id: 'a', full_name: 'Ana', role: 'staff', branch_slug: 'bacoor', is_active: true },
        { id: 'b', full_name: 'Ben', role: 'staff', branch_slug: 'bacoor', is_active: true },
        { id: 'c', full_name: 'Cal', role: 'staff', branch_slug: 'bacoor', is_active: false },
      ],
      attendance: [
        { staff_id: 'a', status: 'present' },
        { staff_id: 'b', status: 'present' },
      ],
      busyStaff: [
        { staff_id: 'b', booking_id: 'booking-1', queue_number: 1, booking_status: 'in_progress' },
      ],
    })

    assert.deepEqual(model.staffPool.map((row) => row.id), ['a', 'b'])
    assert.deepEqual(model.availableStaff.map((row) => row.staff_id), ['a'])
    assert.deepEqual(model.busyStaff.map((row) => row.staff_id), ['b'])
    assert.equal(model.presentCount, 2)
  })
})
