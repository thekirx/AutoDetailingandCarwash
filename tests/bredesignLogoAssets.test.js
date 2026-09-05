import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const LOGOS = [
  'clearpro',
  'f1-auto-films',
  'kisho',
  'menzerna',
  'rupes',
  'sonax',
  'meguiars',
  'microtex',
]

describe('BreDESIGN supplier logo assets', () => {
  for (const logo of LOGOS) {
    it(`${logo} has a transparent ground instead of a rectangular tile`, async () => {
      const image = sharp(fileURLToPath(new URL(`../src/assets/brands/${logo}.png`, import.meta.url)))
      const metadata = await image.metadata()
      assert.equal(metadata.hasAlpha, true)

      const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      const topLeftAlpha = data[3]
      let visiblePixels = 0
      for (let index = 3; index < data.length; index += info.channels) {
        if (data[index] > 0) visiblePixels += 1
      }

      assert.equal(topLeftAlpha, 0)
      assert.ok(visiblePixels > 100, 'expected the logo mark to remain visible')
    })
  }

  it("preserves the Meguiar's lettering instead of filling its badge silhouette", async () => {
    const image = sharp(fileURLToPath(new URL('../src/assets/brands/meguiars.png', import.meta.url)))
    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    let visiblePixels = 0
    for (let index = 3; index < data.length; index += info.channels) {
      if (data[index] > 20) visiblePixels += 1
    }
    const visibleRatio = visiblePixels / (info.width * info.height)

    assert.ok(visibleRatio < 0.22, `expected an open wordmark, received ${visibleRatio} opaque coverage`)
  })
})
