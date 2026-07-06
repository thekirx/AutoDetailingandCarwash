/* @vitest-environment jsdom */
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePinnedCarStory } from './usePinnedCarStory'

const mocks = vi.hoisted(() => {
  const timeline = {
    fromTo: vi.fn(),
    set: vi.fn(),
    to: vi.fn(),
  }
  timeline.fromTo.mockReturnValue(timeline)
  timeline.set.mockReturnValue(timeline)
  timeline.to.mockReturnValue(timeline)

  return {
    contextRevert: vi.fn(),
    create: vi.fn(),
    timeline,
  }
})

vi.mock('gsap', () => ({
  default: {
    context: (callback) => {
      callback()
      return { revert: mocks.contextRevert }
    },
    registerPlugin: vi.fn(),
    set: vi.fn(),
    timeline: () => mocks.timeline,
  },
}))

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: { create: mocks.create },
}))

function StoryHarness() {
  const { storyRef } = usePinnedCarStory()
  return <section ref={storyRef}>
    <div data-pin-stage />
    <article data-story-stage="arrival" />
    <article data-story-stage="carwash" />
    <article data-story-stage="detailing" />
    <article data-story-stage="ppf" />
    <article data-story-stage="ceramic" />
  </section>
}

describe('usePinnedCarStory', () => {
  beforeEach(() => {
    mocks.create.mockClear()
    mocks.contextRevert.mockClear()
    window.matchMedia = vi.fn().mockReturnValue({ matches: false })
  })

  afterEach(cleanup)

  it('creates one scrubbed pinned trigger and reverts it on cleanup', () => {
    const view = render(<StoryHarness />)

    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ pin: expect.anything(), scrub: true }))

    view.unmount()
    expect(mocks.contextRevert).toHaveBeenCalledTimes(1)
  })

  it('does not pin or animate when reduced motion is requested', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    render(<StoryHarness />)

    expect(mocks.create).not.toHaveBeenCalled()
  })
})
