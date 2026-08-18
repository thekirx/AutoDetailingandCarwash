import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { describe, it } from 'node:test'

const projectFile = (path) => new URL(`../${path}`, import.meta.url)

const countMarker = (buffer, marker) => {
  let count = 0
  let offset = -1
  while ((offset = buffer.indexOf(marker, offset + 1)) !== -1) count += 1
  return count
}

const inspectMp4 = (buffer) => {
  const avcMarker = Buffer.from('avc1')
  const sampleEntryOffset = buffer.indexOf(avcMarker, buffer.indexOf(avcMarker) + 1)
  const movieHeaderOffset = buffer.indexOf(Buffer.from('mvhd'))
  const timescale = buffer.readUInt32BE(movieHeaderOffset + 16)
  const durationUnits = buffer.readUInt32BE(movieHeaderOffset + 20)

  return {
    duration: durationUnits / timescale,
    height: buffer.readUInt16BE(sampleEntryOffset + 30),
    soundTracks: countMarker(buffer, Buffer.from('soun')),
    videoTracks: countMarker(buffer, Buffer.from('vide')),
    width: buffer.readUInt16BE(sampleEntryOffset + 28),
  }
}

describe('Home cinematic hero', () => {
  it('declares the approved copy, destinations, and decorative production media', async () => {
    const source = await readFile(projectFile('src/components/public/home/HomeHeroSection.jsx'), 'utf8')

    assert.equal((source.match(/<h1/g) || []).length, 1)
    assert.match(source, /Pamper it\. Protect it\./)
    assert.match(source, /Precision detailing, ceramic coating, and paint protection for drivers who care how their finish lasts\./)
    assert.match(source, /to="\/book"/)
    assert.match(source, /to="\/services"/)
    assert.equal((source.match(/<video/g) || []).length, 2)
    const presentationVideos = source.match(/<video[\s\S]*?aria-hidden="true"[\s\S]*?role="presentation"[\s\S]*?\/>/g) || []
    assert.equal(presentationVideos.length, 2)
    assert.match(source, /\/media\/hero\/hakum-precision-01\.mp4/)
    assert.match(source, /\/media\/hero\/hakum-protection-02\.mp4/)
    assert.match(source, /\/media\/hero\/hakum-precision-poster\.webp/)
    assert.match(source, /const HERO_MEDIA_READY = true/)
    assert.match(source, /hakum-hero\.webp/)
    assert.match(source, /hero-cinematic-line/)
    assert.match(source, /key=\{`\$\{lineIndex\}-\$\{wordIndex\}`\}/)
    assert.doesNotMatch(source, /Hakum milestones|Experience/)
  })

  it('ships two silent 1080p five-second clips and the reduced-motion poster', async () => {
    const clipPaths = [
      'public/media/hero/hakum-precision-01.mp4',
      'public/media/hero/hakum-protection-02.mp4',
    ]

    for (const path of clipPaths) {
      const file = projectFile(path)
      assert.ok((await stat(file)).size > 1_000_000)
      const media = inspectMp4(await readFile(file))
      assert.deepEqual(
        { width: media.width, height: media.height, videoTracks: media.videoTracks, soundTracks: media.soundTracks },
        { width: 1920, height: 1080, videoTracks: 1, soundTracks: 0 },
      )
      assert.ok(media.duration >= 5)
      assert.ok(media.duration < 5.1)
    }

    assert.ok((await stat(projectFile('public/media/hero/hakum-precision-poster.webp'))).size > 50_000)
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

  it('keeps the media full-bleed, the left copy protected, and reduced motion still', async () => {
    const css = await readFile(projectFile('src/styles.css'), 'utf8')

    assert.match(css, /\.hero-cinematic-overlay[\s\S]*?linear-gradient/)
    assert.match(css, /\.hero-cinematic-video[\s\S]*?object-fit:\s*cover/)
    assert.match(css, /\.hero-cinematic-copy[\s\S]*?max-width:\s*42%/)
    assert.match(css, /\.hero-cinematic-actions[\s\S]*?:focus-visible/)
    assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.hero-cinematic-video[\s\S]*?display:\s*none/)
    assert.match(css, /@media\s*\(max-width:\s*767px\)[\s\S]*?\.hero-cinematic-video[\s\S]*?display:\s*none/)
  })
})
