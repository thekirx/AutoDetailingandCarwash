import assert from 'node:assert/strict'
import { test } from 'node:test'

import { HOME_SECTION_IDS } from '../src/data/publicHomeContent.js'

test('homepage content targets exclude the dedicated partnerships page', () => {
  assert.equal(HOME_SECTION_IDS.includes('partnership'), false)
})
