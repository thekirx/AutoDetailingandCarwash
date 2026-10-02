import puppeteer from 'puppeteer'

const base = process.env.BASE_URL || 'http://127.0.0.1:5250'
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: 375, height: 667 })
await page.goto(`${base}/signin`, { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  const chip = [...document.querySelectorAll('.hakum-demo-chip')].find((b) =>
    /demo\.customer|Demo customer/i.test(b.textContent || ''),
  )
  chip?.click()
})
await page.waitForFunction(() => location.pathname.startsWith('/account'), { timeout: 60000 })
await new Promise((r) => setTimeout(r, 2500))
const info = await page.evaluate(() => {
  const vw = window.innerWidth
  const rows = []
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    if (style.position === 'fixed' || style.position === 'absolute') continue
    if (style.display === 'none') continue
    if (r.right > vw + 50) {
      rows.push({
        tag: el.tagName,
        cls: String(el.className || '').slice(0, 90),
        left: Math.round(r.left),
        right: Math.round(r.right),
        w: Math.round(r.width),
        pos: style.position,
      })
    }
  }
  rows.sort((a, b) => b.right - a.right)
  return { vw, doc: document.documentElement.scrollWidth, rows: rows.slice(0, 20) }
})
console.log(JSON.stringify(info, null, 2))
await browser.close()
