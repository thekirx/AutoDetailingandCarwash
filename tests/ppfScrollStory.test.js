import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ppfInformation } from '../src/data/publicHomeContent.js'
import { getPpfCaptionKey } from '../src/lib/ppfScrollStory.js'

describe('PPF scroll story captions', () => {
  it('selects exactly one production caption at every story boundary', () => {
    const cases = [
      [0, 'introduction'],
      [0.1199, 'introduction'],
      [0.12, 0],
      [0.3199, 0],
      [0.32, 1],
      [0.5499, 1],
      [0.55, 2],
      [0.7799, 2],
      [0.78, 3],
      [1, 3],
    ]

    for (const [progress, expected] of cases) {
      assert.equal(getPpfCaptionKey(progress, ppfInformation), expected)
    }
  })

  it('clamps overscroll to the first and final captions', () => {
    assert.equal(getPpfCaptionKey(-0.5, ppfInformation), 'introduction')
    assert.equal(getPpfCaptionKey(1.5, ppfInformation), 3)
  })
})
