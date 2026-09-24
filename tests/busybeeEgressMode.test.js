import assert from 'node:assert/strict'
import { describe, it, beforeEach, afterEach } from 'node:test'
import {
  normalizePhMobile,
  resolveBusybeeSendMode,
  busybeeSendSms,
} from '../server/busybee.mjs'

describe('BusyBee production egress (permanent live)', () => {
  const prev = {}

  beforeEach(() => {
    for (const k of [
      'BUSYBEE_RELAY_URL',
      'BUSYBEE_RELAY_SECRET',
      'BUSYBEE_API_KEY',
      'BUSYBEE_CLIENT_ID',
      'BUSYBEE_SENDER_ID',
      'BUSYBEE_API_BASE_URL',
      'VERCEL',
      'VERCEL_ENV',
    ]) {
      prev[k] = process.env[k]
      delete process.env[k]
    }
    process.env.BUSYBEE_API_KEY = 'test-key'
    process.env.BUSYBEE_CLIENT_ID = 'test-client'
    process.env.BUSYBEE_SENDER_ID = 'HAKUM'
    process.env.BUSYBEE_API_BASE_URL = 'https://app.brandtxt.io'
  })

  afterEach(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })

  it('uses relay mode when BUSYBEE_RELAY_URL is set (fixed-egress path)', () => {
    process.env.BUSYBEE_RELAY_URL = 'https://sms-relay.example.com/send'
    process.env.BUSYBEE_RELAY_SECRET = 's3cret'
    assert.equal(resolveBusybeeSendMode(), 'relay')
  })

  it('uses direct mode when no relay (Vercel Static IP / office whitelist path)', () => {
    assert.equal(resolveBusybeeSendMode(), 'direct')
  })

  it('posts to the relay with secret and never exposes BrandTxt keys to the caller payload shape', async () => {
    process.env.BUSYBEE_RELAY_URL = 'https://sms-relay.example.com/send'
    process.env.BUSYBEE_RELAY_SECRET = 's3cret'
    const calls = []
    const orig = globalThis.fetch
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init })
      return new Response(
        JSON.stringify({
          ok: true,
          status: 'sent',
          messageId: 'msg-relay-1',
          providerResponse: '{"ErrorCode":0}',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }
    try {
      const result = await busybeeSendSms({ phone: '09625294043', message: 'Hakum reminder test' })
      assert.equal(result.ok, true)
      assert.equal(result.messageId, 'msg-relay-1')
      assert.equal(result.path, 'relay')
      assert.equal(calls.length, 1)
      assert.equal(calls[0].url, 'https://sms-relay.example.com/send')
      const body = JSON.parse(calls[0].init.body)
      assert.equal(body.phone, '09625294043')
      assert.equal(body.message, 'Hakum reminder test')
      assert.equal(body.secret, 's3cret')
      assert.equal(body.apiKey, undefined)
      assert.equal(normalizePhMobile(body.phone), '639625294043')
    } finally {
      globalThis.fetch = orig
    }
  })
})
