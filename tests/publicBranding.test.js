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

  it('uses the centered legacy experience composition without a feature card', async () => {
    const page = await readFile(projectFile('src/pages/PublicLandingPage.jsx'), 'utf8')

    assert.doesNotMatch(page, /hero-experience-layout/)
    assert.doesNotMatch(page, /hero-experience-card/)
    assert.match(page, /<div className="hero-experience"[^>]*>\s*<h2 id="experience-heading">Experience<\/h2>/s)
    assert.equal((page.match(/<StatCard key=/g) || []).length, 1)
    assert.match(page, /import \{ aboutImage \} from '\.\.\/data\/publicHomeContent'/)
    assert.match(page, /featuredServices, otherServices/)
    assert.match(page, /ceramicPackages, ceramicSection/)
    assert.match(page, /<img className="about-visual-image" src=\{aboutImage\}/)
    assert.match(page, /featuredServices\.map/)
    assert.match(page, /className="other-services-trigger"/)
    assert.match(page, /role="dialog"/)
    assert.match(page, /aria-modal="true"/)
    assert.match(page, /otherServices\.map/)
    const otherServicesCards = page.match(/otherServices\.map\(\(service\) => \([\s\S]*?\n\s*\)\)\}/)?.[0] || ''
    assert.doesNotMatch(otherServicesCards, /<Link|Book now/)
    assert.match(page, /className="public-shell ceramic-layout"/)
    assert.doesNotMatch(page, /className="service-card-locked"/)
    assert.doesNotMatch(page, /Recommended/)
  })

  it('scopes reference alignment to the approved homepage sections', async () => {
    const css = await readFile(projectFile('src/styles.css'), 'utf8')

    assert.match(css, /\.hero-actions\s*\{[^}]*width:max-content[^}]*margin:27px auto 0/s)
    assert.match(css, /\.hero-experience\s*\{[^}]*text-align:center/s)
    assert.doesNotMatch(css, /\.hero-experience-card\s*\{/)
    assert.match(css, /\.about-heading \.section-title\s*\{[^}]*font-family:var\(--font-public-display\)/s)
    assert.match(css, /\.about-copy\s*\{[^}]*font-family:var\(--font-public-body\)/s)
    assert.match(css, /\.services-display-title\s*\{[^}]*font-family:var\(--font-public-display\)/s)
    assert.match(css, /\.featured-service-copy h3\s*\{[^}]*font-family:var\(--font-public-display\)/s)
    assert.match(css, /\.featured-service-copy p\s*\{[^}]*font-family:var\(--font-public-body\)/s)
    assert.match(css, /\.services-eyebrow\s*\{[^}]*font-size:clamp\(/s)
    assert.match(css, /\.services-intro-copy\s*\{[^}]*font-size:clamp\(/s)
    assert.match(css, /\.about-visual-image\s*\{[^}]*object-fit:cover/s)
    assert.match(css, /\.about-copy \.about-lead\s*\{[^}]*font-style:italic/s)
    assert.match(css, /\.featured-services-grid\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/s)
    assert.match(css, /\.featured-service-card\s*\{[^}]*min-height:clamp\(460px,43vw,680px\)/s)
    assert.match(css, /\.featured-service-card img\s*\{[^}]*object-fit:cover/s)
    assert.match(css, /\.other-services-modal\s*\{[^}]*position:fixed/s)
    assert.match(css, /\.other-services-grid\s*\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/s)
    assert.doesNotMatch(css, /\.other-service-card a\s*\{/)
    assert.match(css, /\.other-service-card>div\s*\{[^}]*min-height:auto/s)
    assert.match(css, /\.ceramic-layout\s*\{[^}]*grid-template-columns:minmax\(260px,\.72fr\) minmax\(0,2\.28fr\)/s)
    assert.match(css, /\.ceramic-intro\s*\{[^}]*container-type:inline-size/s)
    assert.match(css, /\.ceramic-intro h2\s*\{[^}]*font-size:clamp\(3rem,18cqi,5\.4rem\)/s)
    assert.match(css, /\.ceramic-package-name\s*\{[^}]*writing-mode:vertical-rl/s)
    assert.match(css, /\.ceramic-package-overlay\s*\{[^}]*rgba\(5,38,153,\.3/s)
    assert.match(css, /\.public-header\s*\{[^}]*padding-top:\s*env\(safe-area-inset-top,\s*0px\)/s)
  })

  it('provides responsive layouts for the reference-aligned sections', async () => {
    const css = await readFile(projectFile('src/styles.css'), 'utf8')

    assert.match(css, /@media\(max-width:800px\)\{[\s\S]*?\.hero-metrics\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
    assert.match(css, /@media\(max-width:800px\)\{[\s\S]*?\.about-layout\s*\{[^}]*grid-template-columns:1fr/)
    assert.match(css, /@media\(max-width:800px\)\{[\s\S]*?\.other-services-grid\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
    assert.match(css, /@media\(max-width:600px\)\{[\s\S]*?\.featured-services-grid\s*\{[^}]*grid-template-columns:1fr/)
    assert.match(css, /@media\(max-width:600px\)\{[\s\S]*?\.other-services-grid\s*\{[^}]*grid-template-columns:1fr/)
    assert.match(css, /@media\(max-width:800px\)\{[\s\S]*?\.ceramic-layout\s*\{[^}]*grid-template-columns:minmax\(0,1fr\)/)
    assert.match(css, /@media\(max-width:900px\)\{[\s\S]*?\.ceramic-package-grid\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/)
    assert.match(css, /@media\(max-width:700px\)\{[\s\S]*?\.featured-services-grid\s*\{[^}]*grid-template-columns:1fr/)
    assert.match(css, /@media\(max-width:700px\)\{[\s\S]*?\.ceramic-package-grid\s*\{[^}]*grid-template-columns:1fr/)
  })

  it('keeps the hero hierarchy consistent with the legacy reference', async () => {
    const css = await readFile(projectFile('src/styles.css'), 'utf8')

    assert.doesNotMatch(css, /\.public-site\s+:is\([^}]*\.display-title[^}]*font-weight:800/s)
    assert.match(css, /\.display-title\s*\{[^}]*font-size:clamp\(3rem,4\.4vw,4\.5rem\)/s)
    assert.match(css, /\.display-title\s*\{[^}]*font-weight:600/s)
    assert.match(css, /\.hero-subheading\s*\{[^}]*font-weight:400[^}]*font-style:italic/s)
    assert.match(css, /\.hero-metrics \.ui-stat-card>div>span\s*\{[^}]*font-weight:400/s)
    assert.match(css, /\.about-copy p\s*\{[^}]*font-weight:400/s)
    assert.match(css, /\.services-intro-copy\s*\{[^}]*font-family:var\(--font-public-body\)/s)
    assert.match(css, /\.featured-service-copy p\s*\{[^}]*font-family:var\(--font-public-body\)/s)
    assert.match(css, /\.about-heading \.section-title\s*\{[^}]*font-style:italic/s)
    assert.match(css, /\.services-display-title\s*\{[^}]*font-style:italic/s)
    assert.match(css, /\.hero-metrics \.ui-stat-card>strong\s*\{[^}]*font-style:normal/s)
    assert.match(css, /\.about-copy p\s*\{[^}]*font-style:normal/s)
    assert.match(css, /\.featured-service-copy h3\s*\{[^}]*font-style:italic/s)
    assert.match(css, /\.hero-experience\s*\{[^}]*margin:78px auto 0/s)
    assert.match(css, /\.hero-metrics \.ui-stat-card>strong>span\s*\{[^}]*font:inherit/s)
  })
})
