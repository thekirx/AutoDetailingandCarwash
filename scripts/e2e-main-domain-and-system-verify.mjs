/**
 * Comprehensive E2E Verification Suite for:
 * 1. Main Domain (https://www.hakumautocare.com) SEO, Google Search Console Logo/Favicon, & Professional Multi-Branch Title
 * 2. Multi-Branch Public Surfaces (/branches, /book, /queue/bacoor, /queue/batangas, /shop, /events, /blog, Regional SEO Guides)
 * 3. Host-Scoped Quick Login Guard (hidden on www.hakumautocare.com, visible on hakumauto.vercel.app)
 * 4. All 18 Staff & Customer Accounts Readiness + WordPress-Style Blog & Events CMS Studio E2E (Super Admin, Lucy, Robert, Marketing)
 */
import puppeteer from 'puppeteer'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { OPS_DEMO_ACCOUNTS, CUSTOMER_DEMO_ACCOUNT } from '../src/lib/demoAccounts.js'

const envPath = resolve(process.cwd(), '.env')
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const MAIN_ORIGIN = process.env.E2E_MAIN_ORIGIN || 'https://www.hakumautocare.com'
const VERCEL_ORIGIN = process.env.E2E_VERCEL_ORIGIN || 'https://hakumauto.vercel.app'
const LOCAL_ORIGIN = process.env.E2E_LOCAL_ORIGIN || MAIN_ORIGIN

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
function record(step, status, detail = '') {
  results.push({ step, status, detail })
  console.log(`[${status}] ${step}${detail ? ` — ${detail}` : ''}`)
}

async function verifyAllAccountsSignIn() {
  const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const all = [...OPS_DEMO_ACCOUNTS, CUSTOMER_DEMO_ACCOUNT]
  for (const acc of all) {
    const { data, error } = await sb.auth.signInWithPassword({
      email: acc.email,
      password: acc.password,
    })
    assert.ok(!error && data?.user, `Account ${acc.id} (${acc.email}) failed login: ${error?.message}`)
  }
  record(
    'Supabase Auth: All 18 accounts (BossMich, Lucy, Robert, Marketing, Multi-Branch Admin/TL/Sales/Crew/Investor, Customer)',
    'PASS',
    `${all.length}/${all.length} signed in`,
  )
}

async function verifyAssetEndpoints(origin) {
  const assets = [
    '/favicon.ico',
    '/favicon.png',
    '/apple-touch-icon.png',
    '/icon-192.png',
    '/icon-512.png',
    '/icon-maskable-512.png',
    '/og-image.png',
    '/robots.txt',
    '/sitemap.xml',
    '/llms.txt',
  ]
  for (const path of assets) {
    const res = await fetch(`${origin}${path}`)
    assert.equal(res.status, 200, `Expected 200 OK for ${origin}${path}, got ${res.status}`)
  }
  record(`Static Brand, GSC Logo & SEO Assets on ${origin}`, 'PASS', `${assets.length} endpoints returned 200 OK`)
}

async function runBrowserSuite() {
  const browser = await puppeteer.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900 })

    // 1. Homepage Title, Canonical, Favicon Set & GSC Organization Logo JSON-LD
    await page.goto(`${LOCAL_ORIGIN}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await sleep(1800)

    const homeTitle = await page.title()
    assert.ok(
      homeTitle.includes('Bacoor and Batangas') && homeTitle.includes('Hakum Auto Care'),
      `Expected professional multi-branch title on homepage, got: "${homeTitle}"`,
    )

    const seoHead = await page.evaluate(() => {
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href')
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content')
      const icons = [...document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]')].map((el) => ({
        href: el.getAttribute('href'),
        sizes: el.getAttribute('sizes'),
      }))
      const siteJsonLdRaw = document.querySelector('script[data-jsonld="hakum-site"]')?.textContent
      const siteJsonLd = siteJsonLdRaw ? JSON.parse(siteJsonLdRaw) : null
      return { canonical, ogImage, icons, siteJsonLd }
    })

    assert.ok(seoHead.canonical, 'Homepage must have canonical link')
    assert.ok(seoHead.ogImage?.endsWith('/og-image.png'), `Expected og:image to end with /og-image.png, got ${seoHead.ogImage}`)
    const orgNode = seoHead.siteJsonLd?.['@graph']?.find((n) => n['@type'] === 'Organization')
    assert.ok(orgNode, 'Organization JSON-LD node must exist on homepage')
    assert.equal(orgNode.name, 'Hakum Auto Care')
    assert.ok(
      orgNode.logo?.url?.endsWith('/icon-512.png') || String(orgNode.logo).endsWith('/icon-512.png'),
      `Organization logo must reference /icon-512.png for Google Search Console, got ${JSON.stringify(orgNode.logo)}`,
    )
    record('Homepage Title, Canonical, Favicon Set & GSC Organization Logo JSON-LD', 'PASS', homeTitle)

    // 2. Multi-Branch /branches Page & AutomotiveBusiness JSON-LD
    await page.goto(`${LOCAL_ORIGIN}/branches`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await sleep(1500)
    const branchesText = await page.evaluate(() => document.body.innerText)
    assert.ok(/Bacoor/i.test(branchesText) && /Batangas/i.test(branchesText), 'Branches page must show Bacoor and Batangas')
    const branchGraph = await page.evaluate(() => {
      const el = document.querySelector('script[data-jsonld="hakum-branches"]')
      return el ? JSON.parse(el.textContent) : null
    })
    assert.ok(branchGraph?.['@graph']?.length >= 2, 'Branches page must emit AutomotiveBusiness JSON-LD graph')
    record('Multi-Branch /branches Page & AutomotiveBusiness JSON-LD', 'PASS', `${branchGraph['@graph'].length} branch nodes`)

    // 3. Multi-Branch Live Queue Pages (/queue/bacoor & /queue/batangas)
    for (const slug of ['bacoor', 'batangas']) {
      await page.goto(`${LOCAL_ORIGIN}/queue/${slug}`, { waitUntil: 'domcontentloaded', timeout: 45000 })
      await sleep(1000)
      const qText = await page.evaluate(() => document.body.innerText)
      assert.ok(new RegExp(slug, 'i').test(qText), `Live queue page for ${slug} must render branch queue`)
    }
    record('Multi-Branch Live Queue Pages (/queue/bacoor & /queue/batangas)', 'PASS')

    // 4. Public Services (/services), Tint Finder (/tint-finder), & Multi-Branch Booking (/book)
    await page.goto(`${LOCAL_ORIGIN}/services`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await sleep(1200)
    const servicesText = await page.evaluate(() => document.body.innerText)
    assert.ok(/Ceramic|Detailing|PPF|Wash/i.test(servicesText), '/services page must render services catalog')
    record('Public Services Catalog (/services)', 'PASS')

    await page.goto(`${LOCAL_ORIGIN}/book`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await sleep(1200)
    const bookText = await page.evaluate(() => document.body.innerText)
    assert.ok(/Bacoor|Batangas|Book/i.test(bookText), '/book page must render multi-branch booking flow')
    record('Multi-Branch Public Booking Page (/book)', 'PASS')

    // 5. Events & Blog Page (/events) + Regional SEO Authority Guides
    await page.goto(`${LOCAL_ORIGIN}/events`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await sleep(1500)
    const eventsText = await page.evaluate(() => document.body.innerText)
    assert.ok(/Bacoor/i.test(eventsText) && /Batangas/i.test(eventsText) && /Imus/i.test(eventsText) && /Cavite/i.test(eventsText))
    record('Events & Blog Page (/events) Regional SEO Hub (Bacoor, Batangas City, Imus, Cavite)', 'PASS')

    await page.goto(`${LOCAL_ORIGIN}/blog/best-car-wash-detailing-bacoor`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await sleep(1200)
    const blogTitle = await page.title()
    assert.ok(/Bacoor/i.test(blogTitle), `Expected Bacoor guide title, got ${blogTitle}`)
    record('Regional SEO Authority Article (/blog/best-car-wash-detailing-bacoor)', 'PASS', blogTitle)

    // 6. Verify Main Domain hides Quick Login cards
    await page.goto(`${MAIN_ORIGIN}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await sleep(1200)
    const mainBody = await page.evaluate(() => document.body.innerText)
    assert.ok(!/Quick login \(all roles\)/i.test(mainBody), 'Main domain /operations/login MUST hide Quick login cards')
    record('Main Domain Security: Quick Login Hidden on www.hakumautocare.com', 'PASS')

    // 7. Verify Vercel Test Link shows Quick Login cards
    await page.goto(`${VERCEL_ORIGIN}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await sleep(1200)
    const vercelBody = await page.evaluate(() => document.body.innerText)
    assert.ok(/Quick login \(all roles\)/i.test(vercelBody), 'Vercel test domain /operations/login MUST show Quick login cards')
    record('Vercel Test Link: Quick Login Visible on hakumauto.vercel.app', 'PASS')

    // 8. Test WordPress-Style Blog & Events CMS Studio with Marketing account
    const marketingAcc = OPS_DEMO_ACCOUNTS.find((a) => a.id === 'marketing')
    await page.goto(`${LOCAL_ORIGIN}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await sleep(1000)

    const emailSel = 'input[type="email"], input[name="email"]'
    await page.waitForSelector(emailSel, { timeout: 15000 })
    await page.click(emailSel, { clickCount: 3 })
    await page.type(emailSel, marketingAcc.email)

    const passSel = 'input[type="password"]'
    await page.click(passSel, { clickCount: 3 })
    await page.type(passSel, marketingAcc.password)

    await page.click('button[type="submit"]')
    await sleep(3000)

    await page.goto(`${LOCAL_ORIGIN}/operations/content`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await sleep(2000)
    const cmsBody = await page.evaluate(() => document.body.innerText)
    assert.ok(
      /Blog & Events Studio|New Blog Post|New Event/i.test(cmsBody),
      `Marketing user must be able to access /operations/content Studio (got: ${cmsBody.slice(0, 200)})`,
    )

    // Click "+ New Blog Post" button
    const clickedNew = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => /New Blog Post/i.test(b.textContent || ''))
      if (btn) {
        btn.click()
        return true
      }
      return false
    })
    assert.ok(clickedNew, 'Should find and click New Blog Post button')
    await sleep(800)

    const testTitle = `E2E Verification Draft ${Date.now()}`
    const titleSelector = 'input[placeholder*="Best Car Wash"], input[placeholder*="Title"]'
    await page.waitForSelector(titleSelector, { timeout: 10000 })
    await page.type(titleSelector, testTitle)
    await sleep(500)

    // Click "Save Draft"
    const clickedSave = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => /Save Draft/i.test(b.textContent || ''))
      if (btn) {
        btn.click()
        return true
      }
      return false
    })
    assert.ok(clickedSave, 'Should find and click Save Draft button')
    await sleep(2500)

    const sbAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: createdRows } = await sbAdmin.from('blogs').select('id, title, status').eq('title', testTitle)
    assert.ok(createdRows && createdRows.length >= 1, 'Marketing user CMS blog draft should be saved in Supabase blogs table')
    for (const r of createdRows) {
      await sbAdmin.from('blogs').delete().eq('id', r.id)
    }
    record('CMS Studio E2E (Marketing Account): Create Draft -> Save via API/DB -> Clean Up', 'PASS', testTitle)
  } finally {
    await browser.close()
  }
}

async function main() {
  await verifyAllAccountsSignIn()
  await verifyAssetEndpoints(LOCAL_ORIGIN)
  await runBrowserSuite()
  console.log('\n=== FULL E2E VERIFICATION SUMMARY ===')
  for (const r of results) {
    console.log(`✔ ${r.step}${r.detail ? ` (${r.detail})` : ''}`)
  }
}

main().catch((err) => {
  console.error('E2E Verification Failed:', err)
  process.exit(1)
})
