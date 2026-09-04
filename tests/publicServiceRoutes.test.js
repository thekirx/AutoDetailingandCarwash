import test from 'node:test'
import assert from 'node:assert/strict'

import { LEGACY_MARKETING_REDIRECTS, PUBLIC_NAV_ITEMS } from '../src/data/publicNavigation.js'

test('primary navigation removes the standalone Packages destination', () => {
  assert.deepEqual(
    PUBLIC_NAV_ITEMS.map(([label, path]) => `${label}:${path}`),
    [
      'Main:/home',
      'Services:/services',
      'Branch:/branches',
      'Brand Collabs:/partnerships',
      'Events:/events',
      'Blog:/blog',
      'Live Queue:/queue',
      'Contact:/contact',
    ],
  )
})

test('the retired Packages URL has a stable services redirect', () => {
  assert.equal(LEGACY_MARKETING_REDIRECTS['/packages'], '/services')
})
