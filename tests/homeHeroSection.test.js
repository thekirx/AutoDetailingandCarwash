import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const projectFile = (path) => new URL(`../${path}`, import.meta.url)

describe('Homepage motion boundaries', () => {
  it('uses the legacy hero without GSAP or cinematic video', async () => {
    const source = await readFile(projectFile('src/components/public/home/HomeHeroSection.jsx'), 'utf8')

    assert.match(source, /Give your car/)
    assert.match(source, /The pampering it deserves/)
    assert.match(source, /className="hero-experience"/)
    assert.match(source, /<StatCard/)
    assert.doesNotMatch(source, /\bgsap\b|ScrollTrigger|hero-cinematic|<video/)
  })

  it('retains GSAP for the PPF installation sequence', async () => {
    const source = await readFile(projectFile('src/components/public/home/PpfInstallSequence.jsx'), 'utf8')

    assert.match(source, /import gsap from ['"]gsap['"]/)
    assert.match(source, /ScrollTrigger/)
    assert.match(source, /ScrollTrigger\.create\(/)
    assert.match(source, /trigger\.kill\(\)/)
  })
})
