import test from 'node:test'
import assert from 'node:assert/strict'

import { LEGACY_MARKETING_REDIRECTS, PUBLIC_NAV_ITEMS } from '../src/data/publicNavigation.js'

test('primary navigation removes the standalone Packages destination', () => {
  assert.deepEqual(
    PUBLIC_NAV_ITEMS.map(([label, path]) => `${label}:${path}`),
    [
      'Home:/home',
      'Services:/services',
      'Branch:/branches',
      'Live Queue:/queue',
      'Events & Blogs:/events',
    ],
  )
})

test('the retired Packages URL has a stable services redirect', () => {
  assert.equal(LEGACY_MARKETING_REDIRECTS['/packages'], '/services')
})
