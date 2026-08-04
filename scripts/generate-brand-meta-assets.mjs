import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const publicDir = new URL('../public/', import.meta.url)
const markPath = fileURLToPath(new URL('branding/hakum-mark-blue.png', publicDir))
const lockupPath = fileURLToPath(new URL('branding/hakum-lw-ow.png', publicDir))
const OFF_WHITE = { r: 247, g: 247, b: 242, alpha: 1 }
const NAVY = { r: 2, g: 10, b: 49, alpha: 1 }

await mkdir(publicDir, { recursive: true })

async function squareIcon(filename, size, markRatio) {
  const markSize = Math.round(size * markRatio)
  const mark = await sharp(markPath)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(markSize, markSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  await sharp({ create: { width: size, height: size, channels: 4, background: OFF_WHITE } })
    .composite([{ input: mark, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toFile(fileURLToPath(new URL(filename, publicDir)))
}

await Promise.all([
  squareIcon('favicon.png', 64, 0.78),
  squareIcon('apple-touch-icon.png', 180, 0.72),
  squareIcon('icon-192.png', 192, 0.72),
  squareIcon('icon-512.png', 512, 0.72),
  squareIcon('icon-maskable-512.png', 512, 0.56),
])

const lockup = await sharp(lockupPath)
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .resize(900, 360, { fit: 'inside', withoutEnlargement: true })
  .png()
  .toBuffer()

await sharp({ create: { width: 1200, height: 630, channels: 4, background: NAVY } })
  .composite([{ input: lockup, gravity: 'centre' }])
  .png({ compressionLevel: 9 })
  .toFile(fileURLToPath(new URL('og-image.png', publicDir)))
