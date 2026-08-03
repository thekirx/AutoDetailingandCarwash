import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const projectFile = (path) => new URL(`../${path}`, import.meta.url)

describe('Public branding assets and scope', () => {
  it('ships the approved logo and required web fonts', async () => {
    const assets = [
      'public/branding/hakum-lw-ow.png',
      'public/fonts/benzin-medium.woff2',
      'public/fonts/benzin-semibold.woff2',
      'public/fonts/benzin-extrabold.woff2',
      'public/fonts/gilmer-light.woff2',
      'public/fonts/gilmer-regular.woff2',
      'public/fonts/gilmer-medium.woff2',
      'public/fonts/gilmer-bold.woff2',
    ]

    await Promise.all(assets.map((path) => access(projectFile(path))))
  })

  it('declares Benzin display weights and Gilmer supporting weights', async () => {
    const css = await readFile(projectFile('src/design-tokens.css'), 'utf8')

    assert.match(css, /font-family:\s*"Benzin"/)
    assert.match(css, /benzin-extrabold\.woff2/)
    assert.match(css, /font-family:\s*"Gilmer"/)
    assert.match(css, /gilmer-bold\.woff2/)
    assert.match(css, /--font-public-display:\s*"Benzin"/)
    assert.match(css, /--font-public-body:\s*"Gilmer"/)
  })

  it('scopes the brand families to the public wrapper', async () => {
    const css = await readFile(projectFile('src/styles.css'), 'utf8')

    assert.match(css, /\.public-site\s*\{[^}]*font-family:var\(--font-public-body\)/s)
    assert.match(css, /\.public-site\s+:is\([^}]*font-family:var\(--font-public-display\)/s)
  })

  it('uses the approved logo in both public wordmarks only', async () => {
    const layout = await readFile(projectFile('src/layouts/PublicLayout.jsx'), 'utf8')

    assert.equal((layout.match(/src="\/branding\/hakum-lw-ow\.png"/g) || []).length, 2)
    assert.equal((layout.match(/className="wordmark-image"/g) || []).length, 2)
    assert.doesNotMatch(layout, /<b>H<\/b>/)
    assert.equal((layout.match(/aria-label="Hakum Auto Care home"/g) || []).length, 2)
  })

  it('includes the approved hero experience composition', async () => {
    const page = await readFile(projectFile('src/pages/PublicLandingPage.jsx'), 'utf8')

    assert.match(page, /className="hero-experience-layout"/)
    assert.match(page, /className="hero-experience-card"/)
    assert.match(page, /<strong>10 Years<\/strong>/)
    assert.match(page, /Auto Industry<\/span>/)
    assert.match(page, /Experience Combined<\/span>/)
    assert.equal((page.match(/<StatCard key=/g) || []).length, 1)
  })

  it('scopes reference alignment to the approved homepage sections', async () => {
    const css = await readFile(projectFile('src/styles.css'), 'utf8')

    assert.match(css, /\.hero-experience-layout\s*\{[^}]*grid-template-columns:/s)
    assert.match(css, /\.hero-experience-card\s*\{[^}]*border:1px solid #37dfe8/s)
    assert.match(css, /\.about-heading \.section-title\s*\{[^}]*font-family:var\(--font-public-display\)/s)
    assert.match(css, /\.about-copy\s*\{[^}]*font-family:var\(--font-public-body\)/s)
    assert.match(css, /\.services-section \.section-title\s*\{[^}]*font-family:var\(--font-public-display\)/s)
    assert.match(css, /\.service-card h3\s*\{[^}]*font-family:var\(--font-public-display\)/s)
    assert.match(css, /\.service-card p\s*\{[^}]*font-family:var\(--font-public-body\)/s)
  })
})
