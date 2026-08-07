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
})
