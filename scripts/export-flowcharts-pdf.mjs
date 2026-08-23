/**
 * Export docs/POS and docs/PAYROLL flowchart HTML to PDF (Chromium print).
 * ponytail: puppeteer devDep — regenerate after diagram edits.
 *
 * Usage: npm run generate:flowcharts-pdf
 */
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))

const exports = [
  {
    html: path.join(root, 'docs/POS/09-FLOWCHARTS.html'),
    pdf: path.join(root, 'docs/POS/09-FLOWCHARTS.pdf'),
    minCharts: 10,
    label: 'POS',
  },
  {
    html: path.join(root, 'docs/PAYROLL/10-FLOWCHARTS.html'),
    pdf: path.join(root, 'docs/PAYROLL/10-FLOWCHARTS.pdf'),
    minCharts: 9,
    label: 'Payroll',
  },
]

let puppeteer
try {
  puppeteer = (await import('puppeteer')).default
} catch {
  console.error(
    'puppeteer not found. Run: npx -y -p puppeteer npm run generate:flowcharts-pdf'
  )
  process.exit(1)
}

const browser = await puppeteer.launch({ headless: true })

for (const job of exports) {
  const page = await browser.newPage()
  const fileUrl = `file:///${job.html.replace(/\\/g, '/')}`

  console.log(`Rendering ${job.label}…`)
  await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 120000 })

  await page.waitForFunction(
    (min) => document.querySelectorAll('.mermaid svg').length >= min,
    { timeout: 120000 },
    job.minCharts
  )

  await page.pdf({
    path: job.pdf,
    format: 'A4',
    printBackground: true,
    margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
  })

  console.log(`  → ${job.pdf}`)
  await page.close()
}

await browser.close()
console.log('Done.')
