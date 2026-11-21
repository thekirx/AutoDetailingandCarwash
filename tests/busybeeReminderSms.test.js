import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizePhMobile, busybeeErrorKind, busybeeBalance } from '../server/busybee.mjs'
import { brandTxtRequiresIpWhitelist, productionSmsEgressPlan, formatWhitelistRequestIps } from '../src/lib/busybeeEgressPlan.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('BusyBee customer reminder SMS seams', () => {
  it('normalizes PH mobiles to 63… for SendSMS (09… fails DLR)', () => {
    assert.equal(normalizePhMobile('09625294043'), '639625294043')
    assert.equal(normalizePhMobile('639625294043'), '639625294043')
    assert.equal(normalizePhMobile('+63 962 529 4043'), '639625294043')
  })

  it('classifies BrandTxt ErrorCode 11 as unauthorized_ip (whitelist gap)', () => {
    assert.equal(
      busybeeErrorKind('{"ErrorCode":11,"ErrorDescription":"Unauthorized IP address","Data":""}'),
      'unauthorized_ip',
    )
    assert.equal(busybeeErrorKind('{"ErrorCode":0,"Data":[]}'), 'ok')
    assert.equal(busybeeErrorKind('{"ErrorCode":5,"ErrorDescription":"Insufficient credits"}'), 'provider')
  })

  it('smoke handset check is outbound-only — never asks the recipient to reply', () => {
    const smoke = readFileSync(join(root, 'scripts/smoke-busybee.mjs'), 'utf8')
    assert.match(smoke, /Hakum Auto Care/)
    assert.doesNotMatch(smoke, /reply YES|Reply YES|please reply/i)
  })

  it('shop-gate QA sends lifecycle self_test through the real SMS toggle', () => {
    const gate = readFileSync(join(root, 'scripts/qa-sms-shop-gate.mjs'), 'utf8')
    assert.match(gate, /self_test/)
    assert.match(gate, /sms_notifications/)
    assert.match(gate, /sendLifecycleSms/)
    assert.doesNotMatch(gate, /ignoreShopToggle:\s*true/)
  })

  it('reflects that BrandTxt removed IP whitelisting on HAKUM while keeping status-only outbound rules', () => {
    assert.equal(brandTxtRequiresIpWhitelist(), false)
    const plan = productionSmsEgressPlan()
    assert.equal(plan.bypassExists, false)
    assert.equal(plan.outboundOnly, true)
    assert.equal(plan.statusUpdatesOnly, true)
    assert.equal(plan.noInboundReplies, true)
    assert.equal(plan.noOwnerSms, true)
    assert.equal(plan.sources.some((s) => s.required), false)
    const ips = formatWhitelistRequestIps({
      officeIps: ['180.191.244.237'],
      vercelStaticIps: ['203.0.113.10', '203.0.113.11'],
    })
    assert.deepEqual(ips.map((r) => r.ip), ['180.191.244.237', '203.0.113.10', '203.0.113.11'])
  })

  it('uses GET /api/v2/Balance and redacts credentials from any error output', async () => {
    const saved = {
      key: process.env.BUSYBEE_API_KEY,
      cid: process.env.BUSYBEE_CLIENT_ID,
      base: process.env.BUSYBEE_API_BASE_URL,
    }
    const origFetch = globalThis.fetch
    const calls = []
    process.env.BUSYBEE_API_KEY = 'secret-api-key-value'
    process.env.BUSYBEE_CLIENT_ID = 'secret-client-uuid'
    process.env.BUSYBEE_API_BASE_URL = 'https://app.brandtxt.io'
    try {
      globalThis.fetch = async (url, init) => {
        calls.push({ url: String(url), method: init?.method })
        return new Response(
          JSON.stringify({ ErrorCode: 0, ErrorDescription: 'Success', Data: [{ Credits: 'PHP6080.250000' }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      const ok = await busybeeBalance()
      assert.equal(ok.ok, true)
      assert.equal(calls[0].method, 'GET')
      assert.match(calls[0].url, /\/api\/v2\/Balance\?/)

      globalThis.fetch = async (url) => {
        throw new Error(`network fail calling ${url}`)
      }
      const errRes = await busybeeBalance()
      assert.equal(errRes.ok, false)
      assert.doesNotMatch(errRes.json.ErrorDescription, /secret-api-key-value/)
      assert.doesNotMatch(errRes.json.ErrorDescription, /secret-client-uuid/)
    } finally {
      globalThis.fetch = origFetch
      for (const [k, envKey] of [
        ['key', 'BUSYBEE_API_KEY'],
        ['cid', 'BUSYBEE_CLIENT_ID'],
        ['base', 'BUSYBEE_API_BASE_URL'],
      ]) {
        if (saved[k] === undefined) delete process.env[envKey]
        else process.env[envKey] = saved[k]
      }
    }
  })

  it('ops request email template exists for BrandTxt', () => {
    const md = readFileSync(join(root, 'docs/OPS/BUSYBEE-BRANDTXT-REQUEST.md'), 'utf8')
    assert.match(md, /Subject:/)
    assert.match(md, /180\.191\.244\.237/)
    assert.match(md, /Static IP/i)
    assert.match(md, /outbound[- ]only/i)
    assert.doesNotMatch(md, /owner daily SMS/i)
  })
})
