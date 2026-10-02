/* global document, location */
import puppeteer from 'puppeteer'
import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const file = pathToFileURL(path.resolve('docs/architecture/hakum-workflow-database.html')).href
const out = path.resolve('e2e-evidence/hakum-map')
fs.mkdirSync(out, { recursive: true })
const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

await page.setViewport({ width: 1440, height: 900 })
await page.goto(`${file}#workflow`, { waitUntil: 'networkidle0' })
await wait(400)
await page.screenshot({ path: `${out}/1440-workflow.png`, fullPage: true })

await page.click('#tab-db')
await wait(700)
await page.screenshot({ path: `${out}/1440-database.png` })
await page.type('#q-db', 'bookings')
await page.keyboard.press('Enter')
await wait(900)
await page.screenshot({ path: `${out}/1440-database-bookings.png` })

await page.click('#tab-code')
await wait(900)
await page.screenshot({ path: `${out}/1440-system-map.png` })
await page.type('#q-code', 'PosPage')
await page.keyboard.press('Enter')
await wait(900)
await page.screenshot({ path: `${out}/1440-system-map-pos.png` })

await page.click('#tab-workflow')
await page.click('[data-open="db"][data-area="pos"]')
await wait(900)
await page.screenshot({ path: `${out}/1440-area-pos-tables.png` })
await page.type('#q-db', 'sales')
await page.keyboard.press('Enter')
await wait(700)
await page.click('[data-explorer="db"] .info [data-go="code"]')
await wait(900)
const crossLink = await page.evaluate(() => ({ tab: document.querySelector('.tab[aria-selected="true"]').dataset.view, file: document.querySelector('[data-explorer="code"] .info .path')?.textContent }))
console.log('cross-link →', JSON.stringify(crossLink))

let t0 = Date.now()
await page.click('[data-explorer="code"] .mode[data-mode="graph"]')
await page.waitForFunction(() => !document.querySelector('[data-explorer="graph"]').hidden)
await wait(1500)
const graphMs = Date.now() - t0
await page.screenshot({ path: `${out}/1440-complete-graph.png` })
await page.type('#q-graph', 'complete_pos_sale')
await page.keyboard.press('Enter')
await wait(1200)
await page.screenshot({ path: `${out}/1440-complete-graph-node.png` })
const graphInfo = await page.evaluate(() => ({
  hash: location.hash,
  title: document.querySelector('[data-explorer="graph"] .info h3')?.textContent,
  sections: [...document.querySelectorAll('[data-explorer="graph"] .info h4')].map((h) => h.textContent).slice(0, 8),
}))
t0 = Date.now()
await page.click('[data-explorer="graph"] .info [data-go="graph"]')
await wait(900)
const hopped = await page.evaluate(() => document.querySelector('[data-explorer="graph"] .info h3')?.textContent)
console.log('graph →', JSON.stringify({ graphMs, ...graphInfo, hopped }))

await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
await page.goto(`${file}#workflow`, { waitUntil: 'networkidle0' })
await wait(400)
await page.screenshot({ path: `${out}/390-workflow.png` })
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

console.log(JSON.stringify({ errors, mobileHorizontalOverflowPx: overflow }, null, 2))
await browser.close()
