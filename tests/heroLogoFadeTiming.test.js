import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isHeroLogoMoment } from '../src/lib/homeHero.js'

test('copy can fade before a closing logo without revealing early at the opening', () => {
  assert.equal(isHeroLogoMoment('hakum-desktop', 14, 0.75), true)
  assert.equal(isHeroLogoMoment('hakum-desktop', 4.2, 0.75), true)
  assert.equal(isHeroLogoMoment('hakum-desktop', 4.4, 0.75), false)
  assert.equal(isHeroLogoMoment('hakum-desktop', 7, 0.75), false)
  assert.equal(isHeroLogoMoment('mobile', 8.6, 0.75), true)
  assert.equal(isHeroLogoMoment('mobile', 0, 0.75), false)
  assert.equal(isHeroLogoMoment('mobile', 6, 0.75), false)
  assert.equal(isHeroLogoMoment('hakum-desktop', 14), false)
})
