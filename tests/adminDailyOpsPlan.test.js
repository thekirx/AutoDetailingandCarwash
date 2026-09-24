import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { productionSmsEgressPlan } from '../src/lib/busybeeEgressPlan.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('Admin daily-ops plan (no redesign)', () => {
  it('tracker forbids redesign and points at money path + ops artifacts', () => {
    const md = readFileSync(join(root, 'docs/OPS/ADMIN-DAILY-OPS-TRACKER.md'), 'utf8')
    assert.match(md, /do \*\*not\*\* need a POS \/ Payroll \/ Finance redesign/i)
    assert.match(md, /BA POS/)
    assert.match(md, /brandtxt-dexter-followup\.txt/)
    assert.match(md, /VERCEL-STATIC-IPS\.md/)
    assert.match(md, /AUTH-SMTP-PROOF\.md/)
    assert.match(md, /ADMIN-FRICTION-LOG\.md/)
  })

  it('Dexter follow-up paste file targets drifted office IP and Malcolm', () => {
    const txt = readFileSync(join(root, 'docs/OPS/brandtxt-dexter-followup.txt'), 'utf8')
    assert.match(txt, /180\.191\.244\.237/)
    assert.match(txt, /Malcolm Joaquin Cuady/)
    assert.match(txt, /no longer sending an owner daily/i)
    assert.match(txt, /Vercel Static IPs/)
  })

  it('friction log seeds FLOPS payroll overlap and blocks redesign until ops + repeated High', () => {
    const md = readFileSync(join(root, 'docs/qa/ADMIN-FRICTION-LOG.md'), 'utf8')
    assert.match(md, /Overlapping floor payroll/)
    assert.match(md, /Redesign gate/)
    assert.match(md, /BrandTxt/)
    assert.match(md, /Auth SMTP/)
  })

  it('Auth SMTP and Vercel Static IP runbooks exist with project / missing-link honesty', () => {
    assert.equal(existsSync(join(root, 'docs/OPS/AUTH-SMTP-PROOF.md')), true)
    assert.equal(existsSync(join(root, 'docs/OPS/VERCEL-STATIC-IPS.md')), true)
    const smtp = readFileSync(join(root, 'docs/OPS/AUTH-SMTP-PROOF.md'), 'utf8')
    const vercel = readFileSync(join(root, 'docs/OPS/VERCEL-STATIC-IPS.md'), 'utf8')
    assert.match(smtp, /lybxhpzzqqyqswvuwpxv/)
    assert.match(smtp, /\*\*OPEN\*\*/)
    assert.match(vercel, /Not found|Missing/i)
    assert.equal(productionSmsEgressPlan().bypassExists, false)
  })
})
