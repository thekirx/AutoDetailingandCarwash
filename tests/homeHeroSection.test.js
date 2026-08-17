import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const projectFile = (path) => new URL(`../${path}`, import.meta.url)

describe('Home cinematic hero', () => {
  it('declares the approved copy, destinations, and decorative placeholder media', async () => {
    const source = await readFile(projectFile('src/components/public/home/HomeHeroSection.jsx'), 'utf8')

    assert.equal((source.match(/<h1/g) || []).length, 1)
    assert.match(source, /Pamper it\. Protect it\./)
    assert.match(source, /Precision detailing, ceramic coating, and paint protection for drivers who care how their finish lasts\./)
    assert.match(source, /to="\/book"/)
    assert.match(source, /to="\/services"/)
    assert.equal((source.match(/<video/g) || []).length, 2)
    const presentationVideos = source.match(/<video[\s\S]*?aria-hidden="true"[\s\S]*?role="presentation"[\s\S]*?\/>/g) || []
    assert.equal(presentationVideos.length, 2)
    assert.match(source, /PLACEHOLDER-hakum-precision-01\.mp4/)
    assert.match(source, /PLACEHOLDER-hakum-protection-02\.mp4/)
    assert.match(source, /hakum-hero\.webp/)
    assert.doesNotMatch(source, /Hakum milestones|Experience/)
  })

  it('scopes GSAP and cleans up pointer, media, and scroll behavior', async () => {
    const source = await readFile(projectFile('src/components/public/home/HomeHeroSection.jsx'), 'utf8')

    assert.match(source, /gsap\.context\(/)
    assert.match(source, /context\.revert\(\)/)
    assert.match(source, /ScrollTrigger/)
    assert.match(source, /yPercent:\s*15/)
    assert.match(source, /prefers-reduced-motion:\s*reduce/)
    assert.match(source, /removeEventListener\(['"]pointermove['"]/)
    assert.match(source, /removeEventListener\(['"]ended['"]/)
    assert.match(source, /removeEventListener\(['"]error['"]/)
    assert.doesNotMatch(source, /pin:\s*true/)
  })
})
