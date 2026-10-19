import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildPaymentAnnouncement } from '../src/lib/paymentAnnouncement.js'
import { QUEUE_STATUS_SMS } from '../src/lib/queueStatusSmsTemplates.js'
import {
  omitSmsName,
  preferStoredCustomerName,
  renderQueueStatusSms,
  smsCarLabel,
  smsCustomerName,
} from '../src/lib/queueStatusSms.js'

const LINE = 'Toyota Vios, plate N B C, 4 8 2 1, is ready for payment.'

describe('queue status SMS', () => {
  it('has 20 lines for each floor status from the Hakum sheet', () => {
    for (const status of ['waiting', 'in_progress', 'final_checking', 'for_payment', 'completed']) {
      assert.equal(QUEUE_STATUS_SMS[status].length, 20, status)
    }
  })

  it('uses a real first name and the car, and skips walk-in labels', () => {
    const named = {
      customer_name: 'Ana Cruz',
      vehicle_make: 'Toyota',
      vehicle_model: 'Vios',
    }
    assert.equal(smsCustomerName(named), 'Ana')
    assert.equal(smsCarLabel(named), 'Toyota Vios')
    assert.equal(smsCustomerName({ customer_name: 'Walk-in · ABC1234' }), '')
    assert.equal(
      renderQueueStatusSms('waiting', named, () => 0),
      "Hi Ana! We've checked in your Toyota Vios. We'll begin shortly, thank you for waiting.",
    )
    const walk = renderQueueStatusSms(
      'waiting',
      { customer_name: 'Walk-in · ABC1234', vehicle_plate: 'ABC1234' },
      () => 0,
    )
    assert.equal(walk, "We've checked in your ABC1234. We'll begin shortly, thank you for waiting.")
    assert.doesNotMatch(walk, /Walk-in|\{Name\}|\{Car\}/)
  })

  it('keeps an existing CRM name when the ticket is still a walk-in label', () => {
    assert.equal(preferStoredCustomerName('Walk-in · ABC1234', 'Ben Santos'), 'Ben Santos')
    assert.equal(preferStoredCustomerName('Ana Cruz', 'Other Person'), 'Ana Cruz')
    const sms = renderQueueStatusSms(
      'for_payment',
      { customer_name: 'Walk-in · ABC1234', customers: { full_name: 'Ben Santos' } },
      () => 0,
    )
    assert.match(sms, /^Hi Ben! All done on our end!/)
  })

  it('leaves payment and final check unnamed when no real name is stored', () => {
    const booking = { customer_name: 'Walk-in · ABC1234', vehicle_plate: 'ABC1234' }
    assert.doesNotMatch(renderQueueStatusSms('for_payment', booking, () => 0), /Walk-in|Hi /)
    assert.doesNotMatch(renderQueueStatusSms('final_checking', booking, () => 0), /Walk-in|\{Name\}/)
  })

  it('picks different lines so repeats are not the same text', () => {
    const booking = { customer_name: 'Ana', vehicle_plate: 'ABC1234' }
    const first = renderQueueStatusSms('completed', booking, () => 0)
    const last = renderQueueStatusSms('completed', booking, () => 0.999)
    assert.match(first, /^Thank you, Ana!/)
    assert.notEqual(first, last)
    assert.match(last, /Ana/)
  })

  it('drops an empty greeting without eating the rest of the line', () => {
    assert.equal(
      omitSmsName('Welcome to Hakum, {Name}! Your {Car} is up next.'),
      'Welcome to Hakum! Your {Car} is up next.',
    )
    assert.equal(omitSmsName('{Name}, thank you for trusting us.'), 'Thank you for trusting us.')
    assert.equal(omitSmsName('Salamat po, {Name}! Drive safe!'), 'Salamat po! Drive safe!')
  })
})

describe('voice line stays free of the customer name', () => {
  it('the counter announcement is the car and plate only', () => {
    assert.equal(
      buildPaymentAnnouncement({ make: 'Toyota', model: 'Vios', plate: 'NBC 4821' }),
      LINE,
    )
  })
})
