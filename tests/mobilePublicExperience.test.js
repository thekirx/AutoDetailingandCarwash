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
})
