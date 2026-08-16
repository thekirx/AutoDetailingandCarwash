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
      'src/assets/about/about-hkm-21.webp',
      'src/assets/services/carwash.webp',
      'src/assets/services/interior-detailing.webp',
      'src/assets/services/ceramic-tint.webp',
      'src/assets/services/ceramic-coating.webp',
      'src/assets/services/glass-detailing.webp',
      'src/assets/services/engine-wash.webp',
      'src/assets/services/paint-protection-film.webp',
      'src/assets/services/detailing.webp',
      'src/assets/services/ceramic-classic.webp',
      'src/assets/services/ceramic-premium.webp',
      'src/assets/services/ceramic-platinum.webp',
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

  it('keeps the approved centered hero experience composition', async () => {
    const page = await readFile(projectFile('src/components/public/home/HomeHeroSection.jsx'), 'utf8')

    assert.doesNotMatch(page, /hero-experience-layout/)
    assert.doesNotMatch(page, /hero-experience-card/)
    assert.match(page, /<div className="hero-experience"[^>]*>\s*<h2 id="experience-heading">Experience<\/h2>/s)
    assert.equal((page.match(/<StatCard key=/g) || []).length, 1)
  })

  it('scopes reference alignment to the approved homepage sections', async () => {
    const css = await readFile(projectFile('src/styles.css'), 'utf8')
    const packages = await readFile(projectFile('src/components/public/home/PpfPackagesSection.jsx'), 'utf8')

    assert.match(css, /\.hero-actions\s*\{[^}]*width:max-content[^}]*margin:27px auto 0/s)
    assert.match(css, /\.hero-experience\s*\{[^}]*text-align:center/s)
    assert.doesNotMatch(css, /\.hero-experience-card\s*\{/)
    assert.match(css, /\.ceramic-layout\s*\{[^}]*grid-template-columns:minmax\(260px,\.72fr\) minmax\(0,2\.28fr\)/s)
    assert.match(css, /\.ceramic-intro\s*\{[^}]*container-type:inline-size/s)
    assert.match(css, /\.ceramic-intro h2\s*\{[^}]*font-size:clamp\(3rem,18cqi,5\.4rem\)/s)
    assert.match(css, /\.ceramic-package-name\s*\{[^}]*writing-mode:vertical-rl/s)
    assert.match(css, /\.ceramic-package-overlay\s*\{[^}]*rgba\(5,38,153,\.3/s)
    assert.match(css, /\.ppf-information-stage\s*\{[^}]*background:#050505/s)
    assert.match(css, /\.ppf-package-ladder-layout\s*\{/)
    assert.match(css, /\.ppf-protection-ladder\s*\{/)
    assert.match(css, /\.ppf-packages-section\s*\{[^}]*background:var\(--color-surface-cinematic\)/s)
    assert.match(css, /\.ppf-package-ladder-intro\s*\{[^}]*container-type:inline-size[^}]*background:var\(--color-brand-primary\)/s)
    assert.match(css, /\.ppf-package-ladder-intro h2\s*\{[^}]*font-size:clamp\([^;]*cqi[^}]*overflow-wrap:normal/s)
    assert.match(css, /\.ppf-ladder-copy\s*\{[^}]*container-type:inline-size/s)
    assert.match(css, /\.ppf-ladder-copy h3\s*\{[^}]*overflow-wrap:normal[^}]*word-break:normal[^}]*font-size:clamp\([^;]*cqi/s)
    assert.doesNotMatch(css, /\.ppf-ladder-copy h3\s*\{[^}]*overflow-wrap:anywhere/s)
    assert.match(packages, /ppf-package-ladder-layout/)
    assert.match(packages, /ppf-protection-ladder/)
    assert.doesNotMatch(packages, /ppf-static-lists|ppf-static-addons|ppf-static-tags/)
    assert.match(css, /\.partnership-layout\s*\{[^}]*grid-template-columns:minmax\(0,\.76fr\)/s)
    assert.match(css, /\.home-branch-card\.is-coming-soon\s*\{/s)
    assert.match(css, /\.public-header\s*\{[^}]*padding-top:\s*env\(safe-area-inset-top,\s*0px\)/s)
  })

  it('provides responsive layouts for the reference-aligned sections', async () => {
    const css = await readFile(projectFile('src/styles.css'), 'utf8')

    assert.match(css, /@media\(max-width:800px\)\{[\s\S]*?\.hero-metrics\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
    assert.match(css, /@media\(max-width:800px\)\{[\s\S]*?\.ceramic-layout\s*\{[^}]*grid-template-columns:minmax\(0,1fr\)/)
    assert.match(css, /@media\(max-width:900px\)\{[\s\S]*?\.ppf-package-ladder-layout\{grid-template-columns:1fr\}/)
    assert.match(css, /@media\(max-width:600px\)\{[\s\S]*?\.ppf-ladder-book\{[^}]*min-height:48px/)
    assert.match(css, /@media\(max-width:600px\)\{[\s\S]*?\.partnership-field-row\{grid-template-columns:1fr\}/)
    assert.match(css, /@media\(max-width:800px\)\{[\s\S]*?\.home-branch-grid\{grid-template-columns:1fr\}/)
  })

  it('keeps the hero hierarchy consistent with the legacy reference', async () => {
    const css = await readFile(projectFile('src/styles.css'), 'utf8')

    assert.doesNotMatch(css, /\.public-site\s+:is\([^}]*\.display-title[^}]*font-weight:800/s)
    assert.match(css, /\.display-title\s*\{[^}]*font-size:clamp\(3rem,4\.4vw,4\.5rem\)/s)
    assert.match(css, /\.display-title\s*\{[^}]*font-weight:600/s)
    assert.match(css, /\.hero-subheading\s*\{[^}]*font-weight:400[^}]*font-style:italic/s)
    assert.match(css, /\.hero-metrics \.ui-stat-card>div>span\s*\{[^}]*font-weight:400/s)
    assert.match(css, /\.hero-metrics \.ui-stat-card>strong\s*\{[^}]*font-style:normal/s)
    assert.match(css, /\.hero-experience\s*\{[^}]*margin:78px auto 0/s)
    assert.match(css, /\.hero-metrics \.ui-stat-card>strong>span\s*\{[^}]*font:inherit/s)
  })
})
