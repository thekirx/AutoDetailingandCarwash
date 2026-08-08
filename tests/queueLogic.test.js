import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ACTIVE_QUEUE_STATUSES,
  buildPublicQueueModel,
  buildVisitProgress,
  canEditQueueOperations,
  canOverrideQueueBranches,
  canViewQueueOperations,
  canViewRedoLane,
  formatQueueActionError,
  getCrewAttendanceModel,
  getOpsBoardStatuses,
  getQueueCounts,
  isStaffAssignmentBusy,
  normalizeAssignmentStatus,
  getBranchScope,
  getPlateLookupStatus,
  groupVisitTickets,
  getDashboardDateRange,
  isSuspiciousTiming,
  hasValidTeamLeadBranch,
  normalizePlate,
  parsePesoInputToMinor,
  normalizeVehicleType,
  OPS_BOARD_STATUSES,
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
      for_payment: 0,
      redo: 0,
      total: 4,
    })
  })

  it('builds customer visit progress from booking status', () => {
    const inProgress = buildVisitProgress('in_progress')
    assert.equal(inProgress.currentIndex, 1)
    assert.equal(inProgress.label, 'In Progress')
    assert.equal(inProgress.isComplete, false)
    assert.equal(inProgress.steps.length, 4)

    const done = buildVisitProgress('completed')
    assert.equal(done.isComplete, true)
    assert.equal(done.currentIndex, 4)
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
      { branch: 'bacoor', queue_number: 14, status: 'redo' },
      { branch: 'batangas', queue_number: 3, status: 'waiting' },
    ], 'bacoor')

    assert.equal(model.counts.total, 1)
    assert.equal(model.counts.redo, 0)
    assert.deepEqual(model.groups.in_progress, [{ queueNumber: 'Q-012', status: 'in_progress' }])
    assert.equal(model.groups.waiting.length, 0)
    assert.equal(model.groups.final_checking.length, 0)
    assert.equal(Object.hasOwn(model.groups, 'redo'), false)
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

  it('shows redo lane only for Super Admin and Assistant Super Admin', () => {
    assert.equal(canViewRedoLane({ role: 'BossMich' }), true)
    assert.equal(canViewRedoLane({ role: 'assistant_super_admin' }), true)
    assert.equal(canViewRedoLane({ role: 'admin' }), false)
    assert.equal(canViewRedoLane({ role: 'team_lead' }), false)
    assert.equal(canViewRedoLane({ role: 'staff' }), false)
    assert.equal(canViewRedoLane(null), false)
    // Console-tier roles get the for_payment lane; team lead never sees it (legacy port).
    assert.deepEqual(getOpsBoardStatuses({ role: 'BossMich' }), [...ACTIVE_QUEUE_STATUSES, 'for_payment', 'redo'])
    assert.deepEqual(getOpsBoardStatuses({ role: 'assistant_super_admin' }), [...ACTIVE_QUEUE_STATUSES, 'for_payment', 'redo'])
    assert.deepEqual(getOpsBoardStatuses({ role: 'team_lead' }), ACTIVE_QUEUE_STATUSES)
    assert.deepEqual(getOpsBoardStatuses({ role: 'admin' }), [...ACTIVE_QUEUE_STATUSES, 'for_payment'])
    assert.ok(!ACTIVE_QUEUE_STATUSES.includes('redo'))
    assert.ok(OPS_BOARD_STATUSES.includes('redo'))
  })

  it('excludes redo from counts when includeRedo is false (customer / non-owner board)', () => {
    const rows = [
      { status: 'waiting' },
      { status: 'redo' },
      { status: 'in_progress' },
      { status: 'final_checking' },
    ]
    assert.deepEqual(getQueueCounts(rows, { includeRedo: false }), {
      waiting: 1,
      in_progress: 1,
      final_checking: 1,
      for_payment: 0,
      redo: 0,
      total: 3,
    })
    assert.deepEqual(getQueueCounts(rows), {
      waiting: 1,
      in_progress: 1,
      final_checking: 1,
      for_payment: 0,
      redo: 1,
      total: 4,
    })
  })

  it('uses the logged-in profile branch as the operations scope', () => {
    assert.equal(getBranchScope({ role: 'team_lead', branch_slug: 'bacoor' }), 'bacoor')
    assert.equal(getBranchScope({ role: 'admin', branch_slug: 'batangas' }), 'batangas')
    assert.equal(getBranchScope({ role: 'admin', branch_slug: null }), '__none__')
    assert.equal(getBranchScope({ role: 'BossMich', branch_slug: null }), null)
    assert.equal(getBranchScope({ role: 'team_lead', branch_slug: null }), '__none__')
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
    assert.equal(normalizeVehicleType(''), 'medium')
    assert.equal(normalizeVehicleType('full-size'), 'full_size')
    assert.equal(normalizeVehicleType('Not A Type!!!'), 'medium')
    assert.equal(normalizeVehicleType('extra_large'), 'extra_large')
    assert.equal(normalizeVehicleType('xl'), 'extra_large')
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

  it('groups multi-service visit tickets into one board card', () => {
    const grouped = groupVisitTickets([
      { booking_id: 'a', visit_group_id: 'g1', service_name: 'Wash', final_price_minor: 10000, status: 'waiting' },
      { booking_id: 'b', visit_group_id: 'g1', service_name: 'Interior', final_price_minor: 20000, status: 'waiting' },
      { booking_id: 'c', visit_group_id: null, service_name: 'Solo', final_price_minor: 5000, status: 'waiting' },
    ])
    assert.equal(grouped.length, 2)
    const multi = grouped.find((row) => row.visit_group_id === 'g1')
    assert.equal(multi.service_name, 'Wash + Interior')
    assert.equal(multi.final_price_minor, 30000)
    assert.deepEqual(multi.linked_booking_ids, ['a', 'b'])
  })

  it('flags suspicious in_progress → final_checking timing', () => {
    const start = '2026-07-26T10:00:00.000Z'
    const endFast = '2026-07-26T10:00:30.000Z'
    const endOk = '2026-07-26T10:05:00.000Z'
    assert.equal(isSuspiciousTiming({ in_progress_at: start, final_checking_at: endFast }, { enabled: true, min_seconds_in_progress: 120 }), true)
    assert.equal(isSuspiciousTiming({ in_progress_at: start, final_checking_at: endOk }, { enabled: true, min_seconds_in_progress: 120 }), false)
    assert.equal(isSuspiciousTiming({ in_progress_at: start, final_checking_at: endFast }, { enabled: false, min_seconds_in_progress: 120 }), false)
  })

  it('resolves dashboard date presets', () => {
    const now = new Date('2026-07-26T12:00:00.000Z')
    const three = getDashboardDateRange('3mo', '', '', now)
    assert.ok(three.start < now)
    const six = getDashboardDateRange('6mo', '', '', now)
    assert.ok(six.start < three.start)
    const custom = getDashboardDateRange('custom', '2026-01-01', '2026-01-31', now)
    assert.equal(custom.start.getFullYear(), 2026)
    assert.equal(custom.start.getMonth(), 0)
    assert.equal(custom.start.getDate(), 1)
  })
})