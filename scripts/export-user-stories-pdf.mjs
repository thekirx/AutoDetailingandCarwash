/**
 * Export docs/user-stories/USER-STORIES-OWNER.html → .pdf (stories only).
 * Prefer: npm run generate:owner-stories (builds HTML then this).
 */
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = fileURLToPath(new URL('../', import.meta.url))
const outDir = path.join(root, 'docs/user-stories')
const outHtml = path.join(outDir, 'USER-STORIES-OWNER.html')
const outPdf = path.join(outDir, 'USER-STORIES-OWNER.pdf')

const skipPy = process.argv.includes('--pdf-only')
if (!skipPy) {
  const py = spawnSync('python', [path.join(root, 'scripts/generate-owner-stories.py')], {
    cwd: root,
    stdio: 'inherit',
  })
  if (py.status !== 0) process.exit(py.status ?? 1)
}

if (!existsSync(outHtml)) {
  console.error('Missing HTML — run scripts/generate-owner-stories.py first')
  process.exit(1)
}

const puppeteer = (await import('puppeteer')).default
const browser = await puppeteer.launch({ headless: true })
try {
  const page = await browser.newPage()
  const fileUrl = `file:///${outHtml.replace(/\\/g, '/')}`
  await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 120000 })
  await page.evaluate(() => {
    document.querySelectorAll('.tab-panel').forEach((p) => {
      p.style.display = 'block'
    })
    const tabs = document.querySelector('.tabs')
    if (tabs) tabs.style.display = 'none'
  })
  await page.pdf({
    path: outPdf,
    format: 'A4',
    printBackground: true,
    margin: { top: '12mm', bottom: '14mm', left: '11mm', right: '11mm' },
  })
} finally {
  await browser.close()
}

if (!existsSync(outPdf) || statSync(outPdf).size < 20_000) {
  console.error('PDF missing or too small')
  process.exit(1)
}
console.log(`Wrote ${outPdf} (${Math.round(statSync(outPdf).size / 1024)} KB)`)
