import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPosNotifyCopy } from '../server/notifyPos.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('POS Super Admin notify + audit seam', () => {
  it('builds inbox copy for walk-in sale, expense, and cash advance', () => {
    const sale = buildPosNotifyCopy({
      event: 'sale',
      branch: 'bacoor',
      amountMinor: 35000,
      entityId: 'sale-1',
    })
    assert.equal(sale.kind, 'pos_sale')
    assert.match(sale.title, /POS sale/i)
    assert.match(sale.body, /bacoor/)
    assert.equal(sale.url, '/operations/pos')
    assert.equal(sale.tag, 'pos-sale-sale-1')

    const exp = buildPosNotifyCopy({
      event: 'expense',
      branch: 'bacoor',
      amountMinor: 2000,
      title: 'ice',
      entityId: 'exp-1',
    })
    assert.equal(exp.kind, 'pos_expense')
    assert.match(exp.body, /ice/)

    const ca = buildPosNotifyCopy({
      event: 'cash_advance',
      branch: 'bacoor',
      amountMinor: 50000,
      title: 'Darel',
      status: 'resolved',
      entityId: 'ca-1',
    })
    assert.equal(ca.kind, 'pos_cash_advance')
    assert.match(ca.title, /approved/i)
  })

  it('gateway, vite, and vercel expose notify-pos', () => {
    const api = readFileSync(join(root, 'api/notifications.js'), 'utf8')
    const vite = readFileSync(join(root, 'vite.config.js'), 'utf8')
    const vercel = readFileSync(join(root, 'vercel.json'), 'utf8')
    const pos = readFileSync(join(root, 'src/pages/PosPage.jsx'), 'utf8')
    assert.match(api, /notify-pos/)
    assert.match(vite, /\/api\/notify-pos/)
    assert.match(vercel, /\/api\/notify-pos/)
    assert.match(pos, /\/api\/notify-pos/)
    assert.match(pos, /writeAudit/)
  })
})
