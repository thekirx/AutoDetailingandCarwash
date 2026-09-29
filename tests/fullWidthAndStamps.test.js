import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(join(root, file), 'utf8')
const tokens = read('src/design-tokens.css')
const styles = read('src/styles.css')
const bredesign = read('src/styles/bredesign.css')
const app = read('src/styles-customer-app.css')

describe('one fluid page width', () => {
  it('has no maximum width, only side margins', () => {
    assert.match(tokens, /--site-shell: calc\(100% - clamp\(24px, 5vw, 96px\)\);/)
  })

  it('is used by both site containers and the account page', () => {
    assert.match(styles, /\.public-shell \{ width:var\(--site-shell\); margin-inline:auto; \}/)
    assert.match(bredesign, /--bd-shell: var\(--site-shell\);/)
    // The account app runs full width; its content sits on the site shell.
    assert.match(app, /--capp-gutter: max\(1\.5rem, calc\(\(100% - var\(--site-shell, calc\(100% - 3rem\)\)\) \/ 2\)\);/)
    assert.doesNotMatch(bredesign, /--bd-shell: min\(/)
    assert.doesNotMatch(styles, /\.public-shell\{width:min\(100% - 32px,1240px\)\}/)
  })

  it('keeps the legal text in a centred reading column', () => {
    assert.match(styles, /\.legal-inner \{ max-width:42rem; \}/)
  })
})

describe('loyalty stamps', () => {
  it('are round and scale down to fit five on a phone', () => {
    assert.match(app, /\.capp-stamp \{[\s\S]*?width: min\(100%, 4rem\);[\s\S]*?aspect-ratio: 1;[\s\S]*?border-radius: 50%;/)
    assert.match(app, /grid-template-columns: repeat\(5, minmax\(0, 4rem\)\);/)
  })
})
