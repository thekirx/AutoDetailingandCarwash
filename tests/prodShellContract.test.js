import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'))
const vite = readFileSync(join(root, 'vite.config.js'), 'utf8')
const main = readFileSync(join(root, 'src/main.jsx'), 'utf8')
const boundary = readFileSync(join(root, 'src/components/AppErrorBoundary.jsx'), 'utf8')

describe('Production shell contract (CSP + stale chunks)', () => {
  it('does not SPA-fallback hashed assets to index.html', () => {
    const spa = vercel.rewrites.at(-1)
    assert.equal(spa.destination, '/index.html')
    assert.match(spa.source, /assets/)
    assert.doesNotMatch(spa.source, /^\(\(\?!api\/\)\.\*\)$/)
  })

  it('CSP allows wasm compile and blob texture loads for Three.js', () => {
    const csp = vercel.headers
      .flatMap((block) => block.headers)
      .find((h) => h.key === 'Content-Security-Policy')?.value
    assert.ok(csp)
    assert.match(csp, /script-src[^;]*'wasm-unsafe-eval'/)
    assert.match(csp, /connect-src[^;]*\bblob:/)
    assert.match(csp, /worker-src 'self' blob:/)
    assert.doesNotMatch(csp, /script-src 'self' 'unsafe-inline'$/)
  })

  it('service worker does not navigate-fallback /assets to HTML', () => {
    assert.match(vite, /navigateFallbackDenylist:\s*\[[^\]]*\/\^\\\/assets\\\//)
    assert.match(vite, /cleanupOutdatedCaches:\s*true/)
  })

  it('recovers from stale hashed chunk loads after deploy', () => {
    assert.match(main, /vite:preloadError/)
    assert.match(boundary, /Failed to fetch dynamically imported module/)
    assert.match(boundary, /window\.location\.reload/)
  })
})
