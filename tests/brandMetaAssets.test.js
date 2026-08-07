import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const projectFile = (path) => new URL(`../${path}`, import.meta.url)

async function readPngSize(path) {
  const bytes = await readFile(projectFile(path))
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

describe('Browser and social brand assets', () => {
  it('ships correctly sized official-mark icons', async () => {
    const expected = {
      'public/favicon.png': { width: 64, height: 64 },
      'public/apple-touch-icon.png': { width: 180, height: 180 },
      'public/icon-192.png': { width: 192, height: 192 },
      'public/icon-512.png': { width: 512, height: 512 },
      'public/icon-maskable-512.png': { width: 512, height: 512 },
    }

    for (const [path, dimensions] of Object.entries(expected)) {
      assert.deepEqual(await readPngSize(path), dimensions, path)
    }
  })

  it('ships a 1200 by 630 social card', async () => {
    assert.deepEqual(await readPngSize('public/og-image.png'), { width: 1200, height: 630 })
  })

  it('publishes crawler-safe social metadata and official favicon references', async () => {
    const html = await readFile(projectFile('index.html'), 'utf8')
    const imageUrl = 'https://auto-detailingand-carwash.vercel.app/og-image.png'

    assert.match(html, new RegExp(`<meta property="og:image" content="${imageUrl.replaceAll('.', '\\.')}`))
    assert.match(html, /<meta property="og:image:type" content="image\/png"/)
    assert.match(html, /<meta property="og:image:width" content="1200"/)
    assert.match(html, /<meta property="og:image:height" content="630"/)
    assert.match(html, /<meta property="og:image:alt" content="Hakum Auto Care official logo"/)
    assert.match(html, new RegExp(`<meta name="twitter:image" content="${imageUrl.replaceAll('.', '\\.')}`))
    assert.match(html, /<link rel="icon" href="\/favicon\.png" type="image\/png" sizes="64x64"/)
    assert.doesNotMatch(html, /favicon\.svg/)
  })

  it('declares truthful installable icon sizes', async () => {
    const manifest = JSON.parse(await readFile(projectFile('public/manifest.webmanifest'), 'utf8'))

    assert.deepEqual(manifest.icons, [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ])
  })

  it('supports iPhone Home Screen fullscreen safe areas', async () => {
    const html = await readFile(projectFile('index.html'), 'utf8')
    const manifest = JSON.parse(await readFile(projectFile('public/manifest.webmanifest'), 'utf8'))

    assert.match(html, /content="width=device-width, initial-scale=1\.0, viewport-fit=cover"/)
    assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes"/)
    assert.match(html, /<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/)
    assert.equal(manifest.display, 'standalone')
  })
})
