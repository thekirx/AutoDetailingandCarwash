import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { describe, it } from 'node:test'
import { readGatewayOperation } from '../server/apiGateway.mjs'

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))

const expected = {
  '/api/booking-status': '/api/bookings?operation=booking-status',
  '/api/busybee': '/api/notifications?operation=busybee',
  '/api/customer-auth-lookup': '/api/customer?operation=customer-auth-lookup',
  '/api/customer-history': '/api/customer?operation=customer-history',
  '/api/customer-portal': '/api/customer?operation=customer-portal',
  '/api/customer-signup': '/api/customer?operation=customer-signup',
  '/api/data-center': '/api/data-center?operation=data-center',
  '/api/lifecycle-sms': '/api/notifications?operation=lifecycle-sms',
  '/api/notify-booking': '/api/notifications?operation=notify-booking',
  '/api/notify-ops-form': '/api/notifications?operation=notify-ops-form',
  '/api/notification-broadcast': '/api/notifications?operation=notification-broadcast',
  '/api/notification-broadcast-kinds': '/api/notifications?operation=notification-broadcast-kinds',
  '/api/notification-templates': '/api/notifications?operation=notification-templates',
  '/api/birthday-greetings': '/api/notifications?operation=birthday-greetings',
  '/api/notification-settings': '/api/notifications?operation=notification-settings',
  '/api/plate-lookup': '/api/bookings?operation=plate-lookup',
  '/api/provision-customer': '/api/customer?operation=provision-customer',
  '/api/provision-staff': '/api/staff?operation=provision-staff',
  '/api/public-book': '/api/bookings?operation=public-book',
  '/api/push-subscribe': '/api/notifications?operation=push-subscribe',
  '/api/send-finance-quote': '/api/finance?operation=send-finance-quote',
  '/api/send-push': '/api/notifications?operation=send-push',
  '/api/update-staff': '/api/staff?operation=update-staff',
}

function applyDocumentedRewrite(input) {
  const incoming = new URL(input, 'https://hakum.example')
  const destination = new URL(expected[incoming.pathname], 'https://hakum.example')
  for (const [key, value] of incoming.searchParams) {
    destination.searchParams.append(key, value)
  }
  return destination
}

describe('Vercel API rewrite contract', () => {
  it('maps every legacy API URL to one fixed domain operation', () => {
    const actual = Object.fromEntries(
      config.rewrites
        .filter(({ source }) => source.startsWith('/api/'))
        .map(({ source, destination }) => [source, destination]),
    )

    assert.deepEqual(actual, expected)
  })

  it('keeps the SPA fallback after all exact API rewrites', () => {
    assert.deepEqual(config.rewrites.at(-1), {
      source: '/((?!api/|assets/).*)',
      destination: '/index.html',
    })
  })

  it('allows Three.js wasm + blob under CSP and keeps assets off the SPA rewrite', () => {
    const csp = config.headers
      .flatMap((block) => block.headers)
      .find((header) => header.key === 'Content-Security-Policy')
      ?.value
    assert.match(csp, /wasm-unsafe-eval/)
    assert.match(csp, /connect-src[^;]*blob:/)
    assert.match(csp, /worker-src 'self' blob:/)

    const geo = config.headers
      .flatMap((block) => block.headers)
      .find((header) => header.key === 'Permissions-Policy')
      ?.value
    assert.match(geo, /geolocation=\(self\)/)
  })

  it('preserves plate lookup query parameters beside the fixed operation', () => {
    const destination = applyDocumentedRewrite('/api/plate-lookup?plate=ABC123')

    assert.equal(destination.pathname, '/api/bookings')
    assert.deepEqual(destination.searchParams.getAll('operation'), ['plate-lookup'])
    assert.equal(destination.searchParams.get('plate'), 'ABC123')
  })

  it('turns a caller operation override into a rejected duplicate', () => {
    const destination = applyDocumentedRewrite(
      '/api/plate-lookup?operation=send-push&plate=ABC123',
    )

    assert.deepEqual(destination.searchParams.getAll('operation'), ['plate-lookup', 'send-push'])
    assert.equal(readGatewayOperation({ url: destination.pathname + destination.search }), null)
  })

  it('contains exactly six deployable JavaScript function entrypoints', () => {
    const files = readdirSync(new URL('../api/', import.meta.url))
      .filter((file) => file.endsWith('.js'))
      .sort()

    assert.deepEqual(files, [
      'bookings.js',
      'customer.js',
      'data-center.js',
      'finance.js',
      'notifications.js',
      'staff.js',
    ])
  })
})
