import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { buildPublicInquiryRow } from '../server/publicInquiry.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

function walkSrc(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walkSrc(full))
    else if (/\.(js|jsx)$/.test(entry)) out.push(full)
  }
  return out
}

describe('public shop & legal navigation contracts', () => {
  it('contains zero broken /customer/* routes in src/ and links loyalty to /account/loyalty', () => {
    const offenders = []
    for (const file of walkSrc(join(root, 'src'))) {
      const txt = readFileSync(file, 'utf8')
      if (/['"`]\/customer\/loyalty['"`]|\/customer\/\*/.test(txt)) {
        offenders.push(file)
      }
    }
    assert.deepEqual(offenders, [], `Found stale /customer/* links in: ${offenders.join(', ')}`)
    const legal = read('src/pages/LegalPages.jsx')
    assert.match(legal, /to="\/account\/loyalty"/)
    assert.match(legal, /`\/account\/\*`/)
  })

  it('wires PublicShopPage to get_public_shop_catalog, shop_inquiry reservation, valid branchDirections, and FormLegalNotice', () => {
    const shop = read('src/pages/PublicShopPage.jsx')
    assert.match(shop, /get_public_shop_catalog/)
    assert.match(shop, /submitPublicInquiry\(\s*['"]shop_inquiry['"]/)
    assert.match(shop, /branchDirections\(\s*\{\s*slug:\s*['"]bacoor['"]/)
    assert.match(shop, /<FormLegalNotice/)
  })

  it('validates shop_inquiry fields and produces a structured contact_inquiries row', () => {
    const missing = buildPublicInquiryRow('shop_inquiry', { name: 'Ana', phone: '', productName: 'Hakum Tee' })
    assert.match(missing.error, /required/i)

    const badPhone = buildPublicInquiryRow('shop_inquiry', { name: 'Ana', phone: '123', productName: 'Hakum Tee' })
    assert.match(badPhone.error, /mobile/i)

    const badEmail = buildPublicInquiryRow('shop_inquiry', {
      name: 'Ana',
      phone: '09171234567',
      email: 'not-an-email',
      productName: 'Hakum Tee',
    })
    assert.match(badEmail.error, /email/i)

    const ok = buildPublicInquiryRow('shop_inquiry', {
      name: 'Juan Dela Cruz',
      phone: '09171234567',
      email: 'JUAN@EXAMPLE.COM',
      productName: 'Hakum Tshirt',
      branch: 'batangas',
      note: 'Size L pickup tomorrow',
    })
    assert.equal(ok.table, 'contact_inquiries')
    assert.equal(ok.row.email, 'juan@example.com')
    assert.equal(ok.row.status, 'new')
    assert.match(ok.row.subject, /Shop inquiry: Hakum Tshirt \(Batangas City\)/)
    assert.match(ok.row.message, /Size L pickup tomorrow/)
  })
})
