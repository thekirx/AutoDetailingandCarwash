import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ppfInformation } from '../src/data/publicHomeContent.js'
import { getPpfFrameIndex, getPpfStoryState } from '../src/lib/ppfScrollStory.js'

describe('PPF scroll story mapping', () => {
  it('holds the first frame throughout the introduction', () => {
    assert.deepEqual(getPpfStoryState(0, ppfInformation.chapters, 110), {
      frame: 0,
      activeChapter: -1,
      phase: 'introduction',
    })
    assert.equal(getPpfStoryState(0.149, ppfInformation.chapters, 110).frame, 0)
  })

  it('maps the remaining scroll distance across every frame', () => {
    assert.equal(getPpfFrameIndex(0.15, 110), 0)
    assert.equal(getPpfFrameIndex(1, 110), 109)
    assert.ok(getPpfStoryState(0.575, ppfInformation.chapters, 110).frame > 50)
  })

  it('selects one chapter at each approved boundary in both directions', () => {
    assert.equal(getPpfStoryState(0.15, ppfInformation.chapters, 110).activeChapter, 0)
    assert.equal(getPpfStoryState(0.349, ppfInformation.chapters, 110).activeChapter, 0)
    assert.equal(getPpfStoryState(0.35, ppfInformation.chapters, 110).activeChapter, 1)
    assert.equal(getPpfStoryState(0.55, ppfInformation.chapters, 110).activeChapter, 2)
    assert.equal(getPpfStoryState(0.75, ppfInformation.chapters, 110).activeChapter, 3)
    assert.equal(getPpfStoryState(1, ppfInformation.chapters, 110).activeChapter, 3)
  })

  it('clamps progress outside the scroll range', () => {
    assert.equal(getPpfStoryState(-1, ppfInformation.chapters, 110).frame, 0)
    assert.equal(getPpfStoryState(2, ppfInformation.chapters, 110).frame, 109)
  })
})
