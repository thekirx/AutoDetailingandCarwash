/**
 * Form builder QA: planner Forms tab (detailing + QR) + public /f/:slug submit.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:4173 node scripts/e2e-ui-forms.mjs
 *   Or omit BASE_URL — script starts vite preview (needs dist/).
 *
 * Evidence: e2e-evidence/ui-forms/
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { isOpsAuthedUrl, isLoginWallUrl } from './screenshotAuth.mjs'
import { OPS_DEMO_ACCOUNTS } from '../src/lib/demoAccounts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'e2e-evidence', 'ui-forms')
mkdirSync(outDir, { recursive: true })

if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), { encoding: 'utf8' }).split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i)
    const v = line.slice(i + 1)
    if (!process.env[k]) process.env[k] = v
  }
}

const results = []
function pass(name, detail = '') {
  results.push({ ok: true, name, detail })
  console.log('✔', name, detail)
}
function fail(name, detail = '') {
  results.push({ ok: false, name, detail })
  console.error('✖', name, detail)
}

async function dismissCookieBanner(page) {
  const btn = await page.$('.cookie-consent-secondary, .cookie-consent-primary')
  if (!btn) return
  await btn.click().catch(() => null)
  await new Promise((r) => setTimeout(r, 200))
}

async function clearSession(page, base) {
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null)
  await page.evaluate(() => {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {
      /* ignore */
    }
  }).catch(() => null)
  const client = await page.createCDPSession()
  await client.send('Network.clearBrowserCookies')
  await page.goto(`${base}/operations/login`, { waitUntil: 'networkidle2', timeout: 60000 })
}

async function opsLogin(page, base, email, password) {
  await page.goto(`${base}/operations/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await dismissCookieBanner(page)
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 20000 })
  const emailSel = await page.$('input[type="email"], input[name="email"]')
  const passSel = await page.$('input[type="password"], input[name="password"]')
  if (!emailSel || !passSel) return false
  await emailSel.click({ clickCount: 3 })
  await emailSel.type(email, { delay: 5 })
  await passSel.click({ clickCount: 3 })
  await passSel.type(password, { delay: 5 })
  await page.click('button[type="submit"]')
  await page
    .waitForFunction(
      () => {
        const p = location.pathname
        return p.startsWith('/operations') && p !== '/operations/login' && !p.startsWith('/operations/login/')
      },
      { timeout: 60000 },
    )
    .catch(() => null)
  await new Promise((r) => setTimeout(r, 800))
  return isOpsAuthedUrl(page.url())
}

async function shot(page, name) {
  const file = join(outDir, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return file
}

async function ensurePreview() {
  if (process.env.BASE_URL) {
    return { base: process.env.BASE_URL.replace(/\/$/, ''), stop: async () => {} }
  }
  const port = String(process.env.PORT || 4173)
  const base = `http://127.0.0.1:${port}`
  const child = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', port, '--strictPort'], {
    cwd: root,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  })
  let ready = false
  const onData = (buf) => {
    const s = String(buf)
    if (/Local:|preview.*http/i.test(s)) ready = true
  }
  child.stdout?.on('data', onData)
  child.stderr?.on('data', onData)
  for (let i = 0; i < 60 && !ready; i++) {
    await new Promise((r) => setTimeout(r, 500))
    try {
      const res = await fetch(base)
      if (res.ok || res.status === 404) ready = true
    } catch {
      /* wait */
    }
  }
  if (!ready) {
    child.kill()
    throw new Error('vite preview failed to start')
  }
  return {
    base,
    stop: async () => {
      child.kill('SIGTERM')
    },
  }
}

async function main() {
  const { base, stop } = await ensurePreview()
  const boss = OPS_DEMO_ACCOUNTS.find((a) => a.id === 'boss')
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  })
  const page = await browser.newPage()

  try {
    await clearSession(page, base)
    const okLogin = await opsLogin(page, base, boss.email, boss.password)
    if (!okLogin) {
      fail('ops.login', page.url())
      await shot(page, 'ops-login-FAIL')
    } else {
      pass('ops.login', page.url())
    }

    await page.goto(`${base}/operations/planning?tab=forms`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await dismissCookieBanner(page)
    await new Promise((r) => setTimeout(r, 2500))

    if (isLoginWallUrl(page.url())) {
      fail('planner.forms', `login wall ${page.url()}`)
      await shot(page, 'planner-forms-FAIL')
    } else {
      const bodyText = await page.evaluate(() => document.body?.innerText || '')
      const hasDetailing = /detailing/i.test(bodyText)
      const hasQr = Boolean(await page.$('img[alt*="QR"], canvas, .form-qr, [data-testid="form-qr"]'))
      const qrImg = await page.evaluate(() => {
        const imgs = [...document.querySelectorAll('img')]
        return imgs.some((img) => /qr|data:image\/png/i.test(img.src || '') || /QR/i.test(img.alt || ''))
      })
      if (!hasDetailing) {
        fail('planner.forms.detailing', 'no detailing copy on Forms tab')
        await shot(page, 'planner-forms-no-detailing')
      } else {
        pass('planner.forms.detailing', 'detailing visible')
      }
      if (!hasQr && !qrImg) {
        // select detailing template first if list exists
        await page.evaluate(() => {
          const row = [...document.querySelectorAll('button, tr, [role="button"], a')].find((el) =>
            /detailing/i.test(el.textContent || ''),
          )
          row?.click()
        })
        await new Promise((r) => setTimeout(r, 1500))
      }
      const qrAfter = await page.evaluate(() => {
        const imgs = [...document.querySelectorAll('img')]
        return imgs.some((img) => /^data:image\/png/i.test(img.src || '') || /QR/i.test(img.alt || ''))
      })
      if (qrAfter || hasQr || qrImg) pass('planner.forms.qr', 'QR present')
      else fail('planner.forms.qr', 'QR image not found after selecting detailing')
      await shot(page, 'planner-forms-detailing')
      pass('planner.forms.shot', 'planner-forms-detailing.png')
    }

    // Public form page
    await page.goto(`${base}/f/detailing-inquiry`, { waitUntil: 'networkidle2', timeout: 60000 })
    await dismissCookieBanner(page)
    await new Promise((r) => setTimeout(r, 2000))
    const publicText = await page.evaluate(() => document.body?.innerText || '')
    if (/closed|not found|unavailable|Loading form/i.test(publicText) && !/Full name|Mobile|Detailing/i.test(publicText)) {
      fail('public.form.load', publicText.slice(0, 200))
      await shot(page, 'public-detailing-FAIL')
    } else {
      pass('public.form.load', page.url())
      await shot(page, 'public-detailing-inquiry')
    }

    const fieldProbe = await page.evaluate(() => {
      const labels = [...document.querySelectorAll('label, .field-label, legend')].map((el) =>
        (el.textContent || '').trim(),
      )
      const selects = [...document.querySelectorAll('select, [role="combobox"]')].length
      const options = [...document.querySelectorAll('select option, [role="option"]')]
        .map((o) => (o.textContent || '').trim())
        .filter(Boolean)
      return { labels, selects, options: options.slice(0, 40) }
    })
    const need = [/name/i, /mobile|phone/i, /plate/i, /service|detailing/i, /branch/i]
    const missing = need.filter((re) => !fieldProbe.labels.some((l) => re.test(l)) && !re.test(publicText))
    if (missing.length) fail('public.form.fields', `missing: ${missing.map(String).join(', ')}`)
    else pass('public.form.fields', `${fieldProbe.labels.length} labels, ${fieldProbe.selects} selects`)

    // Native <select> options only (ignore footer text)
    const selectOpts = await page.evaluate(() =>
      [...document.querySelectorAll('.hakum-form-fields select')].map((sel) => ({
        label: (sel.closest('label')?.querySelector('span')?.textContent || '').trim(),
        options: [...sel.options].map((o) => o.value).filter(Boolean),
      })),
    )
    const branchSel = selectOpts.find((s) => /branch/i.test(s.label))
    const serviceSel = selectOpts.find((s) => /service/i.test(s.label))
    if (serviceSel?.options?.some((o) => /Ceramic|PPF|Tint|Paint/i.test(o))) {
      pass('public.form.service_options', serviceSel.options.join(' | '))
    } else {
      fail('public.form.service_options', JSON.stringify(serviceSel || selectOpts))
    }
    if (branchSel?.options?.some((o) => /bacoor|batangas/i.test(o))) {
      pass('public.form.branch_options', branchSel.options.join(' | '))
    } else {
      fail('public.form.branch_options', `empty/missing live branches: ${JSON.stringify(branchSel || selectOpts)}`)
      await shot(page, 'public-detailing-branch-empty')
    }

    // Fill + submit — React-controlled inputs need native value setter + input event
    const stamp = `QA${Date.now().toString().slice(-6)}`
    await page.evaluate((vals) => {
      function setReactValue(el, value) {
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
        setter?.call(el, value)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      }
      const fields = [...document.querySelectorAll('.hakum-form-fields label.hakum-form-field')]
      for (const lab of fields) {
        const title = (lab.querySelector('span')?.textContent || '').trim()
        const input = lab.querySelector('input, textarea, select')
        if (!input) continue
        if (/Full name/i.test(title) && input.tagName !== 'SELECT') setReactValue(input, vals.name)
        if (/Mobile|phone/i.test(title) && input.tagName !== 'SELECT') setReactValue(input, vals.phone)
        if (/Email/i.test(title) && input.tagName !== 'SELECT') setReactValue(input, vals.email)
        if (/Plate/i.test(title) && input.tagName !== 'SELECT') setReactValue(input, vals.plate)
        if (/Detailing service/i.test(title) && input.tagName === 'SELECT') {
          input.value = vals.service
          input.dispatchEvent(new Event('change', { bubbles: true }))
        }
        if (/Preferred branch/i.test(title) && input.tagName === 'SELECT') {
          input.value = vals.branch
          input.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }
      const cb = document.querySelector('#ops-form-legal')
      if (cb && !cb.checked) cb.click()
    }, {
      name: `QA Forms ${stamp}`,
      phone: '09625294043',
      email: `qa.forms.${stamp}@example.com`,
      plate: `QA${stamp}`,
      service: serviceSel?.options?.find((o) => /Ceramic/i.test(o)) || serviceSel?.options?.[0] || 'Ceramic Coating',
      branch: branchSel?.options?.find((o) => /bacoor/i.test(o)) || branchSel?.options?.[0] || 'bacoor',
    })
    await new Promise((r) => setTimeout(r, 400))
    await shot(page, 'public-detailing-filled')

    // Prefer form submit (HTML5 validation) over random button match
    await page.evaluate(() => {
      const form = document.querySelector('.hakum-form-fields')
      if (form) form.requestSubmit()
      else document.querySelector('.hakum-form-submit')?.click()
    })
    await page
      .waitForFunction(
        () => /Thank you|Your response was submitted/i.test(document.body?.innerText || ''),
        { timeout: 15000 },
      )
      .catch(() => null)
    const afterSubmit = await page.evaluate(() => document.body?.innerText || '')
    const alert = await page.evaluate(() => document.querySelector('.hakum-form-alert')?.textContent || '')
    if (/Thank you|Your response was submitted/i.test(afterSubmit)) {
      pass('public.form.submit', 'success copy shown')
      await shot(page, 'public-detailing-success')
    } else {
      fail('public.form.submit', alert || afterSubmit.slice(0, 280))
      await shot(page, 'public-detailing-submit-FAIL')
    }

    // Edit dialog smoke from planner
    await page.goto(`${base}/operations/planning?tab=forms`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await new Promise((r) => setTimeout(r, 2000))
    await page.evaluate(() => {
      const edit = [...document.querySelectorAll('button')].find((b) =>
        /edit/i.test(b.textContent || '') || b.getAttribute('aria-label')?.match?.(/edit/i),
      )
      edit?.click()
    })
    await new Promise((r) => setTimeout(r, 1000))
    const dialogOpen = await page.evaluate(() =>
      Boolean(document.querySelector('[role="dialog"]')) ||
        /Field|Slug|Status|Public/i.test(document.body?.innerText || ''),
    )
    if (dialogOpen) {
      pass('planner.forms.edit_dialog', 'edit UI opened')
      await shot(page, 'planner-forms-edit')
    } else {
      fail('planner.forms.edit_dialog', 'edit dialog not found')
      await shot(page, 'planner-forms-edit-FAIL')
    }
  } finally {
    await browser.close().catch(() => null)
    await stop().catch(() => null)
  }

  const summary = {
    ok: results.every((r) => r.ok),
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  }
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2))
  console.log('\n---', summary.passed, 'pass /', summary.failed, 'fail ---')
  process.exit(summary.ok ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
