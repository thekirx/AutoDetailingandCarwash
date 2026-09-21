import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildPublicTvBoardModel,
  formatTvClock,
  formatTvVehicleLine,
  mapBookingStatusToTvLane,
  TV_BOARD_LANES,
  tvBoardDensity,
  tvCrewLabel,
  tvIsMotorcycle,
} from '../src/queue/queueLogic.js'

describe('shop TV board model', () => {
  it('maps wash + detailing statuses into waiting / in progress / payment', () => {
    assert.equal(mapBookingStatusToTvLane('waiting'), 'waiting')
    assert.equal(mapBookingStatusToTvLane('in_progress'), 'in_progress')
    assert.equal(mapBookingStatusToTvLane('final_checking'), 'in_progress')
    assert.equal(mapBookingStatusToTvLane('for_payment'), 'for_payment')
    assert.equal(mapBookingStatusToTvLane('for_releasing'), 'for_payment')
    assert.equal(mapBookingStatusToTvLane('pending'), null)
    assert.equal(mapBookingStatusToTvLane('confirmed'), null)
    assert.equal(mapBookingStatusToTvLane('redo'), null)
    assert.equal(mapBookingStatusToTvLane('completed'), null)
    assert.deepEqual(
      TV_BOARD_LANES.map((l) => l.id),
      ['waiting', 'in_progress', 'for_payment'],
    )
  })

  it('scales density as a lane fills', () => {
    assert.equal(tvBoardDensity(2), 1)
    assert.equal(tvBoardDensity(4), 1)
    assert.equal(tvBoardDensity(7), 2)
    assert.equal(tvBoardDensity(12), 3)
    assert.equal(tvBoardDensity(18), 4)
    assert.equal(tvBoardDensity(20), 5)
  })

  it('formats vehicle line, crew, and Manila clock', () => {
    assert.equal(formatTvVehicleLine({ vehicle_make: 'Raize', vehicle_model: '', vehicle_type: 'medium' }), 'Raize · medium')
    assert.equal(formatTvVehicleLine({ vehicle_make: 'Bigbike', vehicle_type: 'extra_large' }), 'Bigbike · extra large')
    assert.equal(tvCrewLabel('Ben Ronie, Rowel Jack'), 'Ben Ronie  Rowel Jack')
    assert.equal(tvIsMotorcycle({ vehicle_type: 'medium', vehicle_make: 'Raize' }), false)
    assert.equal(tvIsMotorcycle({ vehicle_make: 'Bigbike', vehicle_type: 'extra_large' }), true)
    assert.equal(tvIsMotorcycle({ vehicle_type: 'motorcycle' }), true)
    const clock = formatTvClock(new Date('2026-09-21T17:04:44+08:00'))
    assert.match(clock, /Monday/)
    assert.match(clock, /September 21, 2026/)
    assert.match(clock, /05:04:44/)
  })

  it('groups visit services and drops PII-only statuses', () => {
    const model = buildPublicTvBoardModel(
      [
        {
          booking_id: '1',
          visit_group_id: 'g1',
          branch: 'bacoor',
          status: 'in_progress',
          vehicle_plate: 'njl-9092',
          vehicle_make: 'Raize',
          vehicle_type: 'medium',
          service_name: 'Premium Car Wash',
          service_pay_category: 'wash',
          crew_names: 'Ben Ronie',
        },
        {
          booking_id: '2',
          visit_group_id: 'g1',
          branch: 'bacoor',
          status: 'in_progress',
          vehicle_plate: 'NJL-9092',
          vehicle_make: 'Raize',
          vehicle_type: 'medium',
          service_name: 'Glass Coating',
          service_pay_category: 'addon',
          crew_names: 'Ben Ronie',
        },
        {
          booking_id: '3',
          branch: 'bacoor',
          status: 'for_releasing',
          vehicle_plate: 'DCC-7503',
          vehicle_make: 'Stargazer',
          vehicle_type: 'medium',
          service_name: 'Ceramic Coating',
          service_pay_category: 'detailing',
          crew_names: 'Ronel Jeffrey',
        },
        {
          booking_id: '4',
          branch: 'bacoor',
          status: 'pending',
          vehicle_plate: 'HIDE',
          service_name: 'Should not show',
          service_pay_category: 'detailing',
        },
      ],
      'bacoor',
    )
    assert.equal(model.lanes.in_progress.length, 1)
    assert.deepEqual(model.lanes.in_progress[0].services, ['Premium Car Wash', 'Glass Coating'])
    assert.equal(model.lanes.in_progress[0].plate, 'NJL-9092')
    assert.equal(model.lanes.in_progress[0].vehicleLine, 'Raize · medium')
    assert.equal(model.lanes.in_progress[0].crew, 'Ben Ronie')
    assert.equal(model.lanes.for_payment.length, 1)
    assert.equal(model.lanes.for_payment[0].kindLabel, 'Detailing')
    assert.equal(model.counts.total, 2)
    assert.equal(model.lanes.waiting.length, 0)
    assert.equal(model.lanes.in_progress[0].isMotorcycle, false)
  })

  it('groups mixed wash + detailing on one plate and marks bikes', () => {
    const model = buildPublicTvBoardModel(
      [
        {
          booking_id: 'a',
          visit_group_id: 'g',
          branch: 'bacoor',
          queue_number: 12,
          status: 'waiting',
          vehicle_plate: 'TGD2134',
          vehicle_make: 'Toyota',
          vehicle_model: 'Fortuner',
          vehicle_type: 'medium',
          service_name: 'Carwash',
          service_pay_category: 'wash',
        },
        {
          booking_id: 'b',
          visit_group_id: 'g',
          branch: 'bacoor',
          queue_number: 13,
          status: 'waiting',
          vehicle_plate: 'TGD2134',
          vehicle_make: 'Toyota',
          vehicle_model: 'Fortuner',
          vehicle_type: 'medium',
          service_name: 'Interior Detailing',
          service_pay_category: 'general',
        },
        {
          booking_id: 'c',
          branch: 'bacoor',
          queue_number: 2,
          status: 'in_progress',
          vehicle_plate: '237-ABC',
          vehicle_make: 'Bigbike',
          vehicle_type: 'large',
          service_name: 'Motorcycle Wash',
          service_pay_category: 'wash',
          crew_names: 'Roger',
        },
      ],
      'bacoor',
    )
    assert.equal(model.lanes.waiting.length, 1)
    assert.deepEqual(model.lanes.waiting[0].services, ['Carwash', 'Interior Detailing'])
    assert.equal(model.lanes.in_progress[0].isMotorcycle, true)
    assert.equal(model.lanes.in_progress[0].crew, 'Roger')
  })
})
