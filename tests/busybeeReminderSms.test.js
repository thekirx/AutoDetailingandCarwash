import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizePhMobile, busybeeErrorKind } from '../server/busybee.mjs'
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

  it('production egress plan forbids bypass and requires fixed IPs for Vercel', () => {
    assert.equal(brandTxtRequiresIpWhitelist(), true)
    const plan = productionSmsEgressPlan()
    assert.equal(plan.bypassExists, false)
    assert.equal(plan.outboundOnly, true)
    assert.equal(plan.noInboundReplies, true)
    assert.equal(plan.noOwnerSms, true)
    assert.ok(plan.sources.some((s) => s.id === 'vercel_static' && s.required))
    assert.ok(plan.sources.some((s) => s.id === 'office_dev' && s.required))
    const ips = formatWhitelistRequestIps({
      officeIps: ['180.191.244.237'],
      vercelStaticIps: ['203.0.113.10', '203.0.113.11'],
    })
    assert.deepEqual(ips.map((r) => r.ip), ['180.191.244.237', '203.0.113.10', '203.0.113.11'])
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
