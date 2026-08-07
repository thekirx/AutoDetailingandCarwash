import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const projectFile = (path) => new URL(`../${path}`, import.meta.url)

describe('Mobile public experience', () => {
  it('keeps the interactive PPF canvas on mobile without a flat diagram', async () => {
    const [component, css] = await Promise.all([
      readFile(projectFile('src/components/PPFVisualizer.jsx'), 'utf8'),
      readFile(projectFile('src/styles.css'), 'utf8'),
    ])

    assert.match(component, /className="ppf-canvas-stage"/)
    assert.doesNotMatch(component, /ppf-mobile-diagram/)
    assert.doesNotMatch(css, /\.ppf-canvas-stage\s*\{\s*display:none/)
    assert.doesNotMatch(css, /\.ppf-mobile-diagram/)
    assert.match(css, /@media\(max-width:500px\)[\s\S]*?\.ppf-canvas-stage\s*\{[^}]*touch-action:none/)
  })

  it('extends the Hakum header behind the iPhone status area safely', async () => {
    const [html, css] = await Promise.all([
      readFile(projectFile('index.html'), 'utf8'),
      readFile(projectFile('src/styles.css'), 'utf8'),
    ])

    assert.match(html, /width=device-width, initial-scale=1\.0, viewport-fit=cover/)
    assert.match(css, /\.public-header\s*\{[^}]*padding-top:env\(safe-area-inset-top, 0px\)/s)
    assert.match(css, /\.mobile-nav\s*\{[^}]*100dvh[^}]*safe-area-inset-top/s)
  })

  it('matches the Safari browser inset to the translucent header surface', async () => {
    const html = await readFile(projectFile('index.html'), 'utf8')

    assert.match(html, /<meta name="theme-color" content="rgb\(74, 81, 110\)"/)
    assert.match(html, /html,body,#root\{min-height:100%;background:rgb\(74 81 110\)\}/)
  })

  it('uses safe intrinsic logo dimensions during the initial Safari render', async () => {
    const layout = await readFile(projectFile('src/layouts/PublicLayout.jsx'), 'utf8')

    assert.doesNotMatch(layout, /width="5000"|height="5000"/)
    assert.match(layout, /width="124"\s+height="70"/)
    assert.match(layout, /width="170"\s+height="96"/)
  })

  it('keeps the PPF heading and description inside the mobile shell', async () => {
    const css = await readFile(projectFile('src/styles.css'), 'utf8')

    assert.match(css, /\.ppf-heading>div\s*\{[^}]*min-width:0/)
    assert.match(css, /@media\(max-width:500px\)[\s\S]*?\.ppf-heading \.section-title\s*\{[^}]*11vw[^}]*46px/)
  })
})
