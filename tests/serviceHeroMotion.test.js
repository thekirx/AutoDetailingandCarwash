import test from 'node:test'
import assert from 'node:assert/strict'

import { serviceHeroProgress } from '../src/lib/serviceHeroMotion.js'

test('service hero progress is stable at the top and clamps beyond the hero', () => {
  assert.equal(serviceHeroProgress(-120, 800), 0)
  assert.equal(serviceHeroProgress(0, 800), 0)
  assert.equal(serviceHeroProgress(800, 800), 1)
  assert.equal(serviceHeroProgress(1200, 800), 1)
})

test('service hero progress follows scroll position through the hero', () => {
  assert.equal(serviceHeroProgress(200, 800), 0.25)
  assert.equal(serviceHeroProgress(400, 800), 0.5)
})

test('service hero progress safely handles an unavailable hero height', () => {
  assert.equal(serviceHeroProgress(400, 0), 0)
  assert.equal(serviceHeroProgress(400, Number.NaN), 0)
})
