import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ppfInformation } from '../src/data/publicHomeContent.js'
import { getPpfCaptionKey, getPpfFrameIndex, getPpfStoryState } from '../src/lib/ppfScrollStory.js'

describe('PPF scroll story mapping', () => {
  it('holds the first frame throughout the introduction', () => {
    assert.deepEqual(getPpfStoryState(0, ppfInformation, 110), {
      frame: 0,
      activeChapter: -1,
      showIntroduction: true,
      phase: 'introduction',
    })
    assert.equal(getPpfStoryState(0.119, ppfInformation, 110).frame, 0)
  })

  it('maps the remaining scroll distance across every frame', () => {
    assert.equal(getPpfFrameIndex(0.12, 110), 0)
    assert.equal(getPpfFrameIndex(1, 110), 109)
    assert.ok(getPpfStoryState(0.575, ppfInformation, 110).frame > 50)
  })

  it('keeps a chapter visible throughout the installation sequence', () => {
    assert.equal(getPpfStoryState(0.119, ppfInformation, 110).showIntroduction, true)
    assert.equal(getPpfStoryState(0.12, ppfInformation, 110).activeChapter, 0)
    assert.equal(getPpfStoryState(0.319, ppfInformation, 110).activeChapter, 0)
    assert.equal(getPpfStoryState(0.32, ppfInformation, 110).activeChapter, 1)
    assert.equal(getPpfStoryState(0.549, ppfInformation, 110).activeChapter, 1)
    assert.equal(getPpfStoryState(0.55, ppfInformation, 110).activeChapter, 2)
    assert.equal(getPpfStoryState(0.779, ppfInformation, 110).activeChapter, 2)
    assert.equal(getPpfStoryState(0.78, ppfInformation, 110).activeChapter, 3)
    assert.equal(getPpfStoryState(1, ppfInformation, 110).activeChapter, 3)
  })

  it('clamps progress outside the scroll range', () => {
    assert.equal(getPpfStoryState(-1, ppfInformation, 110).frame, 0)
    assert.equal(getPpfStoryState(2, ppfInformation, 110).frame, 109)
  })

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
