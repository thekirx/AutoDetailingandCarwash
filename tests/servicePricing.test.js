/**
 * Service size pricing helpers.
 * Run: node tests/servicePricing.test.js
 */
import assert from 'node:assert/strict'
import {
  formatSizePriceRange,
  normalizePricingSize,
  resolveServicePriceMinor,
  sizePricesMap,
} from '../src/lib/servicePricing.js'
import { validateServiceInput } from '../src/lib/opsValidation.js'
import { canManageServices } from '../src/auth/permissions.js'

const svc = {
  price_minor: 50000,
  size_prices: { small: 40000, medium: 50000, large: 65000, extra_large: 80000 },
}

assert.equal(normalizePricingSize('Large'), 'large')
assert.equal(normalizePricingSize('suv'), 'large')
assert.equal(normalizePricingSize('sedan'), 'medium')
assert.equal(resolveServicePriceMinor(svc, 'small'), 40000)
assert.equal(resolveServicePriceMinor(svc, 'extra_large'), 80000)
assert.equal(resolveServicePriceMinor(svc, 'suv'), 65000)
assert.equal(resolveServicePriceMinor({ price_minor: 1000 }, 'medium'), 1000)

const mapped = sizePricesMap({
  service_size_prices: [
    { size_slug: 'small', price_minor: 1 },
    { size_slug: 'medium', price_minor: 2 },
  ],
})
assert.equal(mapped.small, 1)
assert.equal(mapped.medium, 2)

assert.match(
  formatSizePriceRange(svc, (n) => `P${n / 100}`),
  /P400–P800/,
)

const v = validateServiceInput({
  name: 'Wash',
  size_prices: { small: '100', medium: '150', large: '200', extra_large: '250' },
})
assert.equal(v.price_minor, 15000)
assert.equal(v.size_price_minor.large, 20000)

assert.equal(
  canManageServices({ role: 'assistant_super_admin', permission_grants: { services_merch: true } }),
  true,
)
assert.equal(canManageServices({ role: 'BossMich' }), true)
assert.equal(canManageServices({ role: 'admin' }), false)
assert.equal(canManageServices({ role: 'staff' }), false)

console.log('servicePricing: ok')
