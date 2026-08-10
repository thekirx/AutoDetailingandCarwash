import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import customerGateway, { operations as customer } from '../api/customer.js'
import staffGateway, { operations as staff } from '../api/staff.js'
import bookingsGateway, { operations as bookings } from '../api/bookings.js'
import notificationsGateway, { operations as notifications } from '../api/notifications.js'
import financeGateway, { operations as finance } from '../api/finance.js'
import dataCenterGateway, { operations as dataCenter } from '../api/data-center.js'

function response() {
  const out = { statusCode: 200, headers: {}, body: '' }
  return {
    out,
    setHeader(name, value) {
      out.headers[name] = value
    },
    end(body = '') {
      out.body = body
    },
    get statusCode() {
      return out.statusCode
    },
    set statusCode(value) {
      out.statusCode = value
    },
  }
}

const domains = [
  [
    'customer',
    customerGateway,
    customer,
    ['customer-auth-lookup', 'customer-history', 'customer-portal', 'customer-signup', 'provision-customer'],
  ],
  ['staff', staffGateway, staff, ['provision-staff', 'update-staff']],
  ['bookings', bookingsGateway, bookings, ['booking-status', 'plate-lookup', 'public-book']],
  [
    'notifications',
    notificationsGateway,
    notifications,
    ['busybee', 'lifecycle-sms', 'notification-broadcast', 'notification-settings', 'notify-booking', 'push-subscribe', 'send-push'],
  ],
  ['finance', financeGateway, finance, ['send-finance-quote']],
  ['data-center', dataCenterGateway, dataCenter, ['data-center']],
]

describe('domain gateway allowlists', () => {
  for (const [name, gateway, operations, expected] of domains) {
    it(`${name} exposes exactly its fixed operation map`, () => {
      assert.deepEqual(Object.keys(operations).sort(), expected)
      assert.equal(Object.isFrozen(operations), true)
    })

    it(`${name} rejects a cross-domain operation`, async () => {
      const res = response()

      await gateway({ url: `/api/${name}?operation=not-in-${name}` }, res)

      assert.equal(res.out.statusCode, 404)
      assert.deepEqual(JSON.parse(res.out.body), { error: 'Not found' })
    })

    for (const operation of expected) {
      it(`${name} dispatches OPTIONS for ${operation}`, async () => {
        const res = response()

        await gateway(
          {
            method: 'OPTIONS',
            url: `/api/${name}?operation=${operation}`,
            headers: { host: 'localhost:5173' },
          },
          res,
        )

        assert.equal(res.out.statusCode, 204)
      })
    }
  }
})
