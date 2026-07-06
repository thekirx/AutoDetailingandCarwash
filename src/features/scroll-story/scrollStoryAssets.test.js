import { describe, expect, it } from 'vitest'
import { scrollStoryAssets } from './scrollStoryAssets'
import { packageOptions, storyStages } from './scrollStoryData'

describe('scroll story contracts', () => {
  it('exposes every replaceable vehicle state through one manifest', () => {
    expect(Object.keys(scrollStoryAssets.vehicle)).toEqual([
      'dirty',
      'washed',
      'detailed',
      'ppf',
      'ceramic',
    ])

    Object.values(scrollStoryAssets.vehicle).forEach((url) => {
      expect(url).toMatch(/\.(png|webp)$/)
    })
  })

  it('keeps carwash shortest and PPF longest', () => {
    const weights = Object.fromEntries(storyStages.map(({ id, weight }) => [id, weight]))

    expect(weights.carwash).toBe(Math.min(...Object.values(weights)))
    expect(weights.ppf).toBe(Math.max(...Object.values(weights)))
  })

  it('maps every package preview to a manifest state', () => {
    const stateNames = Object.keys(scrollStoryAssets.vehicle)

    packageOptions.forEach(({ state }) => expect(stateNames).toContain(state))
  })
})
