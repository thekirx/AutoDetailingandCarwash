import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const projectFile = (path) => new URL(`../${path}`, import.meta.url)

describe('Homepage motion boundaries', () => {
  it('plays a per-orientation video hero and keeps the experience block', async () => {
    const source = await readFile(projectFile('src/components/public/home/HomeHeroSection.jsx'), 'utf8')

    assert.match(source, /Pamper it\./)
    assert.match(source, /Protect it\./)
    assert.match(source, /className="hero-experience"/)
    assert.match(source, /<StatCard/)

    /* Two cuts, chosen by viewport: the landscape edit crops badly on a phone. */
    assert.match(source, /desktop-hero\.mp4/)
    assert.match(source, /mobile-hero\.mp4/)
    assert.match(source, /getHeroVideoVariant/)

    /* Muted + playsInline are what let the loop autoplay at all on mobile. */
    assert.match(source, /playsInline/)
    assert.match(source, /muted/)

    /* Scroll animation stays out of the hero — GSAP belongs to the PPF sequence. */
    assert.doesNotMatch(source, /\bgsap\b|ScrollTrigger|hero-cinematic/)
  })

  it('hides the headline while the logo is on screen, and lets a tap bring it back', async () => {
    const source = await readFile(projectFile('src/components/public/home/HomeHeroSection.jsx'), 'utf8')

    /* The overlay and the Hakum mark must never share the frame. */
    assert.match(source, /isHeroLogoMoment/)
    assert.match(source, /is-logo-moment/)

    /* Touching the hero reveals the copy even mid-logo. */
    assert.match(source, /onPointerDown/)
    assert.match(source, /revealOverride/)

    /* A hero that opens on the logo starts hidden, so a refused autoplay must
       not be able to leave it blank forever. */
    assert.match(source, /videoBlocked/)
    assert.match(source, /onError/)
  })

  it('retains GSAP for the PPF installation sequence', async () => {
    const source = await readFile(projectFile('src/components/public/home/PpfInstallSequence.jsx'), 'utf8')

    assert.match(source, /import gsap from ['"]gsap['"]/)
    assert.match(source, /ScrollTrigger/)
    assert.match(source, /ScrollTrigger\.create\(/)
    assert.match(source, /trigger\.kill\(\)/)
  })
})
