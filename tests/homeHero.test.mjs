import assert from 'node:assert/strict'
import { test } from 'node:test'

import * as homeHero from '../src/lib/homeHero.js'

test('phone and breakpoint widths select the portrait hero', () => {
  assert.equal(homeHero.getHeroVideoVariant?.(390), 'mobile')
  assert.equal(homeHero.getHeroVideoVariant?.(800), 'mobile')
})

test('desktop widths select the landscape hero', () => {
  assert.equal(homeHero.getHeroVideoVariant?.(801), 'desktop')
  assert.equal(homeHero.getHeroVideoVariant?.(1440), 'desktop')
})

test('desktop content waits five seconds and clears again for the closing logo', () => {
  assert.equal(homeHero.isHeroLogoMoment?.('desktop', 0), true)
  assert.equal(homeHero.isHeroLogoMoment?.('desktop', 4.9), true)
  assert.equal(homeHero.isHeroLogoMoment?.('desktop', 5), false)
  assert.equal(homeHero.isHeroLogoMoment?.('desktop', 13.7), true)
})

test('mobile overlay clears only for its closing logo reveal', () => {
  assert.equal(homeHero.isHeroLogoMoment?.('mobile', 0), false)
  assert.equal(homeHero.isHeroLogoMoment?.('mobile', 9.5), false)
  assert.equal(homeHero.isHeroLogoMoment?.('mobile', 10), true)
})

test('click override is cleared when the closing desktop logo begins', () => {
  assert.equal(homeHero.hasHeroLogoMomentRestarted?.('desktop', 13.5, 13.7), true)
})

test('click override is cleared when either video loop restarts', () => {
  assert.equal(homeHero.hasHeroLogoMomentRestarted?.('desktop', 16.2, 0.2), true)
  assert.equal(homeHero.hasHeroLogoMomentRestarted?.('mobile', 12.9, 0.2), true)
})

test('ordinary playback does not clear a click override', () => {
  assert.equal(homeHero.hasHeroLogoMomentRestarted?.('desktop', 2, 2.5), false)
  assert.equal(homeHero.hasHeroLogoMomentRestarted?.('mobile', 6, 6.5), false)
})
