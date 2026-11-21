import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, beforeEach, afterEach } from 'node:test'
import { createHash } from 'node:crypto'
import { handleDemoLoginRequest } from '../server/demoLoginApi.mjs'
import { isDemoLoginEnabled, QA_KEY_STORAGE, DEFAULT_QA_KEY } from '../src/lib/demoLogin.js'
import { unlockDemoLoginFromUrl, isDemoLoginVisible } from '../src/lib/demoSignIn.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const KEY = 'test-qa-key-not-the-real-one'

async function call(body, { remoteAddress = '127.0.0.1', options, site = 'hakumauto.vercel.app' } = {}) {
  const res = {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(k, v) { this.headers[k] = v },
    end(b = '') { this.body = b },
  }
  await handleDemoLoginRequest({ method: 'POST', headers: site ? { host: site } : {}, body, socket: { remoteAddress } }, res, options)
  return res
}

describe('demo sign-in is locked behind the QA key', () => {
  const saved = {}
  beforeEach(() => {
    for (const k of ['DEMO_LOGIN_KEY_SHA256', 'DEMO_LOGIN_ENABLED']) saved[k] = process.env[k]
    process.env.DEMO_LOGIN_KEY_SHA256 = createHash('sha256').update(KEY).digest('hex')
    delete process.env.DEMO_LOGIN_ENABLED
  })
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v
  })

  it('is a 404 without a key, so the route does not advertise itself', async () => {
    assert.equal((await call({ id: 'boss' })).statusCode, 404)
    assert.equal((await call({ check: true })).statusCode, 404)
  })

  it('is a 404 for a wrong key', async () => {
    assert.equal((await call({ id: 'boss', key: 'guess' })).statusCode, 404)
    assert.equal((await call({ check: true, key: `${KEY}x` })).statusCode, 404)
  })

  it('accepts the right key for a check without signing anyone in', async () => {
    assert.equal((await call({ check: true, key: KEY })).statusCode, 200)
  })

  it('stays off for everyone when DEMO_LOGIN_ENABLED=false', async () => {
    process.env.DEMO_LOGIN_ENABLED = 'false'
    assert.equal((await call({ check: true, key: KEY })).statusCode, 404)
  })

  it('rejects an unknown account even with the key', async () => {
    assert.equal((await call({ id: 'not-a-demo-account', key: KEY })).statusCode, 400)
  })

  it('local `npm run dev` needs no key, but only from this computer', async () => {
    const localDev = { localDev: true }
    assert.equal((await call({ check: true }, { options: localDev })).statusCode, 200)
    assert.equal((await call({ check: true }, { options: localDev, remoteAddress: '::1' })).statusCode, 200)
    assert.equal((await call({ check: true }, { options: localDev, remoteAddress: '::ffff:127.0.0.1' })).statusCode, 200)
    assert.equal((await call({ check: true }, { options: localDev, remoteAddress: '192.168.1.20' })).statusCode, 404)
    assert.equal((await call({ check: true }, { options: localDev, remoteAddress: null })).statusCode, 404)
  })

  it('the deployed route (no localDev option) still needs the key, even from loopback', async () => {
    assert.equal((await call({ check: true })).statusCode, 404)
  })

  it('answers only on the Vercel test link, never on hakumautocare.com or arbitrary domains, even with the key', async () => {
    for (const allowedHost of [
      'hakumauto.vercel.app',
      'hakumauto-hakum-auto-cares-projects.vercel.app',
      'hakumauto-git-main-hakum-auto-cares-projects.vercel.app',
      'localhost',
      'localhost:5173',
    ]) {
      assert.equal((await call({ check: true, key: KEY }, { site: allowedHost })).statusCode, 200, `${allowedHost} must allow demo login`)
    }
    for (const blockedHost of [
      'hakumautocare.com',
      'www.hakumautocare.com',
      'ops.hakumautocare.com',
      'vercel.app',
      'example.com',
      '',
    ]) {
      assert.equal((await call({ check: true, key: KEY }, { site: blockedHost })).statusCode, 404, `${blockedHost || '(empty)'} must return 404`)
    }
  })

  it('DEMO_LOGIN_ENABLED=false turns local dev off too', async () => {
    process.env.DEMO_LOGIN_ENABLED = 'false'
    assert.equal((await call({ check: true }, { options: { localDev: true } })).statusCode, 404)
  })
})

describe('demo chips render only on a device holding a QA key', () => {
  it('is off without a key in a production build', () => {
    assert.equal(isDemoLoginEnabled({ qaKey: '', dev: false }), false)
    assert.equal(isDemoLoginEnabled({ qaKey: '' }), false)
  })
  it('is on without a key under `npm run dev`', () => {
    assert.equal(isDemoLoginEnabled({ qaKey: '', dev: true }), true)
  })
  it('is on once a key is stored', () => {
    assert.equal(isDemoLoginEnabled({ qaKey: 'anything-the-server-accepted' }), true)
  })
  it('stays hidden on hakumautocare.com and arbitrary custom domains even with a key, shown on *.vercel.app', () => {
    for (const host of [
      'hakumautocare.com',
      'www.hakumautocare.com',
      'ops.hakumautocare.com',
      'vercel.app',
      'example.com',
    ]) {
      assert.equal(isDemoLoginEnabled({ qaKey: 'k', site: host }), false, `${host} must disable demo chips`)
    }
    for (const host of [
      'hakumauto.vercel.app',
      'hakumauto-hakum-auto-cares-projects.vercel.app',
      'hakumauto-git-main-hakum-auto-cares-projects.vercel.app',
    ]) {
      assert.equal(isDemoLoginEnabled({ qaKey: 'k', site: host }), true, `${host} must enable demo chips`)
    }
    assert.equal(isDemoLoginEnabled({ qaKey: '', dev: true, site: 'localhost' }), true)
  })

  it('shows chips on the first ?qa= visit even when React runs the unlock twice (dev StrictMode)', async () => {
    const store = new Map()
    const globals = { window: globalThis.window, localStorage: globalThis.localStorage, fetch: globalThis.fetch }
    globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) }
    globalThis.window = {
      location: { href: 'http://localhost:5173/operations/login?qa=good' },
      history: { state: null, replaceState: (_s, _t, path) => { globalThis.window.location.href = `http://localhost:5173${path}` } },
    }
    globalThis.fetch = () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 10))
    try {
      const first = unlockDemoLoginFromUrl()
      const second = unlockDemoLoginFromUrl()
      assert.deepEqual(await Promise.all([first, second]), [true, true])
    } finally {
      Object.assign(globalThis, globals)
    }
  })

  it('shows easy login cards across *.vercel.app hosts and DemoAccountChips gates on isDemoLoginVisible()', async () => {
    const chipsSrc = readFileSync(join(ROOT, 'src/components/DemoAccountChips.jsx'), 'utf8')
    assert.match(chipsSrc, /isDemoLoginVisible\s*\(\s*\)/)
    assert.match(chipsSrc, /if\s*\(\s*!isDemoLoginVisible\(\s*\)\s*\)\s*return\s+null/)

    for (const host of [
      'hakumauto.vercel.app',
      'hakumauto-hakum-auto-cares-projects.vercel.app',
      'hakumauto-git-main-hakum-auto-cares-projects.vercel.app',
    ]) {
      const store = new Map()
      const globals = { window: globalThis.window, localStorage: globalThis.localStorage }
      globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) }
      globalThis.window = {
        location: { hostname: host, href: `https://${host}/operations/login` },
      }
      try {
        assert.equal(isDemoLoginVisible(), true, `${host} must show easy login`)
        await unlockDemoLoginFromUrl()
        assert.equal(store.get(QA_KEY_STORAGE), DEFAULT_QA_KEY)
        assert.equal(isDemoLoginVisible(), true)
      } finally {
        Object.assign(globalThis, globals)
      }
    }
  })

  it('hides easy login cards on main and custom domains even with ?qa= or stale localStorage', async () => {
    for (const host of [
      'hakumautocare.com',
      'www.hakumautocare.com',
      'ops.hakumautocare.com',
      'vercel.app',
      'example.com',
    ]) {
      const store = new Map()
      store.set(QA_KEY_STORAGE, DEFAULT_QA_KEY)
      const globals = { window: globalThis.window, localStorage: globalThis.localStorage }
      globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) }
      globalThis.window = {
        location: { hostname: host, href: `https://${host}/operations/login?qa=some-key` },
      }
      try {
        assert.equal(isDemoLoginVisible(), false, `${host} must hide easy login`)
        assert.equal(store.has(QA_KEY_STORAGE), false, 'stale key removed on non-Vercel domain')
        store.set(QA_KEY_STORAGE, 'arbitrary-manual-key')
        assert.equal(isDemoLoginVisible(), false, 'non-default manual key must never enable chips on main domain')
        assert.equal(store.has(QA_KEY_STORAGE), false)
        const result = await unlockDemoLoginFromUrl()
        assert.equal(result, false)
        assert.equal(isDemoLoginVisible(), false)
      } finally {
        Object.assign(globalThis, globals)
      }
    }
  })
})
