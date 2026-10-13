import assert from 'node:assert/strict'
import { describe, it, beforeEach, afterEach } from 'node:test'
import { createHash } from 'node:crypto'
import { handleDemoLoginRequest } from '../server/demoLoginApi.mjs'
import { isDemoLoginEnabled } from '../src/lib/demoLogin.js'

const KEY = 'test-qa-key-not-the-real-one'

async function call(body) {
  const res = {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(k, v) { this.headers[k] = v },
    end(b = '') { this.body = b },
  }
  await handleDemoLoginRequest({ method: 'POST', headers: {}, body }, res)
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
})

describe('demo chips render only on a device holding a QA key', () => {
  it('is off without a key, in production and in dev alike', () => {
    assert.equal(isDemoLoginEnabled({ qaKey: '' }), false)
  })
  it('is on once a key is stored', () => {
    assert.equal(isDemoLoginEnabled({ qaKey: 'anything-the-server-accepted' }), true)
  })
})
