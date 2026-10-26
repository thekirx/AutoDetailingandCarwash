import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import {
  customerVoucherRulesLine,
  mintPromoCode,
  normalizePromoCode,
  promoAppliesToService,
  promoCodeShapeError,
  promoDiscountedPriceMinor,
  promoVoucherRemaining,
  promoVoucherWindowError,
} from '../src/lib/promoVoucher.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

describe('promo vouchers', () => {
  it('normalizes codes, discounts price, and gates the window', () => {
    assert.match(mintPromoCode(() => 0), /^VK[A-Z2-9]{4}$/)
    assert.equal(normalizePromoCode(' vk-ab 12 '), 'VKAB12')
    assert.equal(promoCodeShapeError('AB'), 'Type a voucher code of 4 to 16 letters or numbers.')
    assert.equal(promoCodeShapeError('SUMMER10'), null)
    assert.equal(promoDiscountedPriceMinor(10000, { discount_kind: 'free' }), 0)
    assert.equal(promoDiscountedPriceMinor(10000, { discount_kind: 'percent', discount_percent: 10 }), 9000)
    assert.equal(promoVoucherRemaining({ max_uses: 10, uses_count: 3 }), 7)
    assert.equal(
      promoVoucherWindowError({ is_active: true, max_uses: 10, uses_count: 10, starts_on: null, ends_on: null }, '2026-10-19'),
      'That voucher has no uses left.',
    )
    assert.equal(
      promoVoucherWindowError(
        { is_active: true, max_uses: 10, uses_count: 0, starts_on: '2026-10-01', ends_on: '2026-10-31' },
        '2026-10-19',
      ),
      null,
    )
    assert.equal(promoAppliesToService({ applies_to: 'wash' }, 'wash', 'service'), true)
    assert.equal(promoAppliesToService({ applies_to: 'wash' }, 'detailing', 'detailing'), false)
    assert.match(customerVoucherRulesLine({ discount_kind: 'percent', discount_percent: 15, max_uses: 10, uses_count: 2, ends_on: '2026-11-01' }), /15% off/)
  })

  it('gates apply and consume in SQL and puts Vouchers on the SA nav', async () => {
    const sql = await readFile(resolve(root, 'supabase/migrations/20261019110000_promo_vouchers.sql'), 'utf8')
    const perms = await readFile(resolve(root, 'src/auth/permissions.js'), 'utf8')
    const editor = await readFile(resolve(root, 'src/components/QueueTicketEditor.jsx'), 'utf8')
    const pos = await readFile(resolve(root, 'src/pages/PosPage.jsx'), 'utf8')
    const page = await readFile(resolve(root, 'src/pages/VouchersPage.jsx'), 'utf8')

    assert.match(sql, /create table if not exists public\.promo_vouchers/)
    assert.match(sql, /apply_booking_promo_voucher/)
    assert.match(sql, /consume_booking_promo_voucher/)
    assert.match(sql, /Only a Team Lead can apply a voucher code on the queue/)
    const widened = await readFile(resolve(root, 'supabase/migrations/20261026202000_voucher_apply_pos.sql'), 'utf8')
    assert.match(widened, /team_lead', 'admin', 'BossMich'/)
    assert.match(widened, /Only the Team Lead, Branch Admin, or office can apply a voucher/)
    assert.match(perms, /canManageVouchers/)
    assert.match(perms, /nav\('Vouchers', '\/operations\/vouchers'/)
    assert.match(editor, /apply_booking_promo_voucher/)
    assert.match(pos, /consume_booking_promo_voucher/)
    assert.match(page, /max_uses/)
  })
})
